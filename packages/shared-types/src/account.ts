import { z } from "zod";
import { password } from "./field.js";

/**
 * DiceBear styles people can pick from (the ids of @dicebear/collection v9).
 * `initials` is left out: it draws letters from the seed, and seeds are random.
 * The frontend renders these; the api only stores and checks the id.
 */
export const AVATAR_STYLES = [
  "adventurer",
  "adventurerNeutral",
  "avataaars",
  "avataaarsNeutral",
  "bigEars",
  "bigEarsNeutral",
  "bigSmile",
  "bottts",
  "botttsNeutral",
  "croodles",
  "croodlesNeutral",
  "dylan",
  "funEmoji",
  "glass",
  "icons",
  "identicon",
  "lorelei",
  "loreleiNeutral",
  "micah",
  "miniavs",
  "notionists",
  "notionistsNeutral",
  "openPeeps",
  "personas",
  "pixelArt",
  "pixelArtNeutral",
  "rings",
  "shapes",
  "thumbs",
  "toonHead",
] as const;
export const AvatarStyleSchema = z.enum(AVATAR_STYLES, {
  error: "Pick one of the avatar styles",
});
export type AvatarStyle = z.infer<typeof AvatarStyleSchema>;

/** A style plus the seed that picks one face in it. Same seed, same face, everywhere. */
export const AvatarSchema = z.object({
  style: AvatarStyleSchema,
  seed: z
    .string()
    .trim()
    .min(1, "Pick an avatar")
    .max(64, "Use at most 64 characters"),
});
export type Avatar = z.infer<typeof AvatarSchema>;

const name = (what: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${what}`)
    .max(80, "Use at most 80 characters");

/** The name form on the account page. */
export const ProfileNameSchema = z.object({
  firstName: name("first name"),
  lastName: name("last name"),
});
export type ProfileNameInput = z.infer<typeof ProfileNameSchema>;

/** PATCH /account/profile : any of these; at least one. */
export const UpdateProfileSchema = ProfileNameSchema.partial()
  .extend({ avatar: AvatarSchema.optional() })
  .refine(
    (v) =>
      v.firstName !== undefined ||
      v.lastName !== undefined ||
      v.avatar !== undefined,
    {
      message: "Nothing to update",
    },
  );
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

/** POST /account/password : for people who already have a password. */
export const ChangePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Enter your current password")
      .max(72, "Use at most 72 characters"),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "Choose a password different from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** POST /account/password/set : GitHub/Google users adding a first password, with the emailed code. */
export const SetPasswordSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: password,
});
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;

/** GET /account/sessions */
export const SessionsSummarySchema = z.object({
  /** Signed-in sessions other than this one (other browsers, other devices). */
  others: z.number().int(),
});
export type SessionsSummary = z.infer<typeof SessionsSummarySchema>;
