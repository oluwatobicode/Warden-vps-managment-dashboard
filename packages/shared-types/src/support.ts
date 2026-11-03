import { z } from "zod";

/*
 * Support (dashboard → Support): a message to the people who run this Warden,
 * with up to 3 screenshots. Sent by email to MAIL_SUPPORT with the sender as
 * Reply-To; nothing is stored. Hidden when MAIL_SUPPORT isn't set, so a
 * self-hosted Warden never mails trywarden.xyz by accident.
 */

export const SUPPORT_CATEGORIES = ["BUG", "FEATURE", "QUESTION", "ACCOUNT", "OTHER"] as const;
export const SupportCategorySchema = z.enum(SUPPORT_CATEGORIES);
export type SupportCategory = z.infer<typeof SupportCategorySchema>;

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  BUG: "Bug",
  FEATURE: "Feature request",
  QUESTION: "Question",
  ACCOUNT: "Account or access",
  OTHER: "Other",
};

export const SUPPORT_LIMITS = {
  subject: 120,
  message: 5000,
  images: 3,
  imageBytes: 5 * 1024 * 1024,
  /** Messages per person per hour. */
  perHour: 5,
} as const;

export const SUPPORT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** The text fields. Screenshots travel beside them as multipart files named `images`. */
export const SupportRequestSchema = z.object({
  category: SupportCategorySchema,
  subject: z.string().trim().min(3, "Add a short subject").max(SUPPORT_LIMITS.subject, `Use at most ${SUPPORT_LIMITS.subject} characters`),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a bit more (at least 10 characters)")
    .max(SUPPORT_LIMITS.message, `Use at most ${SUPPORT_LIMITS.message} characters`),
  /** The dashboard page it was sent from, for context. */
  page: z.string().trim().max(500).optional(),
});
export type SupportRequestInput = z.infer<typeof SupportRequestSchema>;

export const SupportStatusSchema = z.object({ enabled: z.boolean() });
export type SupportStatus = z.infer<typeof SupportStatusSchema>;
