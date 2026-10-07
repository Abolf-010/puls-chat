import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { CallLog, CallLogDocument, CallLogStatus } from './call-log.schema';

@Injectable()
export class CallLogService {
  private readonly logger = new Logger(CallLogService.name);

  constructor(
    @InjectModel(CallLog.name)
    private readonly model: Model<CallLogDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private usersCol() {

    const names = ['users', 'user', 'Users'];
    for (const n of names) {
      try {
        return this.connection.collection(n);
      } catch {
        /* try next */
      }
    }
    return this.connection.collection('users');
  }

  private async resolveUsernames(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const unique = [...new Set(ids.map(String).filter(Boolean))];
    if (!unique.length) return map;
    try {
      const col = this.usersCol();
      const objectIds = unique.filter((id) => /^[a-f\d]{24}$/i.test(id));
      const query: any = {
        $or: [{ userId: { $in: unique } }],
      };
      if (objectIds.length) {
        const { Types } = await import('mongoose');
        query.$or.push({
          _id: { $in: objectIds.map((id) => new Types.ObjectId(id)) },
        });
      }
      const users = await col
        .find(query, {
          projection: { userId: 1, username: 1, name: 1, displayName: 1 },
        })
        .toArray();
      for (const u of users || []) {
        const label =
          (u as any).username ||
          (u as any).displayName ||
          (u as any).name ||
          '';
        if (!label) continue;
        if ((u as any).userId) map.set(String((u as any).userId), String(label));
        if ((u as any)._id) map.set(String((u as any)._id), String(label));
      }
    } catch (e: any) {
    }
    return map;
  }

  async record(input: {
    callId: string;
    callerId: string;
    receiverId: string;
    status: CallLogStatus;
    callerName?: string;
    receiverName?: string;
    durationSec?: number;
  }) {
    try {
      const names = await this.resolveUsernames([
        input.callerId,
        input.receiverId,
      ]);
      const callerName =
        input.callerName ||
        names.get(String(input.callerId)) ||
        String(input.callerId);
      const receiverName =
        input.receiverName ||
        names.get(String(input.receiverId)) ||
        String(input.receiverId);

      await this.model.findOneAndUpdate(
        { callId: input.callId },
        {
          $set: {
            callerId: String(input.callerId),
            receiverId: String(input.receiverId),
            status: input.status,
            callerName,
            receiverName,
            durationSec: input.durationSec ?? 0,
            endedAt: new Date(),
          },
          $setOnInsert: { callId: input.callId },
        },
        { upsert: true, new: true },
      );
      this.logger.log(
        `[CALL][LOG] ${input.callId} ${input.status} ${callerName}->${receiverName}`,
      );
    } catch (e: any) {
    }
  }

  async listForUser(userId: string, limit = 50) {
    const uid = String(userId);
    const rows = await this.model
      .find({ $or: [{ callerId: uid }, { receiverId: uid }] })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const peerIds = (rows as any[]).map((r) =>
      String(r.callerId) === uid ? r.receiverId : r.callerId,
    );
    const names = await this.resolveUsernames(peerIds);

    return (rows as any[]).map((r) => {
      const isCaller = String(r.callerId) === uid;
      const peerId = String(isCaller ? r.receiverId : r.callerId);
      let peerName = isCaller ? r.receiverName : r.callerName;
      if (!peerName || peerName === peerId) {
        peerName = names.get(peerId) || peerId;
      }

      let type: 'i' | 'o' | 'm' = 'o';
      if (!isCaller && (r.status === 'missed' || r.status === 'rejected')) {
        type = 'm';
      } else if (!isCaller) {
        type = 'i';
      } else {
        type = 'o';
      }

      const when = r.endedAt || r.createdAt || new Date();
      return {
        name: String(peerName),
        imgSrc: 'assets/static/image/wallpaperflare.com_wallpaper (4).jpg',
        LMET: formatTime(when),
        type,
        peerId,
        callId: r.callId,
        status: r.status,
        createdAt: when,
      };
    });
  }
}

function formatTime(d: Date | string) {
  const dt = new Date(d);
  return (
    String(dt.getHours()).padStart(2, '0') +
    ':' +
    String(dt.getMinutes()).padStart(2, '0')
  );
}
