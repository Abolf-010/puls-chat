import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { userService } from './user.service';
import { createUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from 'auth/jwt-auth.guard';

const uploadsDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

const avatarUpload = FileInterceptor('avatar', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = extname(file.originalname || '') || '.jpg';
      cb(null, `avatar-${randomUUID().replace(/-/g, '')}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      cb(null, false);
      return;
    }
    cb(null, true);
  },
});

@Controller('users')
export class UserController {
  constructor(private readonly userService: userService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    const userId = String(req.user?.userId || req.user?.sub || '');
    const fromDb = userId
      ? await this.userService.findPublicByUserId(userId)
      : null;
    return {
      user: {
        userId,
        username: fromDb?.username || req.user?.username || '',
        displayName:
          fromDb?.displayName ||
          req.user?.displayName ||
          fromDb?.username ||
          '',
        profilePic: fromDb?.profilePic || null,
        bio: fromDb?.bio || '',
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async list(@Req() req: any, @Query('q') q?: string) {
    const selfId = String(req.user?.userId || req.user?.sub || '');
    const items = await this.userService.listUsers(selfId, q);
    return { success: true, items };
  }

  @Get('check-username')
  async checkUsername(@Query('u') u?: string) {
    return this.userService.isUsernameAvailable(u || '');
  }

  @Post('register')
  @UseInterceptors(avatarUpload)
  register(
    @Body() data: createUserDto,
    @UploadedFile() file?: { filename?: string },
  ) {
    const profilePic = file?.filename
      ? `/uploads/${file.filename}`
      : data.profilePic || '';
    return this.userService.register({ ...data, profilePic });
  }

  /** S3 — edit own profile (displayName, bio, optional new avatar) */
  @UseGuards(JwtAuthGuard)
  @Post('password')
  async changePassword(
    @Req() req: any,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const userId = String(req.user?.userId || req.user?.sub || '');
    return this.userService.changePassword(
      userId,
      body.currentPassword || '',
      body.newPassword || '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @UseInterceptors(avatarUpload)
  async updateProfile(
    @Req() req: any,
    @Body() body: { displayName?: string; bio?: string },
    @UploadedFile() file?: { filename?: string },
  ) {
    const userId = String(req.user?.userId || req.user?.sub || '');
    const profilePic = file?.filename ? `/uploads/${file.filename}` : undefined;
    return this.userService.updateProfile(userId, {
      displayName: body.displayName,
      bio: body.bio,
      profilePic,
    });
  }
}
