import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CallManager } from './call.manager';
import { CallLogService } from './call-log.service';
import { ActiveCall } from './call.types';
import { CallLogStatus } from './call-log.schema';

const RING_TIMEOUT_MS = 45_000;

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);
  private readonly calls = new Map<string, ActiveCall>();
  private readonly byUser = new Map<string, string>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly manager: CallManager,
    @Optional() private readonly callLog?: CallLogService,
  ) {}

  private stage(name: string, data: Record<string, unknown> = {}) {
    this.logger.log(`[CALL][SERVICE][${name}] ${JSON.stringify(data)}`);
  }

  private async saveLog(
    call: ActiveCall,
    status: CallLogStatus,
    durationSec = 0,
  ) {
    if (!this.callLog) return;
    await this.callLog.record({
      callId: call.callId,
      callerId: call.callerId,
      receiverId: call.receiverId,
      status,
      durationSec,
    });
  }

  startCall(
    callerId: string,
    receiverId: string,
  ): { success: boolean; callId?: string; reason?: string } {
    this.stage('START', { callerId, receiverId });

    if (!callerId || !receiverId) {
      return { success: false, reason: 'invalid_participants' };
    }
    if (callerId === receiverId) {
      return { success: false, reason: 'cannot_call_self' };
    }
    if (this.manager.isBusy(callerId) || this.byUser.has(callerId)) {
      return { success: false, reason: 'caller_busy' };
    }
    if (this.manager.isBusy(receiverId) || this.byUser.has(receiverId)) {
      return { success: false, reason: 'receiver_busy' };
    }

    const callId = randomUUID();
    const call: ActiveCall = {
      callId,
      callerId,
      receiverId,
      state: 'ringing',
      createdAt: Date.now(),
    };
    this.calls.set(callId, call);
    this.byUser.set(callerId, callId);
    this.byUser.set(receiverId, callId);
    this.manager.onStart(callerId, receiverId, callId);
    this.stage('START_OK', { callId, callerId, receiverId });
    return { success: true, callId };
  }

  acceptCall(
    callId: string,
    userId: string,
  ): { success: boolean; call?: ActiveCall; reason?: string } {
    this.stage('ACCEPT', { callId, userId });
    const call = this.calls.get(callId);
    if (!call) return { success: false, reason: 'not_found' };
    if (call.receiverId !== userId) {
      return { success: false, reason: 'not_receiver' };
    }
    if (call.state !== 'ringing') {
      return { success: false, reason: 'not_ringing' };
    }
    call.state = 'active';
    this.clearTimer(callId);
    this.manager.onAccept(call.callerId, call.receiverId, callId);
    this.stage('ACCEPT_OK', { callId });
    return { success: true, call };
  }

  rejectCall(
    callId: string,
    userId: string,
  ): { success: boolean; call?: ActiveCall; reason?: string } {
    this.stage('REJECT', { callId, userId });
    const call = this.calls.get(callId);
    if (!call) return { success: false, reason: 'not_found' };
    if (call.receiverId !== userId && call.callerId !== userId) {
      return { success: false, reason: 'forbidden' };
    }
    const snapshot = { ...call };
    void this.saveLog(snapshot, 'rejected');
    this.remove(callId, 'rejected');
    return { success: true, call: snapshot };
  }

  endCall(
    callId: string,
    userId?: string,
  ): { success: boolean; call?: ActiveCall; reason?: string } {
    this.stage('END', { callId, userId });
    const call = this.calls.get(callId);
    if (!call) return { success: false, reason: 'not_found' };
    if (
      userId &&
      call.callerId !== userId &&
      call.receiverId !== userId
    ) {
      return { success: false, reason: 'forbidden' };
    }
    const snapshot = { ...call };
    const durationSec =
      call.state === 'active'
        ? Math.max(0, Math.floor((Date.now() - call.createdAt) / 1000))
        : 0;
    const status: CallLogStatus =
      call.state === 'active' ? 'completed' : 'cancelled';
    void this.saveLog(snapshot, status, durationSec);
    this.remove(callId, 'ended');
    return { success: true, call: snapshot };
  }

  /** Used by ring timeout */
  async missCall(callId: string) {
    const call = this.calls.get(callId);
    if (!call || call.state !== 'ringing') return;
    await this.saveLog(call, 'missed');
    this.remove(callId, 'timeout');
  }

  getCall(callId: string): ActiveCall | undefined {
    return this.calls.get(callId);
  }

  getCallForUser(userId: string): ActiveCall | undefined {
    const id = this.byUser.get(userId);
    return id ? this.calls.get(id) : undefined;
  }

  markConnected(callId: string): void {
    const call = this.calls.get(callId);
    if (!call || call.state !== 'active') return;
    this.manager.onConnected(call.callerId, call.receiverId, callId);
  }

  scheduleRingTimeout(
    callId: string,
    onTimeout: (callId: string) => void | Promise<void>,
  ): void {
    this.clearTimer(callId);
    const t = setTimeout(() => {
      void (async () => {
        const call = this.calls.get(callId);
        if (call && call.state === 'ringing') {
          this.stage('TIMEOUT', { callId });
          await this.missCall(callId);
          await onTimeout(callId);
        }
      })();
    }, RING_TIMEOUT_MS);
    this.timers.set(callId, t);
  }

  private remove(callId: string, reason: string): void {
    const call = this.calls.get(callId);
    if (!call) return;
    call.state = 'ended';
    this.byUser.delete(call.callerId);
    this.byUser.delete(call.receiverId);
    this.calls.delete(callId);
    this.clearTimer(callId);
    this.manager.onClear(call.callerId, call.receiverId, reason);
    this.stage('REMOVED', { callId, reason });
  }

  private clearTimer(callId: string): void {
    const t = this.timers.get(callId);
    if (t) clearTimeout(t);
    this.timers.delete(callId);
  }
}
