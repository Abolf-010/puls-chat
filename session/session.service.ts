import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schmas/session.schma';

@Injectable()
export class SessionService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async createSession(
    userId: string,
    refreshTokenHash: string,
    expiersAt: Date,
    device?: string,
    userAgent?: string,
  ) {
    return this.sessionModel.create({
      userId,
      refreshTokenHash,
      expiersAt,
      device,
      userAgent,
    });
  }

  async updateRefreshTokenHash(sessionId: string, refreshTokenHash: string) {
    return this.sessionModel.findByIdAndUpdate(
      sessionId,
      { refreshTokenHash },
      { new: true },
    );
  }

  async findSession(sessionId: string) {
    return this.sessionModel.findById(sessionId);
  }

  /**
   * Revoke one session. Previous bug:
   * - used findByIdAndUpdate with a filter object (wrong API)
   * - required revokedAt: { $exists: true } so ONLY already-revoked sessions matched
   */
  async recokeSession(sessionId: string, userId: string) {
    if (!sessionId || !userId) return null;
    const id =
      typeof sessionId === 'string' && Types.ObjectId.isValid(sessionId)
        ? new Types.ObjectId(sessionId)
        : sessionId;

    return this.sessionModel.findOneAndUpdate(
      {
        _id: id,
        userId: String(userId),
        $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
      },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
  }

  /** Alias with correct spelling */
  async revokeSession(sessionId: string, userId: string) {
    return this.recokeSession(sessionId, userId);
  }

  async revokeAllSessions(userId: string) {
    return this.sessionModel.updateMany(
      {
        userId: String(userId),
        $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
      },
      { $set: { revokedAt: new Date() } },
    );
  }

  async getUserSession(userId: string) {
    return this.sessionModel
      .find({
        userId: String(userId),
        $or: [{ revokedAt: null }, { revokedAt: { $exists: false } }],
      })
      .select('-refreshTokenHash')
      .sort({ createdAt: -1 });
  }
}
