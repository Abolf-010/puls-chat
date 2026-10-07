import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CallLogDocument = CallLog & Document;

/** Final outcome of a call session */
export type CallLogStatus =
  | 'completed'
  | 'rejected'
  | 'missed'
  | 'cancelled'
  | 'failed';

@Schema({ timestamps: true, collection: 'call_logs' })
export class CallLog {
  @Prop({ required: true, index: true })
  callId!: string;

  @Prop({ required: true, index: true })
  callerId!: string;

  @Prop({ required: true, index: true })
  receiverId!: string;

  @Prop({ required: true })
  status!: CallLogStatus;

  /** optional display names cached at log time */
  @Prop()
  callerName?: string;

  @Prop()
  receiverName?: string;

  @Prop()
  endedAt?: Date;

  @Prop({ default: 0 })
  durationSec?: number;
}

export const CallLogSchema = SchemaFactory.createForClass(CallLog);
CallLogSchema.index({ callerId: 1, createdAt: -1 });
CallLogSchema.index({ receiverId: 1, createdAt: -1 });
