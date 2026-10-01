import { randomBytes } from 'node:crypto';

/** "Nimbus Labs' Org" → "nimbus-labs-org". Lowercase, ASCII, dashes, no edges. */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function uniqueSlug(text: string): string {
  const base = slugify(text) || 'org';
  const suffix = randomBytes(4).toString('base64url').slice(0, 6).toLowerCase();
  return `${base}-${suffix}`;
}
