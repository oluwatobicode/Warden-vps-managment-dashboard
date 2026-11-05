import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { PlatformController } from './platform.controller';
import { PlatformUsersService } from './platform-users.service';
import { PlatformService } from './platform.service';

/**
 * Platform admin: the one module that reads across organizations (owner only).
 * Kept on its own so that exception is easy to audit.
 */
@Module({
  imports: [SessionModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformUsersService],
})
export class PlatformModule {}
