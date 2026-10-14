import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { ApiTokenController } from './api-token.controller';
import { ApiTokenService } from './api-token.service';

@Module({
  imports: [SessionModule],
  controllers: [ApiTokenController],
  providers: [ApiTokenService],
})
export class ApiTokenModule {}
