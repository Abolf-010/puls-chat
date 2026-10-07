import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Message, MessageSchema } from './schema/message.schema';
import {
  MessageReceipt,
  MessageReceiptSchema,
} from './schema/message-receipt.schema';
import {
  ConversationParticipant,
  ConversationParticipantSchema,
} from '../conversations/schemas/conversation-participant.schema';
import {
  Conversation,
  ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { UploadController } from './upload.controller';
import { PushModule } from 'push/push.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: MessageReceipt.name, schema: MessageReceiptSchema },
      {
        name: ConversationParticipant.name,
        schema: ConversationParticipantSchema,
      },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    PushModule
  ],
  providers: [MessageService, MessageGateway],
  controllers: [MessageController, UploadController],
  exports: [MessageService],
})
export class MessageModule {}
