import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, enum: ['direct', 'group'] })
  type!: string;

  @Prop()
  title?: string;

  @Prop({ required: true })
  createdBy!: string;

  @Prop()
  lastMessageId?: string;

  @Prop()
  lastMessageText?: string;

  @Prop()
  lastMessageType?: string;

  @Prop()
  lastMessageAt?: Date;

  @Prop()
  lastMessageSenderId?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ lastMessageAt: -1 });
