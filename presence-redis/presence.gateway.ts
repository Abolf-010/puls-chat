import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { SessionService } from '../session/session.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PresenceGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly sessionService: SessionService,
  ) {}

  // ───────────────────────────── Connection ─────────────────────────────

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      
      client.disconnect();
      return;
    }

    try {

      const secret =this.configService.get<string>('JWT_SECRET');
        // this.configService.get<string>('JWT_REFRESH_SECRET') ||

      const payload = await this.jwtService.verifyAsync(token, { secret });
      
      // if (payload.sessionId) {

      //   const session = await this.sessionService.findSession(
      //     payload.sessionId,
      //   );
      //   if (!session || (session as any).revokedAt) {
      //     client.disconnect();
      //     return;
      //   }
      // }

      const userId = payload.sub as string;
      const username = payload.username as string | undefined;

      client.data.user = { userId, username };

      const presence = await this.presenceService.setUserOnline(
        userId,
        client.id,
        username,
      );
      // Notify others that this user is online
      client.broadcast.emit('presence:update', {
        userId,
        status: 'online',
        lastSeen: presence.lastSeen,
      });

      this.logger.log(`User ${userId} online (socket ${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const result = await this.presenceService.setUserOffline(client.id);

    if (result.userId && result.wentOffline) {
      this.server.emit('presence:update', {
        userId: result.userId,
        status: 'offline',
        lastSeen: result.lastSeen,
      });
      this.logger.log(`User ${result.userId} offline`);
    }
  }

  // ───────────────────────────── Heartbeat ─────────────────────────────

  @SubscribeMessage('presence:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) return { success: false };

    await this.presenceService.heartbeat(userId, client.id);
    return { success: true };
  }

  // ───────────────────────────── Query presence ─────────────────────────────

  @SubscribeMessage('presence:get')
  async handleGetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (!client.data.user?.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const presence = await this.presenceService.getUserPresence(data.userId);
    return { success: true, presence };
  }

  @SubscribeMessage('presence:getMany')
  async handleGetMany(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userIds: string[] },
  ) {
    if (!client.data.user?.userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const list = await this.presenceService.getManyPresences(
      data.userIds || [],
    );
    return { success: true, presences: list };
  }

  // ───────────────────────────── Conversation online list ─────────────────────────────

  @SubscribeMessage('presence:joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data?.conversationId) {
      return { success: false };
    }

    await this.presenceService.joinConversationOnline(
      data.conversationId,
      userId,
    );

    const online = await this.presenceService.getConversationOnlineUsers(
      data.conversationId,
    );

    // Tell others in the conversation room
    client.to(`conversation:${data.conversationId}`).emit('presence:chat', {
      conversationId: data.conversationId,
      onlineUserIds: online,
    });

    return { success: true, onlineUserIds: online };
  }

  @SubscribeMessage('presence:leaveChat')
  async handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data?.conversationId) {
      return { success: false };
    }

    await this.presenceService.leaveConversationOnline(
      data.conversationId,
      userId,
    );

    const online = await this.presenceService.getConversationOnlineUsers(
      data.conversationId,
    );

    client.to(`conversation:${data.conversationId}`).emit('presence:chat', {
      conversationId: data.conversationId,
      onlineUserIds: online,
    });

    return { success: true };
  }

  // ───────────────────────────── Typing (Redis TTL) ─────────────────────────────

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data?.conversationId) return;

    await this.presenceService.setTyping(data.conversationId, userId, true);

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
    const userId = client.data.user?.userId;
    if (!userId || !data?.conversationId) return;

    await this.presenceService.setTyping(data.conversationId, userId, false);

    client.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId,
      isTyping: false,
    });
  }
}
