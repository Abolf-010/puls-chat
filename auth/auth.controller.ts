import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { loginService } from './auth.service';
import { loginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: loginService) {}

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.refreshToken ||
      (req.body && (req.body as any).refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const b = await this.authService.refresh(refreshToken);
    res.cookie('refreshToken', b.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth',
    });
    return b;
  }

  @Post('login')
  async login(@Body() data: loginDto, @Res() res: Response) {
    const a = await this.authService.login(data);
    res.cookie('refreshToken', a.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/auth',
    });
    res.send(a);
    return a;
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Body() data: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      data?.refreshToken || req.cookies?.refreshToken || '';
    if (refreshToken) {
      try {
        await this.authService.logout(refreshToken);
      } catch {
        /* still clear client cookie */
      }
    }
    res.clearCookie('refreshToken', { path: '/auth' });
    res.clearCookie('refreshToken', { path: '/' });
    return { message: 'logged out successfully' };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req: any) {
    return this.authService.logoutAll(req.user.userId);
  }

  /** Revoke one session by id */
  @Post('logout-session')
  @UseGuards(JwtAuthGuard)
  async logoutSession(
    @Req() req: any,
    @Body() body: { sessionId?: string },
  ) {
    const sessionId = String(body?.sessionId || '');
    if (!sessionId) {
      throw new UnauthorizedException('sessionId required');
    }
    return this.authService.logoutSession(req.user.userId, sessionId);
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  async getSessinos(@Req() req: any) {
    return this.authService.getSessions(req.user.userId);
  }
}
