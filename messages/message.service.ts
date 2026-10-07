import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Message, MessageDocument } from './schema/message.schema';
import {
  MessageReceipt,
  MessageReceiptDocument,
} from './schema/message-receipt.schema';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
} from '../conversations/schemas/conversation-participant.schema';
import {
  Conversation,
  ConversationDocument,
} from '../conversations/schemas/conversation.schema';
import { PushService } from '../push/push.service';

@Injectable()
export class MessageService {
  private readonly rateLimitMap = new Map<string, number[]>();
  private readonly RATE_LIMIT_MAX = 8;
  private readonly RATE_LIMIT_WINDOW_MS = 10_000;

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(MessageReceipt.name)
    private readonly receiptModel: Model<MessageReceiptDocument>,
    @InjectModel(ConversationParticipant.name)
    private readonly participantModel: Model<ConversationParticipantDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    private readonly pushService: PushService,
  ) {}

  async assertMembership(userId: string, conversationId: string) {
    const nC = new Types.ObjectId(conversationId);
    const participant = await this.participantModel.findOne({
      ConversationId: nC,
      userId,
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
    });
    if (!participant) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
    return participant;
  }

  private checkRateLimit(userId: string, conversationId: string) {
    const key = `${userId}:${conversationId}`;
    const now = Date.now();
    let timestamps = this.rateLimitMap.get(key) || [];
    timestamps = timestamps.filter((t) => now - t < this.RATE_LIMIT_WINDOW_MS);
    if (timestamps.length >= this.RATE_LIMIT_MAX) {
      throw new BadRequestException(
        'You are sending messages too fast. Please wait a moment.',
      );
    }
    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);
  }

  private toPublic(message: any) {
    if (message.deletedAt) {
      return {
        messageId: message.messageId,
        conversationId: message.conversationId,
        senderId: message.senderId,
        type: 'system',
        content: '',
        deletedAt: message.deletedAt,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        isDeleted: true,
        receiptStatus: 'sent',
      };
    }
    return {
      messageId: message.messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type,
      content: message.content,
      clientMessageId: message.clientMessageId,
      replyToMessageId: message.replyToMessageId,
      replyPreview: message.replyPreview,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      isDeleted: false,
    };
  }

  private async touchLastMessage(
    conversationId: string,
    data: {
      messageId: string;
      text: string;
      type: string;
      senderId: string;
    },
  ) {
    if (!Types.ObjectId.isValid(conversationId)) return;
    const nC = new Types.ObjectId(conversationId);
    await this.conversationModel.updateOne(
      { _id: nC },
      {
        $set: {
          lastMessageId: data.messageId,
          lastMessageText: String(data.text || '').slice(0, 200),
          lastMessageType: data.type,
          lastMessageAt: new Date(),
          lastMessageSenderId: data.senderId,
        },
      },
    );
    await this.participantModel.updateMany(
      {
        $and: [
          { ConversationId: nC },
          { userId: { $ne: data.senderId } },
          { $or: [{ leftAt: null }, { leftAt: { $exists: false } }] },
        ],
      },
      { $inc: { unreadCount: 1 } },
    );
  }


  /** Conversation ids this user still participates in */
  
  

  async getConversationIdsForUser(userId: string): Promise<string[]> {
    const uid = String(userId);
    const parts = await this.participantModel
      .find({
        $and: [
          { userId: uid },
          { $or: [{ leftAt: null }, { leftAt: { $exists: false } }] },
        ],
      })
      .select('ConversationId conversationId')
      .lean()
      .exec();
    const ids = (parts || [])
      .map((p: any) => String(p.ConversationId || p.conversationId || ''))
      .filter(Boolean);
    return [...new Set(ids)];
  }


  async getActiveMemberIds(conversationId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(conversationId)) return [];
    const nC = new Types.ObjectId(conversationId);
    const notLeft = {
      $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
    };

    let parts = await this.participantModel
      .find({
        $and: [{ ConversationId: nC }, notLeft],
      })
      .select('userId')
      .lean()
      .exec();

    if (!parts?.length) {
      parts = await this.participantModel
        .find({
          $and: [{ conversationId: nC }, notLeft],
        })
        .select('userId')
        .lean()
        .exec();
    }

    if (!parts?.length) {
      parts = await this.participantModel
        .find({
          $and: [
            {
              $or: [
                { ConversationId: conversationId as any },
                { conversationId: conversationId as any },
              ],
            },
            notLeft,
          ],
        })
        .select('userId')
        .lean()
        .exec();
    }

    return [
      ...new Set(
        (parts || []).map((p: any) => String(p.userId)).filter(Boolean),
      ),
    ];
  }

  async createMessage(
    userId: string,
    conversationId: string,
    content: string,
    type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'system' = 'text',
    replyToMessageId?: string,
    clientMessageId?: string,
  ) {
    if (type === 'text') {
      if (!content?.trim()) {
        throw new BadRequestException('Message content cannot be empty');
      }
      if (content.length > 8000) {
        throw new BadRequestException('Message too long');
      }
    } else if (!content?.trim()) {
      throw new BadRequestException('Media content required');
    }

    await this.assertMembership(userId, conversationId);
    this.checkRateLimit(userId, conversationId);

    if (clientMessageId) {
      const existing = await this.messageModel
        .findOne({ senderId: userId, clientMessageId })
        .lean();
      if (existing) return this.toPublic(existing);
    }

    let replyPreview: string | undefined;
    if (replyToMessageId) {
      const parent = await this.messageModel
        .findOne({ messageId: replyToMessageId, conversationId })
        .lean();
      if (parent && !(parent as any).deletedAt) {
        const p: any = parent;
        replyPreview =
          p.type === 'text' ? String(p.content).slice(0, 120) : `[${p.type}]`;
      }
    }

    const messageId = randomUUID();
    const message = await this.messageModel.create({
      conversationId,
      senderId: userId,
      messageId,
      clientMessageId: clientMessageId || undefined,
      type,
      content: type === 'text' ? content.trim() : content,
      replyToMessageId: replyToMessageId || undefined,
      replyPreview,
    });

    const nC = new Types.ObjectId(conversationId);
    const participants = await this.participantModel.find({
      $and: [
        { ConversationId: nC },
        { userId: { $ne: userId } },
        { $or: [{ leftAt: null }, { leftAt: { $exists: false } }] },
      ],
    });
    if (participants.length > 0) {
      await this.receiptModel.insertMany(
        participants.map((p) => ({ messageId, userId: p.userId })),
      );
    }

    await this.touchLastMessage(conversationId, {
      messageId,
      text: type === 'text' ? content.trim() : `[${type}]`,
      type,
      senderId: userId,
    });

    // Web Push to other members (never fail the message send)
    try {
      const allMembers = await this.participantModel
        .find({
          ConversationId: nC,
          $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
        })
        .select('userId')
        .lean();
      const memberIds = allMembers.map((m) => String(m.userId));
      const preview =
        type === 'text' ? content.trim().slice(0, 100) : `[${type}]`;
      // fire-and-forget
      void this.pushService.notifyConversationMembers(memberIds, userId, {
        title: 'New message',
        body: preview,
        url: `/?conversationId=${conversationId}`,
        tag: conversationId,
        conversationId,
      });
    } catch {
      /* ignore push errors */
    }

    return { ...this.toPublic(message.toObject()), receiptStatus: 'sent' as const };
  }

  async getMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    cursor?: string,
  ) {
    await this.assertMembership(userId, conversationId);
    const query: any = { conversationId };

    if (cursor) {
      const cursorMsg = await this.messageModel
        .findOne({ messageId: cursor, conversationId })
        .select('createdAt messageId')
        .lean();
      if (cursorMsg) {
        query.$or = [
          { createdAt: { $lt: (cursorMsg as any).createdAt } },
          {
            createdAt: (cursorMsg as any).createdAt,
            messageId: { $lt: cursorMsg.messageId },
          },
        ];
      }
    }

    const take = Math.min(limit, 100);
    const messages = await this.messageModel
      .find(query)
      .sort({ createdAt: -1, messageId: -1 })
      .limit(take)
      .lean();

    const ordered = messages.reverse();
    const ids = ordered.map((m: any) => m.messageId);
    const receipts = ids.length
      ? await this.receiptModel.find({ messageId: { $in: ids } }).lean()
      : [];

    const byMessage = new Map<string, any[]>();
    for (const r of receipts) {
      const list = byMessage.get(r.messageId) || [];
      list.push(r);
      byMessage.set(r.messageId, list);
    }

    const withStatus = ordered.map((m: any) => {
      const pub = this.toPublic(m);
      const list = byMessage.get(m.messageId) || [];
      const delivered = list.some((r) => !!r.deliveredAt);
      const read = list.some((r) => !!r.readAt);
      return {
        ...pub,
        receiptStatus: (read
          ? 'read'
          : delivered
            ? 'delivered'
            : 'sent') as string,
      };
    });

    return {
      messages: withStatus,
      nextCursor: ordered.length > 0 ? (ordered[0] as any).messageId : null,
      hasMore: messages.length === take,
    };
  }

  async editMessage(userId: string, messageId: string, content: string) {
    if (!content?.trim()) {
      throw new BadRequestException('Content cannot be empty');
    }
    const message = await this.messageModel.findOne({ messageId });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    if (message.deletedAt) {
      throw new BadRequestException('Cannot edit deleted message');
    }
    if (message.type !== 'text') {
      throw new BadRequestException('Only text messages can be edited');
    }
    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();
    return this.toPublic(message.toObject());
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageModel.findOne({ messageId });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    if (message.deletedAt) return this.toPublic(message.toObject());

    // Soft-delete only — never clear content (Mongoose required field)
    message.deletedAt = new Date();
    await message.save();

    // If this was the conversation's last message, roll back preview
    // to the previous non-deleted message (never show "deleted")
    try {
      const convId = String(message.conversationId);
      if (Types.ObjectId.isValid(convId)) {
        const conv = await this.conversationModel
          .findById(convId)
          .select('lastMessageId')
          .lean();
        if (conv && String((conv as any).lastMessageId) === String(message.messageId)) {
          const prev = await this.messageModel
            .findOne({
              conversationId: convId,
              deletedAt: { $exists: false },
              messageId: { $ne: message.messageId },
            })
            .sort({ createdAt: -1 })
            .lean();

          if (prev) {
            await this.touchLastMessage(convId, {
              messageId: String(prev.messageId),
              text: String(prev.content || '').slice(0, 200),
              type: String(prev.type || 'text'),
              senderId: String(prev.senderId),
            });
          } else {
            const nC = new Types.ObjectId(convId);
            await this.conversationModel.updateOne(
              { _id: nC },
              {
                $set: {
                  lastMessageId: null,
                  lastMessageText: '',
                  lastMessageType: 'text',
                  lastMessageAt: null,
                  lastMessageSenderId: null,
                },
              },
            );
          }
        }
      }
    } catch {
      // never fail delete because of preview update
    }

    return this.toPublic(message.toObject());
  }

  async markAsDelivered(messageId: string, userId: string) {
    return this.receiptModel.findOneAndUpdate(
      { messageId, userId },
      { $set: { deliveredAt: new Date() } },
      { new: true },
    );
  }

  async markAsRead(messageId: string, userId: string) {
    return this.receiptModel.findOneAndUpdate(
      { messageId, userId },
      {
        $set: { readAt: new Date(), deliveredAt: new Date() },
        $setOnInsert: { messageId, userId },
      },
      { new: true, upsert: true },
    );
  }

  async markConversationRead(conversationId: string, userId: string) {
    await this.assertMembership(userId, conversationId);
    const messages = await this.messageModel
      .find({ conversationId, senderId: { $ne: userId } })
      .select('messageId')
      .lean();
    const ids = messages.map((m: any) => m.messageId);

    // Always clear unread on participant even if no messages
    if (Types.ObjectId.isValid(conversationId)) {
      await this.participantModel.updateOne(
        { ConversationId: new Types.ObjectId(conversationId), userId },
        {
          $set: {
            unreadCount: 0,
            lastReadAt: new Date(),
            ...(ids.length
              ? { lastReadMessageId: ids[ids.length - 1] }
              : {}),
          },
        },
      );
    }

    if (!ids.length) return { updated: 0, messageIds: [] as string[] };

    const now = new Date();
    const result = await this.receiptModel.updateMany(
      {
        messageId: { $in: ids },
        userId,
        $or: [{ readAt: { $exists: false } }, { readAt: null }],
      },
      { $set: { readAt: now, deliveredAt: now } },
    );

    // Ensure a receipt row exists for each message (upsert missing)
    let upserted = 0;
    for (const messageId of ids) {
      const r = await this.receiptModel.updateOne(
        { messageId, userId },
        {
          $set: { readAt: now, deliveredAt: now },
          $setOnInsert: { messageId, userId },
        },
        { upsert: true },
      );
      if ((r as any).upsertedCount) upserted++;
    }

    return {
      updated: (result.modifiedCount || 0) + upserted,
      messageIds: ids,
    };
  }

  async findByMessageId(messageId: string) {
    const message = await this.messageModel.findOne({ messageId });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }
}
