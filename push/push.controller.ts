import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** No auth — client needs public key before subscribe */
  @Get('vapid-public-key')
  getPublicKey() {
    return {
      publicKey: this.pushService.getPublicKey(),
      enabled: this.pushService.isEnabled(),
    };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req: any, @Body() dto: SubscribePushDto) {
    return this.pushService.saveSubscription(req.user.userId, {
      endpoint: dto.endpoint,
      keys: dto.keys,
      userAgent: dto.userAgent,
    });
  }

  @Post('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Req() req: any, @Body() dto: UnsubscribePushDto) {
    return this.pushService.removeSubscription(req.user.userId, dto.endpoint);
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: any) {
    const items = await this.pushService.listUserEndpoints(req.user.userId);
    return { subscriptions: items };
  }
}
