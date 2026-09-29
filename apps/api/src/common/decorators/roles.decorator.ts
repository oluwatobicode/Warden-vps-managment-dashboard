import { SetMetadata } from '@nestjs/common';
import type { Role } from 'db';

/** The label the role list is stored under. Shared with RolesGuard so it can't drift. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
