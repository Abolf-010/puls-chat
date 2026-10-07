import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from 'auth/jwt-auth.guard';
import {
  CreateConversationDto,
  ConversationFlagsDto,
  ListConversationsDto,
  ParticipantDto,
} from './dto/create-converstaion.dto';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() data: CreateConversationDto) {
    const userId = req.user.userId;
    if (
      data.type === 'group' ||
      (data.participantIds && data.participantIds.length)
    ) {
      return this.conversationService.createGroupConversation(
        userId,
        data.participantIds ||
          (data.participantId ? [data.participantId] : []),
        data.title,
      );
    }
    if (!data.participantId) {
      return { error: 'participantId required for direct chat' };
    }
    return this.conversationService.createDirectConversation(
      userId,
      data.participantId,
    );
  }

  @Post('get')
  @UseGuards(JwtAuthGuard)
  async get(@Req() req: any, @Body() body: ListConversationsDto) {
    return this.conversationService.getConversation(req.user.userId, {
      cursor: body?.cursor,
      limit: body?.limit ? Number(body.limit) : 30,
      archived: body?.archived,
    });
  }

  @Post('participant/add')
  @UseGuards(JwtAuthGuard)
  async addParticipant(@Req() req: any, @Body() dto: ParticipantDto) {
    return this.conversationService.addParticipant(
      req.user.userId,
      dto.conversationId,
      dto.userId,
    );
  }

  @Post('participant/remove')
  @UseGuards(JwtAuthGuard)
  async removeParticipant(@Req() req: any, @Body() dto: ParticipantDto) {
    return this.conversationService.removeParticipant(
      req.user.userId,
      dto.conversationId,
      dto.userId,
    );
  }

  @Post('flags')
  @UseGuards(JwtAuthGuard)
  async flags(@Req() req: any, @Body() dto: ConversationFlagsDto) {
    return this.conversationService.setFlags(
      req.user.userId,
      dto.conversationId,
      dto,
    );
  }

  @Post('read')
  @UseGuards(JwtAuthGuard)
  async markRead(
    @Req() req: any,
    @Body() body: { conversationId: string; lastMessageId?: string },
  ) {
    await this.conversationService.resetUnread(
      req.user.userId,
      body.conversationId,
      body.lastMessageId,
    );
    return { success: true };
  }

  @Post('members')
  @UseGuards(JwtAuthGuard)
  async members(@Req() req: any, @Body() body: { conversationId: string }) {
    if (!body?.conversationId) {
      return { error: 'conversationId required' };
    }
    return this.conversationService.getMembers(
      req.user.userId,
      body.conversationId,
    );
  }

}
