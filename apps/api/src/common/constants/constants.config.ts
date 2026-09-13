// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------
export const COST = 12; // bcrypt cost factor
export const PASSWORD_MAX_BYTES = 72; // bcrypt silently ignores input past 72 bytes

// ---------------------------------------------------------------------------
// Cookies (names, paths, lifetimes). cookie.util.ts is the only writer.
// ---------------------------------------------------------------------------
export const COOKIE = {
  access: 'warden_access',
  refresh: 'warden_refresh',
  pending: 'warden_pending',
} as const;

export const COOKIE_PATHS = {
  access: '/',
  refresh: '/auth/refresh',
  pending: '/auth/onboarding',
} as const;

export const MAX_AGE_MS = {
  access: 15 * 60 * 1000,
  refresh: 7 * 24 * 60 * 60 * 1000,
  pending: 30 * 60 * 1000,
} as const;

// ---------------------------------------------------------------------------
// Redis TTLs (seconds — ioredis EX takes seconds, cookies take ms)
// ---------------------------------------------------------------------------
export const TTL_SECONDS = {
  session: 7 * 24 * 60 * 60, // session:{sid}, sliding
  refresh: 7 * 24 * 60 * 60, // refresh:{hash}
  magicLink: 15 * 60, // magic:{hash}, single use
  pendingSignup: 30 * 60, // pending:{id}, between verify and onboarding
  oauthState: 10 * 60, // oauth-state:{state}, CSRF guard for the callback
} as const;

// Sliding window: only rewrite the session TTL when it has dropped below this,
// and at most once per SESSION_TOUCH_INTERVAL_SECONDS, so Redis writes don't
// scale with request volume.
export const SESSION_SLIDE_THRESHOLD_SECONDS = 6 * 24 * 60 * 60;
export const SESSION_TOUCH_INTERVAL_SECONDS = 60 * 60;

// ---------------------------------------------------------------------------
// Redis key builders. Every key in the app is produced here so a rename is
// one edit and a `KEYS warden:*` in redis-cli shows everything the api owns.
// ---------------------------------------------------------------------------
const PREFIX = 'warden';
export const REDIS_KEY = {
  session: (sid: string) => `${PREFIX}:session:${sid}`,
  refresh: (tokenHash: string) => `${PREFIX}:refresh:${tokenHash}`,
  userSessions: (userId: string) => `${PREFIX}:user-sessions:${userId}`,
  magicLink: (tokenHash: string) => `${PREFIX}:magic:${tokenHash}`,
  pendingSignup: (id: string) => `${PREFIX}:pending:${id}`,
  oauthState: (state: string) => `${PREFIX}:oauth-state:${state}`,
} as const;

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
export const JWT = {
  algorithm: 'HS256',
  issuer: 'warden',
  audience: 'warden-api',
  accessTtl: '15m',
} as const;

// ---------------------------------------------------------------------------
// API tokens (Settings → API tokens)
// ---------------------------------------------------------------------------
export const API_TOKEN = {
  prefix: 'wdn_', // raw token = prefix + 32 random bytes base64url
  displayPrefixLength: 12, // stored in ApiToken.tokenPrefix for the table
} as const;

// Expiry options offered in the create-token form (Phase 1 doc §4).
// `null` = "no expiry".
export const API_TOKEN_EXPIRY_DAYS = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  never: null,
} as const;

// ---------------------------------------------------------------------------
// Team & invitations
// ---------------------------------------------------------------------------
// GUESS — the Phase 1 doc doesn't say how long an invite link stays valid.
export const INVITATION_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Rate limiting (per IP unless noted). GUESS — not in the Phase 1 doc; these
// exist to cap mail-provider spend and credential stuffing, tune once live.
// ---------------------------------------------------------------------------
export const RATE_LIMIT = {
  magicLink: { limit: 5, ttlSeconds: 15 * 60 }, // also keyed by email in the service
  login: { limit: 10, ttlSeconds: 15 * 60 },
  refresh: { limit: 30, ttlSeconds: 60 },
  default: { limit: 100, ttlSeconds: 60 },
} as const;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

// ---------------------------------------------------------------------------
// Servers (Settings → Remote servers)
// ---------------------------------------------------------------------------
export const SERVER = {
  defaultSshPort: 22,
  metricsWindowHours: 24, // Phase 1 ships 24h only
  // GUESS — metrics poll cadence isn't specified in the Phase 1 doc.
  metricsPollIntervalSeconds: 60,
  defaultDockerCleanupIntervalDays: 30, // mirrors Server.dockerCleanupInterval default
} as const;
