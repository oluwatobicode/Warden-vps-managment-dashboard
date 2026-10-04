import { z } from "zod";

export const email = z.string().trim().toLowerCase().email();
export const password = z.string().min(8).max(72);
// Slug-safe name shared by environments and services: both end up in container
// names and URLs, so only lowercase letters, digits and single dashes, no
// leading/trailing dash.
export const slugName = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Use lowercase letters, digits and dashes only (e.g. qa-2, preview)",
  });
