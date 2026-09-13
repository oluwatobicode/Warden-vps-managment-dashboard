import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url. Used for refresh tokens, magic-link tokens,
 *  session IDs, pending-signup IDs and OAuth state. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash before storing anything that acts as a credential (refresh tokens,
 *  magic-link tokens, API tokens). Hex output, 64 chars. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
