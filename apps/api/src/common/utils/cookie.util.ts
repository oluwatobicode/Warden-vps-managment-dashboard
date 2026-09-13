import type { CookieOptions, Response } from 'express';
import { MAX_AGE_MS } from '../constants/constants.config';

export const COOKIE = {
  access: 'warden_access',
  refresh: 'warden_refresh',
  pending: 'warden_pending',
} as const;

const PATHS = {
  access: '/',
  refresh: '/auth/refresh',
  pending: '/auth/onboarding',
} as const;

function base(isProd: boolean): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax' };
}

export function setAccessCookie(res: Response, jwt: string, isProd: boolean) {
  res.cookie(COOKIE.access, jwt, {
    ...base(isProd),
    path: PATHS.access,
    maxAge: MAX_AGE_MS.access,
  });
}

export function setRefreshCookie(
  res: Response,
  token: string,
  isProd: boolean,
) {
  res.cookie(COOKIE.refresh, token, {
    ...base(isProd),
    path: PATHS.refresh,
    maxAge: MAX_AGE_MS.refresh,
  });
}

export function setPendingCookie(res: Response, id: string, isProd: boolean) {
  res.cookie(COOKIE.pending, id, {
    ...base(isProd),
    path: PATHS.pending,
    maxAge: MAX_AGE_MS.pending,
  });
}

export function clearAuthCookies(res: Response, isProd: boolean) {
  res.clearCookie(COOKIE.access, { ...base(isProd), path: PATHS.access });
  res.clearCookie(COOKIE.refresh, { ...base(isProd), path: PATHS.refresh });
  res.clearCookie(COOKIE.pending, { ...base(isProd), path: PATHS.pending });
}
