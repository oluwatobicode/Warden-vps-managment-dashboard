export const COST = 12;
export const PASSWORD_MAX_BYTES = 72;

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

export const TTL_SECONDS = {
  session: 7 * 24 * 60 * 60, // session:{sid}, sliding
  refresh: 7 * 24 * 60 * 60, // refresh:{hash}
  magicLink: 15 * 60, // magic:{hash}, single use
  pendingSignup: 30 * 60, // pending:{id}, between verify and onboarding
  oauthState: 10 * 60, // oauth-state:{state}, CSRF guard for the callback
} as const;

export const SESSION_SLIDE_THRESHOLD_SECONDS = 6 * 24 * 60 * 60;
export const SESSION_TOUCH_INTERVAL_SECONDS = 60 * 60;

// Redis key builders.
const PREFIX = 'warden';
export const REDIS_KEY = {
  session: (sid: string) => `${PREFIX}:session:${sid}`,
  refresh: (tokenHash: string) => `${PREFIX}:refresh:${tokenHash}`,
  userSessions: (userId: string) => `${PREFIX}:user-sessions:${userId}`,
  magicLink: (tokenHash: string) => `${PREFIX}:magic:${tokenHash}`,
  pendingSignup: (id: string) => `${PREFIX}:pending:${id}`,
  oauthState: (state: string) => `${PREFIX}:oauth-state:${state}`,
} as const;

// JWT
export const JWT = {
  algorithm: 'HS256',
  issuer: 'warden',
  audience: 'warden-api',
  accessTtl: '15m',
} as const;

// API tokens (Settings → API tokens)
export const API_TOKEN = {
  prefix: 'wdn_', // raw token = prefix + 32 random bytes base64url
  displayPrefixLength: 12, // stored in ApiToken.tokenPrefix for the table
} as const;

export const API_TOKEN_EXPIRY_DAYS = {
  '30d': 30,
  '90d': 90,
  '1y': 365,
  never: null,
} as const;

// Team & invitations
export const INVITATION_TTL_DAYS = 7;

/** Human-readable role names for emails and UI. Names only — no permission copy. */
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  DEV_OPS: 'DevOps',
  DEPLOYER: 'Deployer',
  DEVELOPER: 'Developer',
  VIEWER: 'Viewer',
} as const;

// Rate limiting (per IP unless noted). GUESS
export const RATE_LIMIT = {
  magicLink: { limit: 5, ttlSeconds: 15 * 60 }, // also keyed by email in the service
  login: { limit: 10, ttlSeconds: 15 * 60 },
  refresh: { limit: 30, ttlSeconds: 60 },
  default: { limit: 100, ttlSeconds: 60 },
} as const;

// Pagination
export const PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

// Servers (Settings → Remote servers)
export const SERVER = {
  defaultSshPort: 22,
  metricsWindowHours: 24,
  metricsPollIntervalSeconds: 60,
  defaultDockerCleanupIntervalDays: 30,
} as const;
