import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateMessageDto, EditMessageDto } from './dto/create-message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get(':conversationId')
  async getMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messageService.getMessages(
      req.user.userId,
      conversationId,
      limit ? parseInt(limit, 10) : 50,
      cursor,
    );
  }

  @Post()
  async createMessage(@Req() req: any, @Body() dto: CreateMessageDto) {
    const message = await this.messageService.createMessage(
      req.user.userId,
      dto.conversationId,
      dto.content,
      dto.type || 'text',
      dto.replyToMessageId,
      dto.clientMessageId,
    );
    return { message };
  }

  @Patch('edit')
  async editMessage(@Req() req: any, @Body() dto: EditMessageDto) {
    const message = await this.messageService.editMessage(
      req.user.userId,
      dto.messageId,
      dto.content,
    );
    return { message };
  }

  @Post('delete')
  async deleteMessage(
    @Req() req: any,
    @Body() body: { messageId: string },
  ) {
    const message = await this.messageService.deleteMessage(
      req.user.userId,
      body.messageId,
    );
    
    return { message };
  }
}
