import { createHash } from 'node:crypto';
import { AVATAR_STYLES, type Avatar, type SessionUser } from 'shared-types';

/** The pieces of Prisma output we need. Structural, so any query that
 *  includes these fields fits — no need to import Prisma's payload types. */
interface UserLike {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarStyle: string | null;
  avatarSeed: string | null;
  /** Only read to say whether one exists. The hash itself never leaves this file. */
  passwordHashed: string | null;
}
interface OrgLike {
  id: string;
  organizationName: string;
  slug: string;
}
interface MembershipLike {
  role: SessionUser['role'];
}

/**
 * The ONLY way a user leaves the API. Picks fields explicitly so a new
 * sensitive column on User can never leak by accident.
 * Used by OnboardingService.completeEmailSignup and AuthService.me.
 */
export function toSessionUser(
  user: UserLike,
  organization: OrgLike,
  membership: MembershipLike,
): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    organization: {
      id: organization.id,
      name: organization.organizationName,
      slug: organization.slug,
    },
    role: membership.role,
    avatar: avatarFor(user),
    hasPassword: user.passwordHashed !== null,
  };
}

/**
 * The stored avatar, or a default: a style picked from the user id's hash
 * and the id as the seed. "Random" across people, but the same face for one
 * person every time, without having to store anything.
 */
function avatarFor(user: UserLike): Avatar {
  const known = (AVATAR_STYLES as readonly string[]).includes(user.avatarStyle ?? '');
  if (known && user.avatarSeed) {
    return { style: user.avatarStyle as Avatar['style'], seed: user.avatarSeed };
  }
  const n = createHash('sha256').update(user.id).digest().readUInt32BE(0);
  return { style: AVATAR_STYLES[n % AVATAR_STYLES.length], seed: user.id };
}
