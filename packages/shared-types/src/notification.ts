import { z } from "zod";
import { email } from "./field.js";

export const NotificationChannelTypeSchema = z.enum([
  "SLACK",
  "DISCORD",
  "EMAIL",
]);
export type NotificationChannelType = z.infer<
  typeof NotificationChannelTypeSchema
>;

const WEBHOOK_RULES = {
  SLACK: { hosts: ["hooks.slack.com"], path: "/services/" },
  DISCORD: {
    hosts: [
      "discord.com",
      "discordapp.com",
      "canary.discord.com",
      "ptb.discord.com",
    ],
    path: "/api/webhooks/",
  },
} as const;

/** Is `raw` a real Slack/Discord webhook URL? Blocks SSRF: the api will POST to it. */
export function isWebhookUrlFor(
  type: "SLACK" | "DISCORD",
  raw: string,
): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  const rule = WEBHOOK_RULES[type];
  return (
    u.protocol === "https:" &&
    (rule.hosts as readonly string[]).includes(u.hostname) &&
    u.port === "" &&
    u.username === "" &&
    u.password === "" &&
    u.pathname.startsWith(rule.path)
  );
}

export const NotificationEventSchema = z.enum([
  "deploy.started",
  "deploy.succeeded",
  "deploy.failed",
  "deploy.gate_failed",
  "deploy.rolled_back",
  "deploy.cancelled",
  "server.offline",
  "server.recovered",
  "server.disk_high",
  "docker.cleanup_failed",
  "member.joined",
  "member.removed",
]);
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

const events = z
  .array(NotificationEventSchema)
  .min(1, "Pick at least one event")
  .refine((a) => new Set(a).size === a.length, "Each event only once");

const name = z.string().trim().min(1).max(60);

const webhookUrl = (type: "SLACK" | "DISCORD") =>
  z
    .string()
    .trim()
    .refine((u) => isWebhookUrlFor(type, u), {
      message:
        type === "SLACK"
          ? "Must be a Slack webhook (https://hooks.slack.com/services/…)"
          : "Must be a Discord webhook (https://discord.com/api/webhooks/…)",
    });

const emailRecipients = z.array(email).min(1).max(20);

export const CreateNotificationChannelSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SLACK"),
    name,
    events,
    webhookUrl: webhookUrl("SLACK"),
  }),
  z.object({
    type: z.literal("DISCORD"),
    name,
    events,
    webhookUrl: webhookUrl("DISCORD"),
  }),
  z.object({ type: z.literal("EMAIL"), name, events, emailRecipients }),
]);
export type CreateNotificationChannelInput = z.infer<
  typeof CreateNotificationChannelSchema
>;

export const UpdateNotificationChannelSchema = z
  .object({
    name: name.optional(),
    enabled: z.boolean().optional(),
    events: events.optional(),
    webhookUrl: z.string().trim().optional(),
    emailRecipients: emailRecipients.optional(),
  })
  .strict();
export type UpdateNotificationChannelInput = z.infer<
  typeof UpdateNotificationChannelSchema
>;

export const NotificationChannelSchema = z.object({
  id: z.string(),
  type: NotificationChannelTypeSchema,
  name: z.string(),
  enabled: z.boolean(),
  events: z.array(NotificationEventSchema),
  webhookUrlMasked: z.string().nullable(),
  emailRecipients: z.array(z.string()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const RevealedWebhookSchema = z.object({ webhookUrl: z.string() });
export type RevealedWebhook = z.infer<typeof RevealedWebhookSchema>;

export const NotificationTestResultSchema = z.object({
  ok: z.boolean(),
  reason: z
    .enum(["timeout", "unreachable", "rejected", "not_configured"])
    .optional(),
  status: z.number().optional(),
});
export type NotificationTestResult = z.infer<
  typeof NotificationTestResultSchema
>;
