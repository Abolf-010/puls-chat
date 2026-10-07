/**
 * Copy-paste pattern into MessageService.createMessage AFTER message is saved.
 *
 * 1) Import PushModule in MessageModule imports
 * 2) Inject PushService in MessageService constructor
 * 3) Call notifyNewMessagePush(...)
 */
import { Types } from 'mongoose';
import { PushService } from './push.service';

export async function notifyNewMessagePush(opts: {
  pushService: PushService;
  participantModel: {
    find: (q: any) => { select: (s: string) => { lean: () => Promise<any[]> } };
  };
  conversationId: string;
  senderId: string;
  content: string;
  type?: string;
}) {
  const {
    pushService,
    participantModel,
    conversationId,
    senderId,
    content,
    type = 'text',
  } = opts;

  try {
    if (!Types.ObjectId.isValid(conversationId)) return;

    const members = await participantModel
      .find({
        ConversationId: new Types.ObjectId(conversationId),
        $or: [{ leftAt: null }, { leftAt: { $exists: false } }],
      })
      .select('userId')
      .lean();

    const memberIds = members.map((m) => String(m.userId));
    const body =
      type === 'text'
        ? String(content || '').slice(0, 100)
        : `[${type}]`;

    await pushService.notifyConversationMembers(memberIds, senderId, {
      title: 'New message',
      body,
      url: `/?conversationId=${conversationId}`,
      tag: conversationId,
      conversationId,
    });
  } catch {
    // Never break messaging because of push
  }
}
