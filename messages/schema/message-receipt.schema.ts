import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageReceiptDocument = HydratedDocument<MessageReceipt>;

@Schema({ timestamps: true })
export class MessageReceipt {
  @Prop({ required: true, index: true })
  messageId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  readAt?: Date;
}

export const MessageReceiptSchema = SchemaFactory.createForClass(MessageReceipt);

MessageReceiptSchema.index(
  { messageId: 1, userId: 1 },
  { unique: true },
);
