/**
 * Redis key patterns for Presence system
 */
export const PRESENCE_KEYS = {
  /** Hash: status, lastSeen, username? */
  user: (userId: string) => `presence:user:${userId}`,

  /** Set of socketIds for a user (multi-device / multi-tab) */
  userSockets: (userId: string) => `presence:user:${userId}:sockets`,

  /** Reverse lookup: socketId → userId */
  socket: (socketId: string) => `presence:socket:${socketId}`,

  /** Set of online userIds inside a conversation */
  conversationOnline: (conversationId: string) =>
    `presence:chat:${conversationId}:online`,

  /** Typing indicator with short TTL */
  typing: (conversationId: string, userId: string) =>
    `presence:typing:${conversationId}:${userId}`,
} as const;

export const PRESENCE_TTL = {
  /** User considered offline after this many seconds without heartbeat */
  USER: 45,

  /** Typing indicator expires after this many seconds */
  TYPING: 5,
} as const;

export type PresenceStatus = 'online' | 'offline' | 'away';
