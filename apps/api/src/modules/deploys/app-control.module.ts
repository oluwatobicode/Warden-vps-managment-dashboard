import { Module } from '@nestjs/common';
import { AppControlService } from './app-control.service';

/** Stop / start / remove apps on their servers: shared by service, environment and project deletes. */
@Module({ providers: [AppControlService], exports: [AppControlService] })
export class AppControlModule {}
