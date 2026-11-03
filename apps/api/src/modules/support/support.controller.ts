import { Body, Controller, Get, Headers, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { SUPPORT_LIMITS, SupportRequestSchema, type SupportRequestInput } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import type { Actor } from '../../common/types/actor';
import { RATE_LIMIT, throttle } from '../../common/constants/constants.config';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SupportService, type UploadedImage } from './support.service';

/**
 * /support : every role, cookie session only. GET says whether the form is
 * shown (MAIL_SUPPORT set); POST is multipart: the text fields plus up to 3
 * files named `images`, kept in memory (≤ 5 MB each) and checked by their bytes.
 */
@Controller('support')
@UseGuards(SessionGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  status() {
    return this.support.status();
  }

  @Post()
  @Throttle(throttle(RATE_LIMIT.support))
  @UseInterceptors(
    // One file over the limit is let through so the service can say "at most 3" in its own words.
    FilesInterceptor('images', SUPPORT_LIMITS.images + 1, {
      limits: { fileSize: SUPPORT_LIMITS.imageBytes, files: SUPPORT_LIMITS.images + 1, fields: 10 },
    }),
  )
  send(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(SupportRequestSchema)) body: SupportRequestInput,
    @UploadedFiles() files: UploadedImage[] | undefined,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.support.send(actor, body, files ?? [], userAgent);
  }
}
