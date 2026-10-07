import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
} from './schemas/conversation-participant.schema';
import { User, UserDocument } from 'users/schemas/user.schema';

@Injectable()
export class ConversationService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(User.name)
    private readonly UserModel: Model<UserDocument>,
    @InjectModel(ConversationParticipant.name)
    private readonly conversationParticipantModel: Model<ConversationParticipantDocument>,
  ) {}

  private oid(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid conversationId');
    }
    return new Types.ObjectId(id);
  }

  async assertMembership(userId: string, conversationId: string) {
    const nC = this.oid(conversationId);
    const p = await this.conversationParticipantModel.findOne({
      ConversationId: nC,
      userId,
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
    });
    if (!p) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
    return p;
  }

  async createDirectConversation(userId: string, participantId: string) {
    if (!participantId) {
      throw new BadRequestException('participantId required');
    }
    if (userId === participantId) {
      throw new BadRequestException("You can't create a conversation with yourself");
    }

    const existing = await this.findExistingDirectConversation(
      userId,
      participantId,
    );
    if (existing) return existing;

    const conversation = await this.conversationModel.create({
      type: 'direct',
      createdBy: userId,
    });
    const now = new Date();
    await this.conversationParticipantModel.insertMany([
      {
        ConversationId: conversation._id,
        userId,
        role: 'owner',
        joinedAt: now,
      },
      {
        ConversationId: conversation._id,
        userId: participantId,
        role: 'member',
        joinedAt: now,
      },
    ]);
    return conversation;
  }

  async createGroupConversation(
    userId: string,
    participantIds: string[],
    title?: string,
  ) {
    const ids = Array.from(new Set([userId, ...(participantIds || [])]));
    if (ids.length < 2) {
      throw new BadRequestException('Group needs at least 2 members');
    }
    const conversation = await this.conversationModel.create({
      type: 'group',
      title: title || 'Group',
      createdBy: userId,
    });
    const now = new Date();
    await this.conversationParticipantModel.insertMany(
      ids.map((uid) => ({
        ConversationId: conversation._id,
        userId: uid,
        role: uid === userId ? 'owner' : 'member',
        joinedAt: now,
      })),
    );
    return conversation;
  }

  async findExistingDirectConversation(userId: string, participantId: string) {
    const mine = await this.conversationParticipantModel
      .find({
        userId,
        $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      })
      .lean();

    for (const p of mine) {
      const shared = await this.conversationParticipantModel.findOne({
        ConversationId: p.ConversationId,
        userId: participantId,
        $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      });
      if (!shared) continue;
      const conv = await this.conversationModel.findById(p.ConversationId);
      if (conv?.type === 'direct') return conv;
    }
    return null;
  }

  async addParticipant(
    actorId: string,
    conversationId: string,
    newUserId: string,
  ) {
    const actor = await this.assertMembership(actorId, conversationId);
    if (!['owner', 'admin'].includes(actor.role)) {
      throw new ForbiddenException('Only admin/owner can add participants');
    }
    const nC = this.oid(conversationId);
    const conv = await this.conversationModel.findById(nC);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type === 'direct') {
      throw new BadRequestException('Cannot add members to a direct chat');
    }

    const existing = await this.conversationParticipantModel.findOne({
      ConversationId: nC,
      userId: newUserId,
    });
    if (existing && !existing.leftAt) {
      return { success: true, alreadyMember: true };
    }
    if (existing) {
      existing.set('leftAt', undefined);
      existing.joinedAt = new Date();
      existing.hidden = false;
      await existing.save();
    } else {
      await this.conversationParticipantModel.create({
        ConversationId: nC,
        userId: newUserId,
        role: 'member',
        joinedAt: new Date(),
      });
    }
    return { success: true };
  }

  async removeParticipant(
    actorId: string,
    conversationId: string,
    targetUserId: string,
  ) {
    const actor = await this.assertMembership(actorId, conversationId);
    const nC = this.oid(conversationId);
    const target = await this.conversationParticipantModel.findOne({
      ConversationId: nC,
      userId: targetUserId,
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
    });
    if (!target) throw new NotFoundException('Participant not found');

    const isSelf = actorId === targetUserId;
    if (!isSelf && !['owner', 'admin'].includes(actor.role)) {
      throw new ForbiddenException('Cannot remove this participant');
    }
    if (target.role === 'owner' && !isSelf) {
      throw new ForbiddenException('Cannot remove owner');
    }
    target.leftAt = new Date();
    await target.save();
    return { success: true };
  }

  async setFlags(
    userId: string,
    conversationId: string,
    flags: {
      muted?: boolean;
      pinned?: boolean;
      archived?: boolean;
      hidden?: boolean;
    },
  ) {
    const p = await this.assertMembership(userId, conversationId);
    if (flags.muted !== undefined) p.muted = flags.muted;
    if (flags.pinned !== undefined) p.pinned = flags.pinned;
    if (flags.archived !== undefined) p.archived = flags.archived;
    if (flags.hidden !== undefined) p.hidden = flags.hidden;
    await p.save();
    return {
      muted: p.muted,
      pinned: p.pinned,
      archived: p.archived,
      hidden: p.hidden,
    };
  }

  async touchLastMessage(
    conversationId: string,
    data: {
      messageId: string;
      text: string;
      type: string;
      senderId: string;
      at?: Date;
    },
  ) {
    const nC = this.oid(conversationId);
    await this.conversationModel.updateOne(
      { _id: nC },
      {
        $set: {
          lastMessageId: data.messageId,
          lastMessageText: String(data.text || '').slice(0, 200),
          lastMessageType: data.type,
          lastMessageAt: data.at || new Date(),
          lastMessageSenderId: data.senderId,
        },
      },
    );
    await this.conversationParticipantModel.updateMany(
      {
        ConversationId: nC,
        userId: { $ne: data.senderId },
        $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      },
      { $inc: { unreadCount: 1 } },
    );
  }

  async resetUnread(
    userId: string,
    conversationId: string,
    lastMessageId?: string,
  ) {
    const nC = this.oid(conversationId);
    await this.conversationParticipantModel.updateOne(
      { ConversationId: nC, userId },
      {
        $set: {
          unreadCount: 0,
          lastReadAt: new Date(),
          ...(lastMessageId ? { lastReadMessageId: lastMessageId } : {}),
        },
      },
    );
  }

  async getConversation(
    userId: string,
    opts: { cursor?: string; limit?: number; archived?: boolean } = {},
  ) {
    const limit = Math.min(Number(opts.limit) || 30, 100);
    const filter: any = {
      userId,
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      hidden: { $ne: true },
    };
    if (opts.archived === true) filter.archived = true;
    else filter.archived = { $ne: true };

    const parts = await this.conversationParticipantModel.find(filter).lean();
    const result: any[] = [];

    for (const p of parts) {
      // ()
      const conv = await this.conversationModel
        .findById(p.ConversationId)
        .lean();
      if (!conv) continue;
      const convp = await this.conversationParticipantModel
        .find({ConversationId:p.ConversationId})
        .lean();
      if (!convp) continue;
      
      const others = await this.conversationParticipantModel
        .find({
          ConversationId: p.ConversationId,
          userId: { $ne: userId },
          $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
        })
        .lean();

      let peerId: string | undefined;
      let peerUsername: string | undefined;
      let peerDisplayName: string | undefined;
      let peerProfilePic: string | undefined;
      // Direct chats: resolve peer strictly by userId (never search by displayName)
      let name = conv.title || (conv.type === 'group' ? 'Group' : 'Chat');
      if (conv.type === 'direct' && others[0]) {
        peerId = String(others[0].userId);
        const peer: any = await this.UserModel.findOne({ userId: peerId })
          .select('userId username displayName profilePic')
          .lean();
        peerUsername = peer?.username;
        peerDisplayName = peer?.displayName || peer?.username;
        peerProfilePic = peer?.profilePic || '';
        name = peerDisplayName || peerUsername || 'Chat';
      }

      result.push({
        _id: String(conv._id),
        type: conv.type,
        title: conv.title,
        name,
        peerId,
        lastMessage: {
          messageId: conv.lastMessageId,
          text: conv.lastMessageText,
          type: conv.lastMessageType,
          at: conv.lastMessageAt,
          senderId: conv.lastMessageSenderId,
        },
        unreadCount: p.unreadCount || 0,
        muted: !!p.muted,
        pinned: !!p.pinned,
        archived: !!p.archived,
        updatedAt: conv.lastMessageAt || (conv as any).updatedAt,
        user: peerId
          ? {
              userId: peerId,
              userName: peerUsername,
              username: peerUsername,
              displayName: peerDisplayName || peerUsername,
              profilePic: peerProfilePic || '',
            }
          : undefined,
        conversation: {
          userId: peerId,
        },
      });
    }

    result.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
    let page = result;
    if (opts.cursor) {
      const c = new Date(opts.cursor).getTime();
      page = result.filter(
        (r) => r.updatedAt && new Date(r.updatedAt).getTime() < c,
      );
    }
    const sliced = page.slice(0, limit);

    const nextCursor =
      sliced.length === limit && sliced[sliced.length - 1]?.updatedAt
        ? new Date(sliced[sliced.length - 1].updatedAt).toISOString()
        : null;

    return {
      conversations: sliced,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }

  async getMembers(userId: string, conversationId: string) {
    await this.assertMembership(userId, conversationId);
    const nC = this.oid(conversationId);
    const parts = await this.conversationParticipantModel
      .find({
        ConversationId: nC,
        $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      })
      .lean();
    const members: any[] = [];
    for (const p of parts || []) {
      const u = await this.UserModel.findOne({ userId: p.userId }).lean();
      members.push({
        userId: p.userId,
        username: (u as any)?.username || (u as any)?.userName || p.userId,
        role: p.role || 'member',
      });
    }
    members.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return String(a.username).localeCompare(String(b.username));
    });
    return { members, count: members.length };
  }

}
