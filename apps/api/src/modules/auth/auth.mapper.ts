import type { SessionUser } from 'shared-types';

/** The pieces of Prisma output we need. Structural, so any query that
 *  includes these fields fits — no need to import Prisma's payload types. */
interface UserLike {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}
interface OrgLike {
  id: string;
  organizationName: string;
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
    organization: { id: organization.id, name: organization.organizationName },
    role: membership.role,
  };
}
