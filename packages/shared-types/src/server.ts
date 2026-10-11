import { z } from "zod";
import { slugName } from "./field.js";

// Mirror Prisma's enums exactly. Exported for the frontend's dropdowns.
export const ServerTypeSchema = z.enum(["BUILD", "DEPLOY"]);
export type ServerType = z.infer<typeof ServerTypeSchema>;
export const ServerStatusSchema = z.enum(["CONNECTED", "IDLE", "OFFLINE"]);
export type ServerStatus = z.infer<typeof ServerStatusSchema>;

// ---------------------------------------------------------------------------
// Input fields — validate here so a typo is a 400, not an "unreachable" later.
// ---------------------------------------------------------------------------
const serverIp = z.union([z.ipv4(), z.ipv6(), z.hostname()]);
const serverPort = z.number().int().min(1).max(65535);
// Linux usernames: lowercase start, then letters/digits/_/-. Catches "Root".
const serverSSHUsername = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z_][a-z0-9_-]*$/, {
    message: "Use a Linux username: lowercase letters, digits, _ or -",
  });
const label = z.string().trim().min(1).max(60); // display-only text

// POST /servers — defaults live HERE, on create only.
export const CreateServerSchema = z.object({
  serverName: slugName, // rejects bad names instead of silently rewriting them
  serverIp,
  serverPort: serverPort.default(22),
  serverSSHUsername,
  serverSshKeyId: z.string().uuid(),
  serverType: ServerTypeSchema.default("DEPLOY"),
  provider: label.optional(), // same name as the DB column — no translation step
  serverLocation: label.optional(),
});
export type CreateServerInput = z.infer<typeof CreateServerSchema>;

// PATCH /servers/:id — NO defaults. With .partial() a default would still fire,
// so a body of { serverName } would silently reset the port to 22.
// Absent = leave alone; null clears the two optional labels.
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

// ---------------------------------------------------------------------------
// Response — a DESCRIPTION, so no trim/min/default. Field names match the DB.
// Never carries any part of the private key.
// ---------------------------------------------------------------------------
export const ServerSchema = z.object({
  id: z.string(),
  serverName: z.string(),
  serverIp: z.string(),
  serverPort: z.number().int(),
  serverSSHUsername: z.string(),
  serverType: ServerTypeSchema,
  status: ServerStatusSchema, // OFFLINE until a test connection proves otherwise
  provider: z.string().nullable(),
  serverLocation: z.string().nullable(),
  sshKey: z.object({ id: z.string(), sshKeyName: z.string(), fingerprint: z.string() }),
  serviceCount: z.number().int(),
  lastSeenAt: z.iso.datetime().nullable(), // null until the first successful test
  createdAt: z.iso.datetime(),
});
export type Server = z.infer<typeof ServerSchema>;
