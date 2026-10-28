import type { Role } from 'shared-types';

/** Who is making this request. Exactly one of userId / apiTokenId is set. */
export interface Actor {
  organizationId: string;
  role: Role;
  userId: string | null; // a person, logged in with a cookie
  apiTokenId: string | null; // a robot, with a Bearer token
  /** A token tied to one project may only touch that project's services. */
  tokenProjectId?: string | null;
}
