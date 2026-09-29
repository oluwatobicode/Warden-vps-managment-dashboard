import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { magicLinkHtml } from './templates/magic-link.template';
import { TTL_SECONDS } from '../common/constants/constants.config';

/**
 * Sends email. Knows nothing about auth, tokens or Redis — it receives
 * finished content and delivers it.
 *
 * Provider: Resend. If RESEND_API_KEY is empty (fresh clone, tests), the
 * service logs the link to the console instead of sending, so nothing else
 * in the app has to care whether mail is configured.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly resend: Resend | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set — magic links will be logged, not emailed',
      );
    }
  }

  async sendMagicLink(email: string, url: string): Promise<void> {
    // Console mode.
    if (!this.resend) {
      this.logger.log(`Magic link for ${email}: ${url}`);
      return;
    }

    // Resend returns { data, error } rather than throwing on API errors,
    // so check both paths. A mail failure must NOT look like success upstream.
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Sign in to Warden',
        html: magicLinkHtml({
          url,
          expiresMinutes: TTL_SECONDS.magicLink / 60,
        }),
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      this.logger.error(
        `Failed to send magic link to ${email}: ${(e as Error).message}`,
      );
      throw new InternalServerErrorException('Could not send sign-in email');
    }
  }
}
