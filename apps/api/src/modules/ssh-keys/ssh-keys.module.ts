import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { SshKeyService } from './ssh-keys.service';

@Module({
  imports: [SessionModule],
  controllers: [],
  providers: [SshKeyService],
})
export class SshKeyModule {}
