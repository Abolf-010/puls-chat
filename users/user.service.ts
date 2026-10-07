import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { User, UserDocument } from './schemas/user.schema';
import { createUserDto } from './dto/create-user.dto';

const RESERVED = new Set([
  'admin',
  'support',
  'system',
  'me',
  'root',
  'null',
  'undefined',
  'api',
  'help',
]);

@Injectable()
export class userService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  normalizeUsername(raw: string): string {
    return String(raw || '')
      .trim()
      .toLowerCase();
  }

  validateUsernameFormat(username: string) {
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      throw new BadRequestException(
        'Username must be 3–24 characters: a-z, 0-9, underscore',
      );
    }
    if (RESERVED.has(username)) {
      throw new BadRequestException('This username is reserved');
    }
  }

  async isUsernameAvailable(raw: string): Promise<{ available: boolean; username: string }> {
    const username = this.normalizeUsername(raw);
    if (!username || !/^[a-z0-9_]{3,24}$/.test(username) || RESERVED.has(username)) {
      return { available: false, username };
    }
    const exists = await this.userModel.exists({ username });
    return { available: !exists, username };
  }

  async listUsers(excludeUserId: string, q?: string) {
    const filter: any = {};
    if (excludeUserId) {
      filter.userId = { $ne: String(excludeUserId) };
    }
    if (q && String(q).trim()) {
      const qq = String(q).trim();
      filter.$or = [
        { username: { $regex: qq, $options: 'i' } },
        { displayName: { $regex: qq, $options: 'i' } },
      ];
    }
    const rows = await this.userModel
      .find(filter)
      .select('userId username displayName profilePic bio')
      .sort({ username: 1 })
      .limit(100)
      .lean()
      .exec();
    return (rows || []).map((u: any) => ({
      userId: String(u.userId),
      username: String(u.username || u.userId),
      displayName: String(u.displayName || u.username || u.userId),
      profilePic: u.profilePic || null,
      bio: u.bio || '',
    }));
  }

  async findPublicByUserId(userId: string) {
    const u = await this.userModel
      .findOne({ userId })
      .select('userId username displayName profilePic bio')
      .lean();
    if (!u) return null;
    return {
      userId: (u as any).userId,
      username: (u as any).username || '',
      displayName: (u as any).displayName || (u as any).username || '',
      profilePic: (u as any).profilePic || null,
      bio: (u as any).bio || '',
    };
  }

  async register(data: createUserDto) {
    const username = this.normalizeUsername(data.username || data.userName || '');
    if (!username) {
      throw new BadRequestException('Username is required');
    }
    this.validateUsernameFormat(username);

    let displayName = String(data.displayName || '').trim();
    if (!displayName) {
      displayName = username;
    }
    if (displayName.length > 40) {
      throw new BadRequestException('Display name is too long');
    }

    const exists = await this.userModel.exists({ username });
    if (exists) {
      throw new ConflictException('Username already taken');
    }

    if (!data.password || data.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passHash = await argon2.hash(data.password);

    const user = await this.userModel.create({
      userId: randomUUID().replace(/-/g, ''),
      username,
      displayName,
      password: passHash,
      profilePic: data.profilePic || '',
      bio: data.bio || '',
    });

    return {
      success: true,
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      userName: user.username, // legacy alias
    };
  }

  async updateProfile(
    userId: string,
    data: { displayName?: string; bio?: string; profilePic?: string },
  ) {
    const user = await this.userModel.findOne({ userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (data.displayName != null) {
      const dn = String(data.displayName).trim();
      if (!dn || dn.length > 40) {
        throw new BadRequestException('Invalid display name');
      }
      user.displayName = dn;
    }
    if (data.bio != null) {
      user.bio = String(data.bio).slice(0, 160);
    }
    if (data.profilePic != null) {
      user.profilePic = String(data.profilePic);
    }
    await user.save();
    return {
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio || '',
        profilePic: user.profilePic || null,
      },
    };
  }


  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('New password must be at least 8 characters');
    }
    const user = await this.userModel.findOne({ userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const ok = await argon2.verify(user.password, currentPassword || '');
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.password = await argon2.hash(newPassword);
    await user.save();
    return { success: true, message: 'Password updated' };
  }

}
