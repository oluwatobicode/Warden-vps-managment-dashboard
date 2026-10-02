import { z } from "zod";
import { email, password } from "./field.js";

export const MagicLinkRequestSchema = z.object({ email });
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const MagicLinkVerifySchema = z.object({ token: z.string().min(1) });
export type MagicLinkVerify = z.infer<typeof MagicLinkVerifySchema>;

export const LoginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const EmailOnboardingSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password,
  organizationName: z.string().trim().min(2).max(80),
});

export type EmailOnboardingInput = z.infer<typeof EmailOnboardingSchema>;

export const OAuthOnboardingSchema = EmailOnboardingSchema.omit({
  password: true,
});
export type OAuthOnboardingInput = z.infer<typeof OAuthOnboardingSchema>;

export const RoleSchema = z.enum([
  "ADMIN",
  "DEVELOPER",
  "DEV_OPS",
  "VIEWER",
]);
export type Role = z.infer<typeof RoleSchema>;

export const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  organization: z.object({
    id: z.string(),
    name: z.string(),
  }),
  role: RoleSchema,
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

export const AuthOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("authenticated") }),
  z.object({
    status: z.literal("onboarding"),
    provider: z.enum(["EMAIL", "GITHUB", "GOOGLE"]),
  }),
]);
export type AuthOutcome = z.infer<typeof AuthOutcomeSchema>;

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export type OAuthCallback = z.infer<typeof OAuthCallbackSchema>;
