import z from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string(),
  REDOIS_URL: z.string(),

  CORS_ORIGINS: z.string().default(''),
  APP_URL: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GITHUB_CLIENT_ID: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().optional().default('noreply@oluwatobii.xyz'),
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
