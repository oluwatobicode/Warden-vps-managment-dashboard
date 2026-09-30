import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { TTL_SECONDS } from '../common/constants/constants.config';
import { magicLinkHtml } from './templates/magic-link.template';
import { welcomeHtml, WelcomeTemplateInput } from './templates/welcome.template';
import {
  inviteMemberHtml,
  InviteMemberTemplateInput,
} from './templates/invite-member.template';
import {
  inviteAcceptedHtml,
  InviteAcceptedTemplateInput,
} from './templates/invite-accepted.template';
import {
  memberRemovedHtml,
  MemberRemovedTemplateInput,
} from './templates/member-removed.template';
import {
  resetPasswordOtpHtml,
  ResetPasswordOtpTemplateInput,
} from './templates/reset-password-otp.template';

/** Template inputs minus the branding fields the service fills in itself. */
type Input<T> = Omit<T, 'appName' | 'supportEmail'>;

/**
 * Sends email. Knows nothing about auth, tokens or Redis — it receives
 * finished content and delivers it.
 *
 * Provider: Resend. If RESEND_API_KEY is empty (fresh clone, tests), the
 * service logs a one-line summary (and any link/code) to the console instead
 * of sending, so nothing else in the app has to care whether mail is configured.
 *
 * Optional env: MAIL_SUPPORT — when set, every email gets a "Questions? …"
 * line in the footer. Leave it unset if MAIL_FROM is a no-reply address.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly supportEmail: string | undefined;
  private readonly resend: Resend | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.from = config.getOrThrow<string>('MAIL_FROM');
    this.supportEmail = config.get<string>('MAIL_SUPPORT') || undefined;
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged, not sent',
      );
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async sendMagicLink(email: string, url: string): Promise<void> {
    await this.deliver({
      to: email,
      subject: 'Sign in to Warden',
      html: magicLinkHtml({
        url,
        email,
        expiresMinutes: TTL_SECONDS.magicLink / 60,
        supportEmail: this.supportEmail,
      }),
      consoleHint: url,
      failure: 'Could not send sign-in email',
    });
  }

  /** Template only for now — no reset flow issues codes yet. */
  async sendPasswordResetCode(
    input: Input<ResetPasswordOtpTemplateInput>,
  ): Promise<void> {
    await this.deliver({
      to: input.email,
      subject: 'Your Warden reset code',
      html: resetPasswordOtpHtml({ ...input, supportEmail: this.supportEmail }),
      consoleHint: `code ${input.code}`,
      failure: 'Could not send reset code',
    });
  }

  async sendWelcome(
    email: string,
    input: Input<WelcomeTemplateInput>,
  ): Promise<void> {
    await this.deliver({
      to: email,
      subject: 'Welcome to Warden',
      html: welcomeHtml({ ...input, supportEmail: this.supportEmail }),
      failure: 'Could not send welcome email',
    });
  }

  // ─── Team ─────────────────────────────────────────────────────────────────

  async sendInvite(input: Input<InviteMemberTemplateInput>): Promise<void> {
    await this.deliver({
      to: input.inviteeEmail,
      subject: `You're invited to ${input.organizationName} on Warden`,
      html: inviteMemberHtml({ ...input, supportEmail: this.supportEmail }),
      consoleHint: input.acceptUrl,
      failure: 'Could not send invitation email',
    });
  }

  async sendInviteAccepted(
    inviterEmail: string,
    input: Input<InviteAcceptedTemplateInput>,
  ): Promise<void> {
    await this.deliver({
      to: inviterEmail,
      subject: `${input.memberName} accepted your invite`,
      html: inviteAcceptedHtml({ ...input, supportEmail: this.supportEmail }),
      failure: 'Could not send invite-accepted email',
    });
  }

  async sendMemberRemoved(
    input: Input<MemberRemovedTemplateInput>,
  ): Promise<void> {
    await this.deliver({
      to: input.memberEmail,
      subject: `Your access to ${input.organizationName} was removed`,
      html: memberRemovedHtml({ ...input, supportEmail: this.supportEmail }),
      failure: 'Could not send member-removed email',
    });
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  private async deliver(opts: {
    to: string;
    subject: string;
    html: string;
    /** Link or code to print in console mode so the flow stays testable. */
    consoleHint?: string;
    /** Message surfaced to the caller when delivery fails. */
    failure: string;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.log(
        `[mail] "${opts.subject}" → ${opts.to}${opts.consoleHint ? `: ${opts.consoleHint}` : ''}`,
      );
      return;
    }

    // Resend returns { data, error } rather than throwing on API errors,
    // so check both paths. A mail failure must NOT look like success upstream.
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      if (error) throw new Error(error.message);
    } catch (e) {
      this.logger.error(
        `Failed to send "${opts.subject}" to ${opts.to}: ${(e as Error).message}`,
      );
      throw new InternalServerErrorException(opts.failure);
    }
  }
}
