import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  PRESENCE_KEYS,
  PRESENCE_TTL,
  PresenceStatus,
} from './presence.constants';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: number; // unix ms
  socketIds: string[];
}

@Injectable()
export class PresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.connect().catch((err) => {
      this.logger.error(`Redis connection failed: ${err.message}`);
    });

    this.redis.on('connect', () => this.logger.log('Redis connected'));
    this.redis.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // ───────────────────────────── User Online / Offline ─────────────────────────────

  /**
   * Call on socket connect.
   * Supports multiple sockets per user (multi-tab).
   */
  async setUserOnline(
    userId: string,
    socketId: string,
    username?: string,
  ): Promise<UserPresence> {
    const now = Date.now();
    const pipeline = this.redis.pipeline();

    // Reverse map socket → user
    pipeline.set(
      PRESENCE_KEYS.socket(socketId),
      userId,
      'EX',
      PRESENCE_TTL.USER * 2,
    );

    // Add socket to user's set
    pipeline.sadd(PRESENCE_KEYS.userSockets(userId), socketId);
    pipeline.expire(PRESENCE_KEYS.userSockets(userId), PRESENCE_TTL.USER * 2);

    // User hash
    pipeline.hset(PRESENCE_KEYS.user(userId), {
      status: 'online',
      lastSeen: String(now),
      ...(username ? { username } : {}),
    });
    pipeline.expire(PRESENCE_KEYS.user(userId), PRESENCE_TTL.USER * 2);

    await pipeline.exec();

    const socketIds = await this.redis.smembers(
      PRESENCE_KEYS.userSockets(userId),
    );

    return {
      userId,
      status: 'online',
      lastSeen: now,
      socketIds,
    };
  }

  /**
   * Call on socket disconnect.
   * Only marks offline when the LAST socket is gone.
   */
  async setUserOffline(socketId: string): Promise<{
    userId: string | null;
    wentOffline: boolean;
    lastSeen: number;
  }> {
    const userId = await this.redis.get(PRESENCE_KEYS.socket(socketId));
    if (!userId) {
      return { userId: null, wentOffline: false, lastSeen: Date.now() };
    }

    const pipeline = this.redis.pipeline();
    pipeline.srem(PRESENCE_KEYS.userSockets(userId), socketId);
    pipeline.del(PRESENCE_KEYS.socket(socketId));
    await pipeline.exec();

    const remaining = await this.redis.scard(
      PRESENCE_KEYS.userSockets(userId),
    );
    const now = Date.now();

    if (remaining === 0) {
      // Last socket → offline
      await this.redis.hset(PRESENCE_KEYS.user(userId), {
        status: 'offline',
        lastSeen: String(now),
      });
      // Keep lastSeen for a while (e.g. 7 days) – optional longer TTL
      await this.redis.expire(PRESENCE_KEYS.user(userId), 60 * 60 * 24 * 7);

      return { userId, wentOffline: true, lastSeen: now };
    }

    // Still has other sockets → stay online, just refresh TTL
    await this.redis.expire(PRESENCE_KEYS.user(userId), PRESENCE_TTL.USER * 2);
    await this.redis.expire(
      PRESENCE_KEYS.userSockets(userId),
      PRESENCE_TTL.USER * 2,
    );

    return { userId, wentOffline: false, lastSeen: now };
  }

  /**
   * Heartbeat – refresh TTLs so user stays online
   */
  async heartbeat(userId: string, socketId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.expire(PRESENCE_KEYS.socket(socketId), PRESENCE_TTL.USER * 2);
    pipeline.expire(PRESENCE_KEYS.userSockets(userId), PRESENCE_TTL.USER * 2);
    pipeline.expire(PRESENCE_KEYS.user(userId), PRESENCE_TTL.USER * 2);
    pipeline.hset(PRESENCE_KEYS.user(userId), 'lastSeen', String(Date.now()));
    await pipeline.exec();
  }

  // ───────────────────────────── Read status ─────────────────────────────

  async getUserPresence(userId: string): Promise<UserPresence> {
    const [hash, socketIds] = await Promise.all([
      this.redis.hgetall(PRESENCE_KEYS.user(userId)),
      this.redis.smembers(PRESENCE_KEYS.userSockets(userId)),
    ]);

    if (!hash || !hash.status) {
      return {
        userId,
        status: 'offline',
        lastSeen: 0,
        socketIds: [],
      };
    }

    return {
      userId,
      status: (hash.status as PresenceStatus) || 'offline',
      lastSeen: Number(hash.lastSeen) || 0,
      socketIds: socketIds || [],
    };
  }

  async getManyPresences(userIds: string[]): Promise<UserPresence[]> {
    if (!userIds.length) return [];
    return Promise.all(userIds.map((id) => this.getUserPresence(id)));
  }

  async isOnline(userId: string): Promise<boolean> {
    const status = await this.redis.hget(PRESENCE_KEYS.user(userId), 'status');
    return status === 'online';
  }

  /**
   * Get one of the user's socketIds (for direct emit, e.g. call signaling)
   */
  async getSocketId(userId: string): Promise<string | null> {
    const sockets = await this.redis.smembers(
      PRESENCE_KEYS.userSockets(userId),
    );
    return sockets[0] || null;
  }

  async getUserIdBySocket(socketId: string): Promise<string | null> {
    return this.redis.get(PRESENCE_KEYS.socket(socketId));
  }

  // ───────────────────────────── Conversation presence ─────────────────────────────

  async joinConversationOnline(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const key = PRESENCE_KEYS.conversationOnline(conversationId);
    await this.redis.sadd(key, userId);
    // No long TTL needed – cleaned on leave / disconnect
    await this.redis.expire(key, 60 * 60 * 24); // safety
  }

  async leaveConversationOnline(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.redis.srem(
      PRESENCE_KEYS.conversationOnline(conversationId),
      userId,
    );
  }

  async getConversationOnlineUsers(
    conversationId: string,
  ): Promise<string[]> {
    return this.redis.smembers(
      PRESENCE_KEYS.conversationOnline(conversationId),
    );
  }

  // ───────────────────────────── Typing (Redis-backed) ─────────────────────────────

  async setTyping(
    conversationId: string,
    userId: string,
    isTyping: boolean,
  ): Promise<void> {
    const key = PRESENCE_KEYS.typing(conversationId, userId);
    if (isTyping) {
      await this.redis.set(key, '1', 'EX', PRESENCE_TTL.TYPING);
    } else {
      await this.redis.del(key);
    }
  }

  async isTyping(conversationId: string, userId: string): Promise<boolean> {
    const val = await this.redis.get(
      PRESENCE_KEYS.typing(conversationId, userId),
    );
    return val === '1';
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  getRedisClient(): Redis {
    return this.redis;
  }
}
