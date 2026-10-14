import { isWebhookUrlFor } from "shared-types";

export type NotifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "timeout" | "unreachable" | "rejected" | "not_configured";
      status?: number;
    };

const TIMEOUT_MS = 5_000;

async function post(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<NotifyResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      redirect: "error", // never follow a redirect to somewhere else
      signal: AbortSignal.timeout(TIMEOUT_MS), // never hang a request waiting on Slack
    });
    return res.ok
      ? { ok: true }
      : { ok: false, reason: "rejected", status: res.status };
  } catch (e) {
    const name = (e as Error).name;
    return {
      ok: false,
      reason: name === "TimeoutError" ? "timeout" : "unreachable",
    };
  }
}

export function sendSlack(
  webhookUrl: string,
  text: string,
): Promise<NotifyResult> {
  if (!isWebhookUrlFor("SLACK", webhookUrl))
    return Promise.resolve({ ok: false, reason: "rejected" });
  return post(webhookUrl, { text });
}

export function sendDiscord(
  webhookUrl: string,
  text: string,
): Promise<NotifyResult> {
  if (!isWebhookUrlFor("DISCORD", webhookUrl))
    return Promise.resolve({ ok: false, reason: "rejected" });
  return post(webhookUrl, { content: text.slice(0, 2000), username: "Warden" });
}

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export function sendEmail(
  config: EmailConfig,
  to: string[],
  subject: string,
  text: string,
  html?: string,
): Promise<NotifyResult> {
  if (!config.apiKey)
    return Promise.resolve({ ok: false, reason: "not_configured" });
  return post(
    "https://api.resend.com/emails",
    { from: config.from, to, subject, text, ...(html && { html }) },
    { authorization: `Bearer ${config.apiKey}` },
  );
}
