import type { CookieOptions, Response } from 'express';
import {
  COOKIE,
  COOKIE_PATHS as PATHS,
  MAX_AGE_MS,
} from '../constants/constants.config';

// Names and paths have ONE home, constants.config.ts (built from API_PREFIX).
// Re-exported so `import { COOKIE } from cookie.util` keeps working.
export { COOKIE };

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

/** Onboarding done (or abandoned): drop only the pending cookie. */
export function clearPendingCookie(res: Response, isProd: boolean) {
  res.clearCookie(COOKIE.pending, { ...base(isProd), path: PATHS.pending });
}

export function clearAuthCookies(res: Response, isProd: boolean) {
  res.clearCookie(COOKIE.access, { ...base(isProd), path: PATHS.access });
  res.clearCookie(COOKIE.refresh, { ...base(isProd), path: PATHS.refresh });
  res.clearCookie(COOKIE.pending, { ...base(isProd), path: PATHS.pending });
}
