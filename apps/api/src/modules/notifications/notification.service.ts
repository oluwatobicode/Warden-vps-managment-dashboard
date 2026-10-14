import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type NotificationChannel as ChannelRow } from 'db';
import {
  isWebhookUrlFor,
  type CreateNotificationChannelInput,
  type NotificationChannel,
  type NotificationEvent,
  type NotificationTestResult,
  type RevealedWebhook,
  type UpdateNotificationChannelInput,
} from 'shared-types';
import { sendDiscord, sendEmail, sendSlack, type EmailConfig } from 'notifier';
import { decrypt, encrypt } from 'warden-crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrgKeyService } from '../warden-crypto/org-key.service';
import { NOTIFICATION_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

@Injectable()
export class NotificationService {
  private readonly emailConfig: EmailConfig;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly orgKeys: OrgKeyService,
    private readonly audit: AuditService,
  ) {
    this.emailConfig = {
      apiKey: config.get<string>('RESEND_API_KEY') ?? '',
      from: config.getOrThrow<string>('MAIL_FROM'),
    };
  }

  async list(orgId: string): Promise<NotificationChannel[]> {
    const rows = await this.prisma.client.notificationChannel.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    if (rows.length === 0) return [];
    const dek = await this.orgKeys.getDek(orgId);
    return rows.map((row) =>
      toChannel(
        row,
        row.webhookUrlEncrypted
          ? maskUrl(decrypt(row.webhookUrlEncrypted, { v1: dek }))
          : null,
      ),
    );
  }

  async create(
    actor: Actor,
    input: CreateNotificationChannelInput,
  ): Promise<NotificationChannel> {
    const orgId = actor.organizationId;
    const isEmail = input.type === 'EMAIL';
    try {
      const row = await this.prisma.client.notificationChannel.create({
        data: {
          type: input.type,
          name: input.name,
          events: input.events,
          webhookUrlEncrypted: isEmail
            ? null
            : await this.seal(orgId, input.webhookUrl),
          emailRecipients: isEmail ? input.emailRecipients : [],
          organizationId: orgId,
        },
      });
      await this.audit.record(actor, {
        action: 'notification_channel.created',
        entityType: 'notification_channel',
        entityId: row.id,
        metadata: { name: row.name, type: row.type },
      });
      return toChannel(row, isEmail ? null : maskUrl(input.webhookUrl));
    } catch (e) {
      throw this.nameTaken(e);
    }
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateNotificationChannelInput,
  ): Promise<NotificationChannel> {
    const orgId = actor.organizationId;
    const ch = await this.findOrThrow(orgId, id);

    // Fields must match the channel's type; the URL host depends on it too.
    if (input.webhookUrl !== undefined) {
      if (ch.type === 'EMAIL') {
        throw new BadRequestException(
          NOTIFICATION_MESSAGES.wrong_field_for_type,
        );
      }
      if (!isWebhookUrlFor(ch.type, input.webhookUrl)) {
        throw new BadRequestException(NOTIFICATION_MESSAGES.invalid_webhook);
      }
    }
    if (input.emailRecipients !== undefined && ch.type !== 'EMAIL') {
      throw new BadRequestException(NOTIFICATION_MESSAGES.wrong_field_for_type);
    }

    try {
      const row = await this.prisma.client.notificationChannel.update({
        where: { id: ch.id },
        // undefined = Prisma leaves that column alone
        data: {
          name: input.name,
          enabled: input.enabled,
          events: input.events,
          emailRecipients: input.emailRecipients,
          ...(input.webhookUrl !== undefined && {
            webhookUrlEncrypted: await this.seal(orgId, input.webhookUrl),
          }),
        },
      });
      await this.audit.record(actor, {
        action: 'notification_channel.updated',
        entityType: 'notification_channel',
        entityId: row.id,
        // which fields changed, never the URL itself
        metadata: { name: row.name, changed: Object.keys(input).join(',') },
      });
      return toChannel(row, await this.maskedFor(orgId, row));
    } catch (e) {
      throw this.nameTaken(e);
    }
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const ch = await this.findOrThrow(actor.organizationId, id);
    await this.prisma.client.notificationChannel.delete({
      where: { id: ch.id },
    });
    await this.audit.record(actor, {
      action: 'notification_channel.deleted',
      entityType: 'notification_channel',
      entityId: ch.id,
      metadata: { name: ch.name, type: ch.type },
    });
  }

  async reveal(actor: Actor, id: string): Promise<RevealedWebhook> {
    const orgId = actor.organizationId;
    const ch = await this.findOrThrow(orgId, id);
    if (!ch.webhookUrlEncrypted) {
      throw new BadRequestException(NOTIFICATION_MESSAGES.wrong_field_for_type);
    }
    await this.audit.record(actor, {
      action: 'notification_channel.revealed',
      entityType: 'notification_channel',
      entityId: ch.id,
      metadata: { name: ch.name },
    });
    return { webhookUrl: await this.unseal(orgId, ch.webhookUrlEncrypted) };
  }

  /** Disabled channels can still be tested: "disabled" only stops real alerts. */
  async test(orgId: string, id: string): Promise<NotificationTestResult> {
    const ch = await this.findOrThrow(orgId, id);
    const text = `✅ Test from Warden: notifications for "${ch.name}" are working.`;

    if (ch.type === 'EMAIL') {
      return sendEmail(
        this.emailConfig,
        ch.emailRecipients,
        'Warden test notification',
        text,
      );
    }
    // SLACK/DISCORD rows are always created with a URL
    const url = await this.unseal(orgId, ch.webhookUrlEncrypted!);
    return ch.type === 'SLACK' ? sendSlack(url, text) : sendDiscord(url, text);
  }

  private async seal(orgId: string, url: string): Promise<string> {
    return encrypt(url, await this.orgKeys.getDek(orgId), 'v1');
  }

  private async unseal(orgId: string, enc: string): Promise<string> {
    return decrypt(enc, { v1: await this.orgKeys.getDek(orgId) });
  }

  private async maskedFor(orgId: string, row: ChannelRow) {
    return row.webhookUrlEncrypted
      ? maskUrl(await this.unseal(orgId, row.webhookUrlEncrypted))
      : null;
  }

  private async findOrThrow(orgId: string, id: string): Promise<ChannelRow> {
    const row = await this.prisma.client.notificationChannel.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) {
      throw new NotFoundException(NOTIFICATION_MESSAGES.channel_not_found);
    }
    return row;
  }

  private nameTaken(e: unknown): unknown {
    return e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
      ? new ConflictException(NOTIFICATION_MESSAGES.name_taken)
      : e;
  }
}

function maskUrl(url: string): string {
  return `${new URL(url).origin}/…${url.slice(-4)}`;
}

function toChannel(
  row: ChannelRow,
  webhookUrlMasked: string | null,
): NotificationChannel {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: row.enabled,
    events: row.events as NotificationEvent[],
    webhookUrlMasked,
    emailRecipients: row.emailRecipients,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
