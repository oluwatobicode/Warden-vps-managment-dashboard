import { z } from "zod";
import { slugName } from "./field.js";

export const CreateSshKeySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("generate"),
    sshKeyName: slugName,
  }),
  z.object({
    mode: z.literal("import"),
    sshKeyName: slugName,
    privateKey: z.string().trim().min(1).max(16_000),
  }),
]);
export type CreateSshKeyInput = z.infer<typeof CreateSshKeySchema>;

export const SshKeySchema = z.object({
  id: z.string(),
  sshKeyName: z.string(),
  publicKey: z.string(),
  fingerprint: z.string(),
  serverCount: z.number().int(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});
export type SshKey = z.infer<typeof SshKeySchema>;
