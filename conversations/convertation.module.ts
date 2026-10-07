import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import {
  ConversationParticipant,
  ConversationParticipantSchema,
} from './schemas/conversation-participant.schema';
import { User, UserSchema } from 'users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: User.name, schema: UserSchema },
      {
        name: ConversationParticipant.name,
        schema: ConversationParticipantSchema,
      },
    ]),
  ],
  providers: [ConversationService],
  controllers: [ConversationController],
  exports: [ConversationService, MongooseModule],
})
export class ConversationModule {}
