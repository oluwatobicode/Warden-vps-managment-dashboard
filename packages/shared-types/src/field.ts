import { z } from "zod";

export const email = z.string().trim().toLowerCase().email();
export const password = z.string().min(8).max(72);
