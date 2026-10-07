import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as webpush from 'web-push';
import {
  PushSubscriptionDocument,
  PushSubscriptionEntity,
} from './push-subscription.schema';

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  conversationId?: string;
};

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    @InjectModel(PushSubscriptionEntity.name)
    private readonly subModel: Model<PushSubscriptionDocument>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = String(
      this.config.get<string>('VAPID_PUBLIC_KEY') || '',
    )
      .trim()
      .replace(/\r/g, '');
    const privateKey = String(
      this.config.get<string>('VAPID_PRIVATE_KEY') || '',
    )
      .trim()
      .replace(/\r/g, '');
    const subject = String(
      this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@example.com',
    )
      .trim()
      .replace(/\r/g, '');

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys missing — push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env',
      );
      this.enabled = false;
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
    this.logger.log('Web Push enabled (VAPID configured)');
  }

  isEnabled() {
    return this.enabled;
  }

  getPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async saveSubscription(
    userId: string,
    data: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    if (!data?.endpoint || !data?.keys?.p256dh || !data?.keys?.auth) {
      return { success: false, error: 'invalid_subscription' };
    }

    await this.subModel.findOneAndUpdate(
      { endpoint: data.endpoint },
      {
        $set: {
          userId: String(userId),
          endpoint: data.endpoint,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: data.userAgent,
        },
      },
      { upsert: true, new: true },
    );

    return { success: true };
  }

  async removeSubscription(userId: string, endpoint: string) {
    await this.subModel.deleteOne({ userId: String(userId), endpoint });
    return { success: true };
  }

  async removeByEndpoint(endpoint: string) {
    await this.subModel.deleteOne({ endpoint });
  }

  async listUserEndpoints(userId: string) {
    return this.subModel
      .find({ userId: String(userId) })
      .select('endpoint userAgent createdAt')
      .lean();
  }

  async sendToUser(userId: string, payload: PushPayload) {
    if (!this.enabled) {
      return { sent: 0, skipped: true as const, reason: 'vapid_disabled' };
    }

    const subs = await this.subModel.find({ userId: String(userId) }).lean();
    if (!subs.length) {
      return { sent: 0, skipped: false as const };
    }

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body || '',
      url: payload.url || '/',
      tag: payload.tag || payload.conversationId,
      conversationId: payload.conversationId,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          body,
          {
            TTL: 60,
            urgency: 'high',
          },
        );
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode as number | undefined;
        this.logger.warn(
          `Push failed user=${userId} status=${status} msg=${err?.message}`,
        );
        // Invalid / unsubscribed endpoint
        if (status === 404 || status === 410) {
          await this.removeByEndpoint(sub.endpoint);
        }
      }
    }

    return { sent, skipped: false as const };
  }

  /**
   * Notify all conversation members except the sender.
   * Safe to call fire-and-forget; never throws to caller if wrapped.
   */
  async notifyConversationMembers(
    memberIds: string[],
    senderId: string,
    payload: PushPayload,
  ) {
    if (!this.enabled) {
      return { sent: 0, skipped: true as const };
    }

    const targets = [
      ...new Set(
        (memberIds || [])
          .map((id) => String(id))
          .filter((id) => id && id !== String(senderId)),
      ),
    ];

    let total = 0;
    for (const id of targets) {
      const result = await this.sendToUser(id, payload);
      total += result.sent || 0;
    }
    return { sent: total, targets: targets.length };
  }
}
