import { prisma } from "db";
import { renderEvent, sendDiscord, sendEmail, sendSlack, type EventPayloads } from "notifier";
import type { NotificationEvent } from "shared-types";
import { env } from "./env";
import { unseal } from "./keys";
import { log } from "./log";

/**
 * Send one event to every enabled channel of the org that listens for it.
 * A failing channel is logged and skipped; it never fails the job that
 * noticed the event. Webhook URLs are decrypted only to send, never logged.
 */
export async function notify<E extends NotificationEvent>(organizationId: string, event: E, payload: EventPayloads[E]): Promise<void> {
  const channels = await prisma.notificationChannel.findMany({
    where: { organizationId, enabled: true, events: { has: event } },
  });
  for (const ch of channels) {
    if (env.NOTIFY_DRY_RUN) {
      log.info(`[dry run] would send ${event} to ${ch.type} channel "${ch.name}"`);
      continue;
    }
    try {
      const msg = renderEvent(event, payload, { channelName: ch.name });
      const result =
        ch.type === "EMAIL"
          ? await sendEmail({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM }, ch.emailRecipients, msg.subject, msg.text, msg.html)
          : ch.type === "SLACK"
            ? await sendSlack(await unseal(organizationId, ch.webhookUrlEncrypted!), msg.text)
            : await sendDiscord(await unseal(organizationId, ch.webhookUrlEncrypted!), msg.text);
      if (!result.ok) log.warn(`${event} → ${ch.type} "${ch.name}" not delivered: ${result.reason}`);
    } catch (e) {
      log.warn(`${event} → ${ch.type} "${ch.name}" failed: ${(e as Error).message}`);
    }
  }
}

/** "View server" link for alerts, when the dashboard's address is known. */
export const serverUrl = (serverId: string) => (env.APP_URL ? `${env.APP_URL.replace(/\/$/, "")}/settings/servers/${serverId}` : undefined);
