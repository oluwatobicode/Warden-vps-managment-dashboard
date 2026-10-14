import { z } from "zod";
import { email, password } from "./field.js";

export const MagicLinkRequestSchema = z.object({ email });
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const MagicLinkVerifySchema = z.object({ token: z.string().min(1) });
export type MagicLinkVerify = z.infer<typeof MagicLinkVerifySchema>;

export const LoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(72, "Use at most 72 characters"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// POST /auth/forgot-password
export const ForgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

// POST /auth/reset-password
export const ResetPasswordSchema = z.object({
  email,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: password,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const EmailOnboardingSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(80, "Use at most 80 characters"),
  lastName: z.string().trim().min(1, "Enter your last name").max(80, "Use at most 80 characters"),
  password,
  organizationName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(80, "Use at most 80 characters"),
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
