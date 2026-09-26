import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';
import { SessionService } from './session.service';

@Module({
  providers: [TokenService, RefreshTokenService, SessionService],
  exports: [TokenService, RefreshTokenService, SessionService],
})
export class SessionModule {}
