import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/request';
import type { Actor } from '../types/actor';

/** Like @CurrentOrg(), but the whole "who is acting" bundle — for audit logs. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const s = req.session!;
    return {
      organizationId: s.organizationId,
      role: s.role,
      // A token request carries a fake userId ("token:<id>"), not a real User.
      // Writing it to performedById would break the foreign key, so null it.
      userId: req.apiTokenId ? null : s.userId,
      apiTokenId: req.apiTokenId ?? null,
      tokenProjectId: req.apiTokenProjectId ?? null,
    };
  },
);
