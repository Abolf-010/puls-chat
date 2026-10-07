import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallLogService } from './call-log.service';

@Controller('calls')
export class CallLogController {
  constructor(private readonly callLogService: CallLogService) {}

  /** GET /calls/logs?limit=50 */
  @UseGuards(AuthGuard('jwt'))
  @Get('logs')
  async logs(@Req() req: any, @Query('limit') limit?: string) {
    const userId = String(req.user?.userId || req.user?.sub || '');
    const n = Math.min(100, Math.max(1, Number(limit) || 50));
    const items = await this.callLogService.listForUser(userId, n);
    return { success: true, items };
  }
}
