import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { SshKeyController } from './ssh-keys.controller';
import { SshKeyService } from './ssh-keys.service';

@Module({
  imports: [SessionModule],
  controllers: [SshKeyController],
  providers: [SshKeyService],
})
export class SshKeyModule {}
