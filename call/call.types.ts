/**
 * Unified call types — CallService + CallManager + CallGateway
 */

/** State of one ActiveCall record in CallService */
export type CallState = 'ringing' | 'active' | 'ended';

/**
 * Per-user phase tracked by CallManager
 * (UI / presence style — not the same as CallState)
 */
export type UserCallPhase =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'in_call';

export interface ActiveCall {
  callId: string;
  callerId: string;
  receiverId: string;
  state: CallState;
  createdAt: number;
}

export interface UserCallEntry {
  userId: string;
  phase: UserCallPhase;
  callId?: string;
  peerId?: string;
  updatedAt: number;
}

export interface CallStartPayload {
  receiverId: string;
  conversationId?: string;
}

export interface CallIncomingPayload {
  callId: string;
  callerId: string;
  conversationId?: string;
}

export interface CallAcceptedPayload {
  callId: string;
  callerId: string;
  receiverId: string;
}

export interface CallSdpPayload {
  callId: string;
  sdp: Record<string, unknown> | RTCSessionDescriptionInit;
}

export interface CallIcePayload {
  callId: string;
  candidate: Record<string, unknown> | RTCIceCandidateInit;
}

export interface CallFailedPayload {
  reason: string;
}

export interface CallEndedPayload {
  callId: string;
  reason?: string;
}
