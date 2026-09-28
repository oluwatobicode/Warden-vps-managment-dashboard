import type { Request } from 'express';
import type { SessionRecord } from '../../modules/auth/session/session.service';
import type { PendingSignupRecord } from '../../modules/auth/auth.service';

/** Express request after our guards have run. Fields are optional because a
 *  public route has none of them; each guard fills in its own. */
export interface AuthenticatedRequest extends Request {
  // set by SessionGuard
  session?: SessionRecord;
  sid?: string;
  // set by OnboardingGuard
  pending?: PendingSignupRecord;
  pendingId?: string;
}
