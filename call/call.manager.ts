import { Injectable, Logger } from '@nestjs/common';
import { UserCallEntry, UserCallPhase } from './call.types';

/**
 * Tracks per-user call phase for quick lookups (busy / UI).
 * Does NOT own call lifecycle — CallService does.
 * Gateway / Service should call these hooks in sync with CallService.
 */
@Injectable()
export class CallManager {
  private readonly logger = new Logger(CallManager.name);
  private readonly users = new Map<string, UserCallEntry>();

  private log(stage: string, data: Record<string, unknown> = {}) {
    this.logger.log(`[CALL][MANAGER][${stage}] ${JSON.stringify(data)}`);
  }

  get(userId: string): UserCallEntry | undefined {
    return this.users.get(String(userId));
  }

  getPhase(userId: string): UserCallPhase {
    return this.users.get(String(userId))?.phase ?? 'idle';
  }

  isBusy(userId: string): boolean {
    const phase = this.getPhase(userId);
    const busy =
      phase === 'calling' ||
      phase === 'ringing' ||
      phase === 'connecting' ||
      phase === 'in_call';
    this.log('IS_BUSY', { userId, phase, busy });
    return busy;
  }

  setPhase(
    userId: string,
    phase: UserCallPhase,
    meta?: { callId?: string; peerId?: string },
  ): void {
    const id = String(userId);
    const prev = this.users.get(id);
    const entry: UserCallEntry = {
      userId: id,
      phase,
      callId: meta?.callId ?? (phase === 'idle' ? undefined : prev?.callId),
      peerId: meta?.peerId ?? (phase === 'idle' ? undefined : prev?.peerId),
      updatedAt: Date.now(),
    };
    if (phase === 'idle') {
      this.users.delete(id);
    } else {
      this.users.set(id, entry);
    }
    this.log('SET_PHASE', {
      userId: id,
      from: prev?.phase ?? 'idle',
      to: phase,
      callId: entry.callId,
      peerId: entry.peerId,
    });
  }

  /** Caller starts dialing */
  onStart(callerId: string, receiverId: string, callId: string): void {
    this.log('ON_START', { callerId, receiverId, callId });
    this.setPhase(callerId, 'calling', { callId, peerId: receiverId });
    this.setPhase(receiverId, 'ringing', { callId, peerId: callerId });
  }

  /** Receiver accepted */
  onAccept(callerId: string, receiverId: string, callId: string): void {
    this.log('ON_ACCEPT', { callerId, receiverId, callId });
    this.setPhase(callerId, 'connecting', { callId, peerId: receiverId });
    this.setPhase(receiverId, 'connecting', { callId, peerId: callerId });
  }

  /** WebRTC up (optional — call when ICE connected if you wire it later) */
  onConnected(callerId: string, receiverId: string, callId: string): void {
    this.log('ON_CONNECTED', { callerId, receiverId, callId });
    this.setPhase(callerId, 'in_call', { callId, peerId: receiverId });
    this.setPhase(receiverId, 'in_call', { callId, peerId: callerId });
  }

  /** Reject / end / timeout / disconnect */
  onClear(userA: string, userB?: string, reason?: string): void {
    this.log('ON_CLEAR', { userA, userB, reason });
    this.setPhase(userA, 'idle');
    if (userB) this.setPhase(userB, 'idle');
  }

  /** Snapshot for debugging */
  listAll(): UserCallEntry[] {
    const all = Array.from(this.users.values());
    this.log('LIST_ALL', { count: all.length, users: all });
    return all;
  }
}
