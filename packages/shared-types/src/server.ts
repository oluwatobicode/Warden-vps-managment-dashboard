import { z } from "zod";
import { slugName } from "./field.js";

export const ServerTypeSchema = z.enum(["BUILD", "DEPLOY"]);
export type ServerType = z.infer<typeof ServerTypeSchema>;
export const ServerStatusSchema = z.enum(["CONNECTED", "IDLE", "OFFLINE"]);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

const serverIp = z.union([z.ipv4(), z.ipv6(), z.hostname()]);
const serverPort = z.number().int().min(1).max(65535);
const serverSSHUsername = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z_][a-z0-9_-]*$/, {
    message: "Use a Linux username: lowercase letters, digits, _ or -",
  });
const label = z.string().trim().min(1).max(60);

export const CreateServerSchema = z.object({
  serverName: slugName,
  serverIp,
  serverPort: serverPort.default(22),
  serverSSHUsername,
  serverSshKeyId: z.string().uuid(),
  serverType: ServerTypeSchema.default("DEPLOY"),
  provider: label.optional(),
  serverLocation: label.optional(),
});
export type CreateServerInput = z.infer<typeof CreateServerSchema>;

export const UpdateServerSchema = z.object({
  serverName: slugName.optional(),
  serverIp: serverIp.optional(),
  serverPort: serverPort.optional(),
  serverSSHUsername: serverSSHUsername.optional(),
  serverSshKeyId: z.string().uuid().optional(),
  provider: label.nullish(),
  serverLocation: label.nullish(),
});
export type UpdateServerInput = z.infer<typeof UpdateServerSchema>;

export const ServerSchema = z.object({
  id: z.string(),
  serverName: z.string(),
  serverIp: z.string(),
  serverPort: z.number().int(),
  serverSSHUsername: z.string(),
  serverType: ServerTypeSchema,
  status: ServerStatusSchema,
  provider: z.string().nullable(),
  serverLocation: z.string().nullable(),
  sshKey: z.object({
    id: z.string(),
    sshKeyName: z.string(),
    fingerprint: z.string(),
  }),
  serviceCount: z.number().int(),
  lastSeenAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type Server = z.infer<typeof ServerSchema>;

export const ConnectionStepNameSchema = z.enum([
  "reach",
  "login",
  "system",
  "docker",
]);
export type ConnectionStepName = z.infer<typeof ConnectionStepNameSchema>;

export const ConnectionStepSchema = z.object({
  name: ConnectionStepNameSchema,
  ok: z.boolean(),
  detail: z.string().optional(),
});

export type ConnectionStep = z.infer<typeof ConnectionStepSchema>;

export const ConnectionTestSchema = z.object({
  ok: z.boolean(),
  steps: z.array(ConnectionStepSchema),
});

export type ConnectionTest = z.infer<typeof ConnectionTestSchema>;
