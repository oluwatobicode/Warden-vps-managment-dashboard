import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GithubAppConfig } from 'github-app';
import { GITHUB_MESSAGES } from '../../common/constants/messages.config';

/** The Warden GitHub App's keys from .env (one App for this whole Warden install). */
@Injectable()
export class GithubConfig {
  readonly app: GithubAppConfig | null;

  constructor(config: ConfigService) {
    const appId = config.get<string>('GITHUB_APP_ID') ?? '';
    const privateKey = config.get<string>('GITHUB_APP_PRIVATE_KEY') ?? '';
    this.app =
      appId && privateKey
        ? {
            appId,
            privateKey,
            webhookSecret: config.get<string>('GITHUB_APP_WEBHOOK_SECRET') ?? '',
            slug: config.get<string>('GITHUB_APP_SLUG') ?? '',
          }
        : null;
  }

  require(): GithubAppConfig {
    if (!this.app) throw new BadRequestException(GITHUB_MESSAGES.not_configured);
    return this.app;
  }
}
