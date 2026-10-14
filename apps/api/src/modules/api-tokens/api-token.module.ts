import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import {
  ApiTokenController,
  ApiTokenWhoamiController,
} from './api-token.controller';
import { ApiTokenGuard } from '../../common/guards/api-token.guard';
import { ApiTokenService } from './api-token.service';

@Module({
  imports: [SessionModule],
  controllers: [ApiTokenController, ApiTokenWhoamiController],
  providers: [ApiTokenService, ApiTokenGuard],
})
export class ApiTokenModule {}
