import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends email. Knows nothing about auth, tokens or Redis — it receives
 * finished content and delivers it. Phase 1: logs to the console.
 * When a provider is chosen (open item in claude.md), only the method bodies change.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendMagicLink(email: string, url: string): Promise<void> {
    // TODO: replace with the real provider once decided.
    this.logger.log(`Magic link for ${email}: ${url}`);
  }
}
