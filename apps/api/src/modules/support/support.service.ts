import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_LIMITS,
  type SupportRequestInput,
  type SupportStatus,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MailService, type MailAttachment } from '../../mail/mail.service';
import { ROLE_LABEL } from '../../common/constants/constants.config';
import { SUPPORT_MESSAGES } from '../../common/constants/messages.config';
import type { Actor } from '../../common/types/actor';

/** The part of a multer file this service reads (memory storage). */
export interface UploadedImage {
  originalname: string;
  size: number;
  buffer: Buffer;
}

/** Recognised by their first bytes, never by name or the browser's claimed type. */
const IMAGE_KINDS: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

/**
 * Support messages: emailed to MAIL_SUPPORT with the sender as Reply-To, then
 * a copy to the sender. Nothing is stored. At most SUPPORT_LIMITS.perHour per
 * person per hour (Redis), on top of the api's per-IP limit.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
  ) {}

  status(): SupportStatus {
    return { enabled: Boolean(this.mail.supportInbox) };
  }

  async send(
    actor: Actor,
    input: SupportRequestInput,
    files: UploadedImage[],
    userAgent?: string,
  ): Promise<{ sent: true }> {
    if (!this.mail.supportInbox) throw new NotFoundException(SUPPORT_MESSAGES.not_configured);
    const attachments = checkImages(files);

    // Counted before sending, so a failing send still uses one of the five.
    const key = `support:${actor.userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 60 * 60);
    if (count > SUPPORT_LIMITS.perHour) {
      throw new HttpException(
        SUPPORT_MESSAGES.too_many.replace('{limit}', String(SUPPORT_LIMITS.perHour)),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user, org] = await Promise.all([
      this.prisma.client.user.findUniqueOrThrow({
        where: { id: actor.userId! },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.prisma.client.organization.findUniqueOrThrow({
        where: { id: actor.organizationId },
        select: { organizationName: true },
      }),
    ]);
    const name = `${user.firstName} ${user.lastName}`.trim();
    const categoryLabel = SUPPORT_CATEGORY_LABEL[input.category];

    await this.mail.sendSupportRequest(
      {
        categoryLabel,
        subject: input.subject,
        message: input.message,
        senderName: name || user.email,
        senderEmail: user.email,
        organizationName: org.organizationName,
        roleLabel: ROLE_LABEL[actor.role] ?? actor.role,
        page: input.page,
        userAgent: userAgent?.slice(0, 300),
        screenshots: attachments.length,
        sentAt: new Date(),
      },
      attachments,
    );

    // The message reached support; a failed copy shouldn't make it look like it didn't.
    try {
      await this.mail.sendSupportReceipt({
        name: user.firstName,
        email: user.email,
        categoryLabel,
        subject: input.subject,
        message: input.message,
      });
    } catch (e) {
      this.logger.warn(`support receipt failed: ${(e as Error).message}`);
    }
    return { sent: true };
  }
}

function checkImages(files: UploadedImage[]): MailAttachment[] {
  if (files.length > SUPPORT_LIMITS.images) {
    throw new BadRequestException(SUPPORT_MESSAGES.too_many_images.replace('{limit}', String(SUPPORT_LIMITS.images)));
  }
  return files.map((f, i) => {
    if (f.size > SUPPORT_LIMITS.imageBytes) {
      throw new BadRequestException(SUPPORT_MESSAGES.image_too_big.replace('{mb}', String(SUPPORT_LIMITS.imageBytes / 1024 / 1024)));
    }
    const kind = IMAGE_KINDS.find((k) => k.test(f.buffer));
    if (!kind) throw new BadRequestException(SUPPORT_MESSAGES.not_an_image.replace('{name}', f.originalname.slice(0, 80)));
    return { filename: `screenshot-${i + 1}.${kind.ext}`, content: f.buffer };
  });
}
