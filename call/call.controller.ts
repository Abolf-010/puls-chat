import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallLogService } from './call-log.service';

@Controller('calls')
export class CallController {
  constructor(private readonly callService: CallLogService) {}

  @Get('logs')
  @UseGuards(AuthGuard('jwt'))
  async logs(@Req() req: any, @Query('limit') limit?: string) {
    const userId = String(req.user?.userId || req.user?.sub || '');
    const n = Math.min(100, Math.max(1, Number(limit) || 50));
    const items = await this.callService.listForUser(userId, n);
    return { success: true, items };
  }
}
