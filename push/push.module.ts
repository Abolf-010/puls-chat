import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  PushSubscriptionEntity,
  PushSubscriptionSchema,
} from './push-subscription.schema';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      {
        name: PushSubscriptionEntity.name,
        schema: PushSubscriptionSchema,
      },
    ]),
  ],
  providers: [PushService],
  controllers: [PushController],
  exports: [PushService],
})
export class PushModule {}
