import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisModule } from './redis/redis.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { TeamModule } from './modules/teams/team.module';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT } from './common/constants/constants.config';
import { GENERIC_MESSAGES } from './common/constants/messages.config';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: RATE_LIMIT.default.ttlSeconds * 1000,
          limit: RATE_LIMIT.default.limit,
        },
      ],
      errorMessage: GENERIC_MESSAGES.rate_limited,
    }),

    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    PrismaModule,
    RedisModule,
    AuthModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
