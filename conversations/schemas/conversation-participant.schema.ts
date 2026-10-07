import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationParticipantDocument =
  HydratedDocument<ConversationParticipant>;

@Schema({ timestamps: true })
export class ConversationParticipant {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  ConversationId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ enum: ['owner', 'admin', 'member'], default: 'member' })
  role!: string;

  @Prop()
  joinedAt?: Date;

  @Prop()
  leftAt?: Date;

  @Prop()
  lastReadAt?: Date;

  @Prop()
  lastReadMessageId?: string;

  @Prop({ default: 0 })
  unreadCount!: number;

  @Prop({ default: false })
  muted!: boolean;

  @Prop({ default: false })
  pinned!: boolean;

  @Prop({ default: false })
  archived!: boolean;

  @Prop({ default: false })
  hidden!: boolean;
}

export const ConversationParticipantSchema = SchemaFactory.createForClass(
  ConversationParticipant,
);
ConversationParticipantSchema.index(
  { ConversationId: 1, userId: 1 },
  { unique: true },
);
ConversationParticipantSchema.index({ userId: 1, pinned: -1 });
