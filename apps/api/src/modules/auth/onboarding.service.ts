import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from 'db';
import type { EmailOnboardingInput, SessionUser } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { SessionService } from './session/session.service';
import { hashPassword } from '../../common/utils/password.util';
import { REDIS_KEY } from '../../common/constants/constants.config';
import { SIGNUP_MESSAGES } from '../../common/constants/messages.config';
import type { PendingSignupRecord } from './auth.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * Route 3: POST /auth/onboarding (magic-link signups).
   * Turns a verified email + the form into User + Organization + Membership,
   * atomically, then logs them in.
   */
  async completeEmailSignup(
    pending: PendingSignupRecord,
    pendingId: string,
    input: EmailOnboardingInput,
  ): Promise<{
    user: SessionUser;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    // 1. Hash BEFORE the transaction — bcrypt takes ~250ms and shouldn't hold a DB connection.
    const passwordHashed = await hashPassword(input.password);

    // 2. One transaction: all three rows or none. `tx` is the transactional client;
    //    using `this.prisma.client` inside here would escape the transaction.
    let created;
    try {
      created = await this.prisma.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: pending.email, // the VERIFIED email from Redis, never from the body
            firstName: input.firstName,
            lastName: input.lastName,
            passwordHashed,
            authProcess: 'EMAIL',
          },
        });

        const organization = await tx.organization.create({
          data: {
            organizationName: input.organizationName,
            // Schema requires a unique org email; the form doesn't collect one,
            // so the creator's email stands in. (Open question flagged earlier.)
            organizationEmail: pending.email,
          },
        });

        // The creator is ADMIN — otherwise nobody can manage the org.
        const membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        });

        return { user, organization, membership };
      });
    } catch (e) {
      // P2002 = unique constraint hit (User.email or Organization.organizationEmail).
      // Means a signup for this email already completed between verify and now.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(SIGNUP_MESSAGES.email_taken);
      }
      throw e;
    }

    // 3. Only now that the rows exist do we burn the pending record.
    await this.redis.del(REDIS_KEY.pendingSignup(pendingId));

    // 4. Same login path as everything else.
    const tokens = await this.sessions.create(
      created.user.id,
      created.organization.id,
      created.membership.role,
    );

    // 5. Shape the response explicitly — never hand a Prisma User to a controller.
    const user: SessionUser = {
      id: created.user.id,
      email: created.user.email,
      firstName: created.user.firstName,
      lastName: created.user.lastName,
      organization: {
        id: created.organization.id,
        name: created.organization.organizationName,
      },
      role: created.membership.role,
    };

    return { user, tokens };
  }
}
