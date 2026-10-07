import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: true })
export class Message {
  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true, index: true })
  senderId!: string;

  @Prop({ required: true, unique: true, index: true })
  messageId!: string;

  @Prop({ index: true })
  clientMessageId?: string;

  @Prop({
    required: true,
    enum: ['text', 'image', 'file', 'audio', 'video', 'system'],
    default: 'text',
  })
  type!: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

  @Prop({ required: true })
  content!: string;

  @Prop({ index: true })
  replyToMessageId?: string;

  @Prop()
  replyPreview?: string;

  @Prop()
  editedAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversationId: 1, createdAt: -1, messageId: -1 });
MessageSchema.index(
  { senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
  },
);
