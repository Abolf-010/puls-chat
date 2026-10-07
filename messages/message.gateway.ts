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
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { DeliverMessageDto } from './dto/deliver-message.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessageGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const secret =
      this.configService.get<string>('JWT_SECRET');
      // this.configService.get<string>('JWT_REFRESH_SECRET') ||
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const uid = String(payload.sub);
      client.data.user = {
        userId: uid,
        username: payload.username,
      };
      this.trackSocket(uid, client);
      await this.joinUserRooms(client, uid);
        
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.untrackSocket(client);
    this.logger.log(`disconnect1 ${client.data?.user?.userId || client.id}`);
    
  }


  private async joinUserRooms(client: Socket, userId: string) {
    const uid = String(userId);
    await client.join('user:' + uid);
    try {
      const convIds =
        (await this.messageService.getConversationIdsForUser(uid)) || [];
      for (const cid of convIds) {
        await client.join('conversation:' + String(cid));
      }
      this.logger.log(
        `join rooms user=${uid} conversations=${convIds.length} socket=${client.id}`,
      );
    } catch (e: any) {
      this.logger.warn(`joinUserRooms fail: ${e?.message || e}`);
    }
  }


  
  /** userId -> set of socket ids (reliable direct emit) */
  private readonly userSockets = new Map<string, Set<string>>();

  private trackSocket(userId: string, client: Socket) {
    const uid = String(userId);
    let set = this.userSockets.get(uid);
    if (!set) {
      set = new Set();
      this.userSockets.set(uid, set);
    }
    set.add(client.id);
    client.data.user = client.data.user || {};
    client.data.user.userId = uid;
  }

  private untrackSocket(client: Socket) {
    const uid = String(client.data?.user?.userId || '');
    if (!uid) return;
    const set = this.userSockets.get(uid);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) this.userSockets.delete(uid);
  }

  private userIdOf(sock: Socket): string {
    return String(sock.data?.user?.userId ?? '');
  }

  /** Emit event to every connected socket of this userId */
  private emitToUserId(userId: string, event: string, payload: unknown): number {
    const uid = String(userId);
    let n = 0;
    const ids = this.userSockets.get(uid);
    if (ids && ids.size) {
      for (const sid of ids) {
        const sock = this.server.sockets.sockets.get(sid);
        if (sock) {
          sock.emit(event, payload);
          n++;
        }
      }
    }
    // fallback: scan all sockets (in case map missed)
    if (n === 0) {
      for (const [, sock] of this.server.sockets.sockets) {
        if (this.userIdOf(sock) === uid) {
          sock.emit(event, payload);
          n++;
        }
      }
    }
    return n;
  }

  private uid(client: Socket) {
    return client.data?.user?.userId as string | undefined;
  }

  @SubscribeMessage('message:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.uid(client);
    if (!userId) return { success: false, error: 'Unauthorized' };
    try {
      await this.messageService.assertMembership(userId, data.conversationId);
      await client.join(`conversation:${data.conversationId}`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('message:leave')
  async handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await client.leave(`conversation:${data.conversationId}`);
    return { success: true };
  }

  
  
  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: CreateMessageDto & {
      replyToMessageId?: string;
      clientMessageId?: string;
    },
  ) {
    const userId = this.uid(client);
    if (!userId) return { success: false, error: 'Unauthorized' };
    try {
      const message = await this.messageService.createMessage(
        userId,
        data.conversationId,
        data.content,
        data.type || 'text',
        data.replyToMessageId,
        data.clientMessageId,
      );

      // Open chat bubbles
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message:new', message);

      // Card update: direct to each member socket by userId
      let memberIds: string[] = [];
      try {
        memberIds = await this.messageService.getActiveMemberIds(
          data.conversationId,
        );
      } catch (e: any) {
        this.logger.warn(`getActiveMemberIds: ${e?.message || e}`);
      }

      const cardPayload = {
        conversationId: String(data.conversationId),
        messageId: (message as any).messageId,
        senderId: (message as any).senderId,
        content: (message as any).content,
        type: (message as any).type || 'text',
        createdAt: (message as any).createdAt || new Date().toISOString(),
        preview:
          ((message as any).type || 'text') === 'text'
            ? String((message as any).content || '').slice(0, 120)
            : `[${(message as any).type}]`,
      };

      if (!memberIds.length) {
        this.logger.warn(
          `no members for conv=${data.conversationId} — card emit skipped`,
        );
      }
      for (const mid of memberIds) {
        const uid = String(mid);
        // Room joined on connect (user:{id}) — works even if Map missed
        this.server.to('user:' + uid).emit('conversation:card', cardPayload);
        this.server.to('user:' + uid).emit('message:new', message);
        // Direct sockets backup
        const n = this.emitToUserId(uid, 'conversation:card', cardPayload);
        this.emitToUserId(uid, 'message:new', message);
        this.logger.log(
          `card→user ${uid} directSockets=${n} conv=${data.conversationId}`,
        );
      }

      return { success: true, message };
    } catch (err: any) {
      this.logger.error(`Send failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }


  @SubscribeMessage('message:edit')
  async handleEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const userId = this.uid(client);
    if (!userId) return { success: false, error: 'Unauthorized' };
    try {
      const message = await this.messageService.editMessage(
        userId,
        data.messageId,
        data.content,
      );
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('message:edited', message);
      return { success: true, message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('message:delete')
  async handleDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = this.uid(client);
    if (!userId) return { success: false, error: 'Unauthorized' };
    try {
      
      const message = await this.messageService.deleteMessage(
        userId,
        data.messageId,
      );
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('message:deleted', {
          messageId: message.messageId,
          conversationId: message.conversationId,
          deletedAt: message.deletedAt,
        });

      return { success: true, message };
    } catch (err: any) {
      
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('message:delivered')
  async handleDelivered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeliverMessageDto,
  ) {
    const userId = this.uid(client);
    if (!userId || !data?.messageId) {
      return { success: false, error: 'Unauthorized' };
    }
    try {
      const receipt = await this.messageService.markAsDelivered(
        data.messageId,
        userId,
      );
      let conversationId = data.conversationId;
      if (!conversationId) {
        const msg = await this.messageService.findByMessageId(data.messageId);
        conversationId = msg.conversationId;
      }
      this.server.to(`conversation:${conversationId}`).emit('message:receipt', {
        messageId: data.messageId,
        userId,
        conversationId,
        deliveredAt: (receipt as any)?.deliveredAt ?? new Date(),
        status: 'delivered',
      });
      return { success: true, receipt };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeliverMessageDto,
  ) {
    const userId = this.uid(client);
    if (!userId || !data?.messageId) {
      return { success: false, error: 'Unauthorized' };
    }
    try {
      const receipt = await this.messageService.markAsRead(
        data.messageId,
        userId,
      );
      let conversationId = data.conversationId;
      if (!conversationId) {
        const msg = await this.messageService.findByMessageId(data.messageId);
        conversationId = msg.conversationId;
      }
      const receiptPayload = {
        messageId: data.messageId,
        userId,
        conversationId,
        deliveredAt: (receipt as any)?.deliveredAt ?? new Date(),
        readAt: (receipt as any)?.readAt ?? new Date(),
        status: 'read',
      };
      this.server
        .to(`conversation:${conversationId}`)
        .emit('message:receipt', receiptPayload);
      try {
        const msg = await this.messageService.findByMessageId(data.messageId);
        const senderId = String((msg as any)?.senderId || '');
        if (senderId) {
          this.server.to('user:' + senderId).emit('message:receipt', receiptPayload);
          if (typeof (this as any).emitToUserId === 'function') {
            (this as any).emitToUserId(senderId, 'message:receipt', receiptPayload);
          }
        }
      } catch {}
      return { success: true, receipt };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('message:readAll')
  async handleReadAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.uid(client);
    if (!userId || !data?.conversationId) {
      return { success: false, error: 'Unauthorized' };
    }
    try {
      const result = await this.messageService.markConversationRead(
        data.conversationId,
        userId,
      );
      const payload = {
        conversationId: data.conversationId,
        userId,
        messageIds: result.messageIds || [],
        status: 'read',
        readAt: new Date(),
      };
      // Room (open chat peers)
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('message:receipt:bulk', payload);
      // Also notify all members via user rooms (sender may not be in conv room)
      try {
        const members = await this.messageService.getActiveMemberIds(
          data.conversationId,
        );
        for (const mid of members) {
          this.server.to('user:' + String(mid)).emit('message:receipt:bulk', payload);
          if (typeof (this as any).emitToUserId === 'function') {
            (this as any).emitToUserId(String(mid), 'message:receipt:bulk', payload);
          }
        }
      } catch (e: any) {
        this.logger.warn(`readAll user emit: ${e?.message || e}`);
      }
      this.logger.log(
        `readAll user=${userId} conv=${data.conversationId} msgs=${payload.messageIds.length}`,
      );
      return { success: true, ...result };
    } catch (err: any) {
      this.logger.error(`readAll failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.uid(client);
    if (!userId || !data?.conversationId) return;
    client.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = this.uid(client);
    if (!userId || !data?.conversationId) return;
    client.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId,
      isTyping: false,
    });
  }
}
