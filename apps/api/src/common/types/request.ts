import type { Request } from 'express';
import type { SessionRecord } from '../../modules/auth/session/session.service';

export interface AuthenticatedRequest extends Request {
  session?: SessionRecord;
  sid: string;
}
