import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscriptionEntity>;

@Schema({ timestamps: true, collection: 'push_subscriptions' })
export class PushSubscriptionEntity {
  @Prop({ required: true, index: true })
  userId!: string;

  /** Browser push endpoint (unique per browser/profile) */
  @Prop({ required: true, unique: true })
  endpoint!: string;

  @Prop({ required: true })
  p256dh!: string;

  @Prop({ required: true })
  auth!: string;

  @Prop()
  userAgent?: string;
}

export const PushSubscriptionSchema =
  SchemaFactory.createForClass(PushSubscriptionEntity);

PushSubscriptionSchema.index({ userId: 1 });
