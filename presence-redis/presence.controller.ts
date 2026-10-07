import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('presence')
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  /**
   * GET /presence/:userId
   */
  @Get(':userId')
  async getOne(@Param('userId') userId: string) {
    const presence = await this.presenceService.getUserPresence(userId);
    return { presence };
  }

  /**
   * GET /presence?ids=id1,id2,id3
   */
  @Get()
  async getMany(@Query('ids') ids?: string) {
    const userIds = (ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const presences = await this.presenceService.getManyPresences(userIds);
    return { presences };
  }
}
