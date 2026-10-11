import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { ServerController } from './server.controller';
import { ServerService } from './servers.service';

@Module({
  imports: [SessionModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}
