import { z } from "zod";

export const email = z.string().trim().toLowerCase().email();
export const password = z.string().min(8).max(72);
export const environmentName = z.string().trim().toLowerCase().min(1).max(40);
