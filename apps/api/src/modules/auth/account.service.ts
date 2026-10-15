import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  SessionUser,
  SessionsSummary,
  UpdateProfileInput,
} from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { SessionService } from './session/session.service';
import type { SessionRecord } from './session/session.service';
import {
  hashPassword,
  verifyPassword,
} from '../../common/utils/password.util';
import { AUTH_MESSAGES } from '../../common/constants/messages.config';

/**
 * The signed-in person's own account. Every method works on the user in the
 * session: there's no user id in any request body or URL, so nobody can
 * edit someone else's account by changing a number.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  async updateProfile(
    session: SessionRecord,
    input: UpdateProfileInput,
  ): Promise<SessionUser> {
    await this.prisma.client.user.update({
      where: { id: session.userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.avatar && {
          avatarStyle: input.avatar.style,
          avatarSeed: input.avatar.seed,
        }),
      },
    });
    return this.auth.me(session);
  }

  /** For people who have a password: the current one proves it's them. */
  async changePassword(
    session: SessionRecord,
    sid: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: session.userId },
      select: { passwordHashed: true },
    });
    if (!user) throw new UnauthorizedException(AUTH_MESSAGES.session_expired);
    if (!user.passwordHashed) {
      throw new ConflictException(AUTH_MESSAGES.password_none);
    }
    if (!(await verifyPassword(user.passwordHashed, currentPassword))) {
      throw new BadRequestException(AUTH_MESSAGES.password_wrong);
    }
    await this.prisma.client.user.update({
      where: { id: session.userId },
      data: { passwordHashed: await hashPassword(newPassword) },
    });
    // Whoever knew the old password loses access; this browser stays signed in.
    await this.sessions.destroyOthers(session.userId, sid);
  }

  async sessionsSummary(
    session: SessionRecord,
    sid: string,
  ): Promise<SessionsSummary> {
    return { others: await this.sessions.countOthers(session.userId, sid) };
  }

  signOutOthers(session: SessionRecord, sid: string): Promise<void> {
    return this.sessions.destroyOthers(session.userId, sid);
  }
}
