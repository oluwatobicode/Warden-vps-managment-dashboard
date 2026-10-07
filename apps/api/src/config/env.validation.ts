import z from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),

  CORS_ORIGIN: z.string().default(''),
  APP_URL: z.string().default(''),
  // 32-byte master key (KEK) as 64 hex chars. Wraps every org's data key.
  // Must match the worker's. Generate with: openssl rand -hex 32
  MASTER_KEY: z
    .string()
    .regex(
      /^[0-9a-fA-F]{64}$/,
      'MASTER_KEY must be 64 hex characters (openssl rand -hex 32)',
    ),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('noreply@oluwatobii.xyz'),
  MAIL_SUPPORT: z.string().optional().default(''),
  GITHUB_CLIENT_SECRET: z.string().optional().default(''),
  GITHUB_CALLBACK_URL: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

// validating the schema
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
