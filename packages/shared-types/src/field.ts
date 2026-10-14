import { z } from "zod";

export const email = z.string().trim().toLowerCase().email("Enter a valid email address");
export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters");
// Slug-safe name shared by environments and services: both end up in container
// names and URLs, so only lowercase letters, digits and single dashes, no
// leading/trailing dash.
export const slugName = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Required")
  .max(40, "Use at most 40 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, digits and dashes only (e.g. qa-2, preview)",
  });
