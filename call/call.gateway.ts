import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { CallService } from './call.service';
import type{
  CallAcceptedPayload,
  CallEndedPayload,
  CallFailedPayload,
  CallIcePayload,
  CallIncomingPayload,
  CallSdpPayload,
  CallStartPayload,
} from './call.types';

/**
 * Signaling only. Auth = access token (JWT_SECRET) on handshake.auth.token
 *
 * start → ringing + incoming → accept → accepted → offer/answer/ice → end
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CallGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly callService: CallService,
  ) {}

  private stage(name: string, data: Record<string, unknown> = {}) {
    this.logger.log(`[CALL][${name}] ${JSON.stringify(data)}`);
  }

  private uid(client: Socket): string | undefined {
    return client.data?.user?.userId as string | undefined;
  }

  private onlineMap(): { socketId: string; userId: string }[] {
    const list: { socketId: string; userId: string }[] = [];
    for (const [, sock] of this.server.sockets.sockets) {
      list.push({
        socketId: sock.id,
        userId: String(sock.data?.user?.userId ?? ''),
      });
    }
    return list;
  }

  private emitToUser(userId: string, event: string, payload: unknown): number {
    let n = 0;
    const socketIds: string[] = [];
    for (const [, sock] of this.server.sockets.sockets) {
      if (String(sock.data?.user?.userId) === String(userId)) {
        sock.emit(event, payload);
        socketIds.push(sock.id);
        n++;
      }
    }
    this.stage('EMIT', { event, userId, delivered: n, socketIds });
    return n;
  }

  private fail(client: Socket, reason: string) {
    const body: CallFailedPayload = { reason };
    client.emit('call:failed', body);
    this.stage('FAIL', { reason, socketId: client.id });
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.stage('AUTH_FAIL', { reason: 'no_token', socketId: client.id });
      client.disconnect();
      return;
    }
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const userId = String(payload.sub);
      client.data.user = {
        userId,
        username: payload.username as string | undefined,
      };
      this.stage('AUTH_OK', { userId, socketId: client.id });
    } catch (e: any) {
      this.stage('AUTH_FAIL', {
        reason: e?.message || String(e),
        socketId: client.id,
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.uid(client);
    this.stage('DISCONNECT', { userId, socketId: client.id });
    if (!userId) return;
    const active = this.callService.getCallForUser(userId);
    if (!active) return;
    const ended = this.callService.endCall(active.callId, userId);
    if (ended.success && ended.call) {
      const payload: CallEndedPayload = {
        callId: active.callId,
        reason: 'disconnect',
      };
      this.emitToUser(ended.call.callerId, 'call:ended', payload);
      this.emitToUser(ended.call.receiverId, 'call:ended', payload);
    }
  }

  @SubscribeMessage('call:start')
  async onStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallStartPayload,
  ) {
    const callerId = this.uid(client);
    this.stage('START_IN', {
      callerId,
      receiverId: data?.receiverId,
      online: this.onlineMap(),
    });

    if (!callerId) return this.fail(client, 'unauthorized');

    const receiverId = data?.receiverId ? String(data.receiverId) : '';
    if (!receiverId) return this.fail(client, 'invalid_receiver');
    if (receiverId === callerId) return this.fail(client, 'cannot_call_self');

    const receiverSockets = this.onlineMap().filter(
      (r) => r.userId === receiverId,
    );
    if (receiverSockets.length === 0) {
      return this.fail(client, 'offline');
    }

    const result = this.callService.startCall(callerId, receiverId);
    if (!result.success || !result.callId) {
      return this.fail(client, result.reason || 'start_failed');
    }

    const callId = result.callId;
    this.stage('START_OK', { callId, callerId, receiverId });

    this.emitToUser(callerId, 'call:ringing', { callId, receiverId });

    const incoming: CallIncomingPayload = {
      callId,
      callerId,
      conversationId: data?.conversationId,
    };
    const n = this.emitToUser(receiverId, 'call:incoming', incoming);
    this.stage('INCOMING_SENT', { callId, delivered: n });

    this.callService.scheduleRingTimeout(callId, async (id) => {
      this.stage('TIMEOUT', { callId: id });
      const payload: CallEndedPayload = { callId: id, reason: 'timeout' };
      this.emitToUser(callerId, 'call:ended', payload);
      this.emitToUser(receiverId, 'call:ended', payload);
    });
  }

  @SubscribeMessage('call:accept')
  async onAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string },
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    this.stage('ACCEPT_IN', { userId, callId, online: this.onlineMap() });

    if (!userId || !callId) return this.fail(client, 'bad_request');

    const result = this.callService.acceptCall(callId, userId);
    if (!result.success || !result.call) {
      return this.fail(client, result.reason || 'accept_failed');
    }

    const payload: CallAcceptedPayload = {
      callId,
      callerId: result.call.callerId,
      receiverId: result.call.receiverId,
    };

    const toCaller = this.emitToUser(
      result.call.callerId,
      'call:accepted',
      payload,
    );
    const toReceiver = this.emitToUser(
      result.call.receiverId,
      'call:accepted',
      payload,
    );

    this.stage('ACCEPTED_OUT', {
      callId,
      deliveredToCaller: toCaller,
      deliveredToReceiver: toReceiver,
    });

    if (toCaller === 0) {
      this.stage('ACCEPTED_WARN', {
        msg: 'caller has 0 sockets — offer will not start',
        callerId: result.call.callerId,
        online: this.onlineMap(),
      });
    }
  }

  @SubscribeMessage('call:reject')
  async onReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string },
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    this.stage('REJECT_IN', { userId, callId });
    if (!userId || !callId) return;

    const result = this.callService.rejectCall(callId, userId);
    if (!result.success || !result.call) return;

    const payload: CallEndedPayload = { callId, reason: 'rejected' };
    this.emitToUser(result.call.callerId, 'call:rejected', payload);
    this.emitToUser(result.call.receiverId, 'call:rejected', payload);
    this.stage('REJECT_OK', { callId });
  }

  @SubscribeMessage('call:offer')
  async onOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallSdpPayload,
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    const call = callId ? this.callService.getCall(callId) : undefined;
    this.stage('OFFER_IN', { userId, callId, hasSdp: !!data?.sdp });
    if (!userId || !call || !data?.sdp) return;
    if (call.callerId !== userId) return;

    const n = this.emitToUser(call.receiverId, 'call:offer', {
      callId: call.callId,
      sdp: data.sdp,
    } satisfies CallSdpPayload);
    this.stage('OFFER_OUT', { callId, delivered: n });
  }

  @SubscribeMessage('call:answer')
  async onAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallSdpPayload,
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    const call = callId ? this.callService.getCall(callId) : undefined;
    this.stage('ANSWER_IN', { userId, callId, hasSdp: !!data?.sdp });
    if (!userId || !call || !data?.sdp) return;
    if (call.receiverId !== userId) return;

    const n = this.emitToUser(call.callerId, 'call:answer', {
      callId: call.callId,
      sdp: data.sdp,
    } satisfies CallSdpPayload);
    this.stage('ANSWER_OUT', { callId, delivered: n });
  }

  @SubscribeMessage('call:ice')
  async onIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallIcePayload,
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    const call = callId ? this.callService.getCall(callId) : undefined;
    if (!userId || !call || !data?.candidate) return;

    const target =
      call.callerId === userId ? call.receiverId : call.callerId;
    this.emitToUser(target, 'call:ice', {
      callId: call.callId,
      candidate: data.candidate,
    } satisfies CallIcePayload);
  }

  @SubscribeMessage('call:end')
  async onEnd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { callId?: string },
  ) {
    const userId = this.uid(client);
    const callId = data?.callId ? String(data.callId) : '';
    this.stage('END_IN', { userId, callId });
    if (!userId || !callId) return;

    const result = this.callService.endCall(callId, userId);
    if (!result.success || !result.call) return;

    const payload: CallEndedPayload = { callId, reason: 'ended' };
    this.emitToUser(result.call.callerId, 'call:ended', payload);
    this.emitToUser(result.call.receiverId, 'call:ended', payload);
    this.stage('END_OK', { callId });
  }
}
