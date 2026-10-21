import type { NotificationEvent } from "shared-types";
import {
  badge,
  button,
  detailsPanel,
  esc,
  font,
  formatDateTime,
  heading,
  palette,
  paragraph,
  shell,
} from "./layout.js";

// ─── What each event needs to say ───────────────────────────────────────────
// Optional fields are skipped (no empty rows) when the caller doesn't have them.

export interface DeployEventPayload {
  organizationName: string;
  projectName: string;
  environmentName: string;
  serviceName: string;
  deploymentNumber: number;
  branch?: string | null;
  commitSha?: string | null;
  commitMessage?: string | null;
  triggeredBy?: string | null;
  serverName?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  /** Why it failed / was cancelled / rolled back: the latest DeploymentHistory.message. */
  reason?: string | null;
  /** Where "View deploy" goes. No url → no button. */
  url?: string;
}

export interface ServerEventPayload {
  organizationName: string;
  serverName: string;
  serverIp: string;
  /** When this event was detected. */
  at: Date;
  /** Last successful contact before this event. */
  lastSeenAt?: Date | null;
  reason?: string | null;
  url?: string;
}

export interface DiskHighEventPayload extends ServerEventPayload {
  diskUsagePercent: number;
  thresholdPercent: number;
}

export interface BackupFailedEventPayload {
  organizationName: string;
  projectName: string;
  databaseName: string;
  engine: string;
  serverName?: string | null;
  at: Date;
  reason?: string | null;
  url?: string;
}

export interface MemberEventPayload {
  organizationName: string;
  memberName: string;
  memberEmail: string;
  roleLabel: string;
  /** Who invited (joined) or removed (removed) them. */
  by?: string | null;
  at: Date;
  url?: string;
}

export interface EventPayloads {
  "deploy.started": DeployEventPayload;
  "deploy.succeeded": DeployEventPayload;
  "deploy.failed": DeployEventPayload;
  "deploy.gate_failed": DeployEventPayload;
  "deploy.rolled_back": DeployEventPayload;
  "deploy.cancelled": DeployEventPayload;
  "server.offline": ServerEventPayload;
  "server.recovered": ServerEventPayload;
  "server.disk_high": DiskHighEventPayload;
  "docker.cleanup_failed": ServerEventPayload;
  "database.backup_failed": BackupFailedEventPayload;
  "member.joined": MemberEventPayload;
  "member.removed": MemberEventPayload;
}

export interface RenderedMessage {
  subject: string;
  preheader: string;
  /** Email body. */
  html: string;
  /** Slack/Discord message, and the plain-text part of every email. */
  text: string;
}

export interface RenderOptions {
  /** Named in the email footer: why this inbox got it. */
  channelName?: string;
  appName?: string;
}

// ─── The 12 messages ────────────────────────────────────────────────────────
// Specs hold PLAIN text; build() escapes everything for HTML in one place.

type Tone = "success" | "danger" | "warning" | "info";

interface Spec {
  tone: Tone;
  badge: string;
  subject: string;
  heading: string;
  summary: string;
  reason?: string | null;
  reasonLabel?: string;
  rows: Array<[label: string, value: string | null | undefined]>;
  button?: { label: string; url?: string };
}

const deployRows = (p: DeployEventPayload, withDuration = true): Spec["rows"] => [
  ["Service", p.serviceName],
  ["Environment", `${p.projectName} / ${p.environmentName}`],
  ["Deploy", `#${p.deploymentNumber}`],
  ["Branch", p.branch],
  ["Commit", commit(p.commitSha, p.commitMessage)],
  ["Server", p.serverName],
  ["Triggered by", p.triggeredBy],
  ["Duration", withDuration ? duration(p.startedAt, p.finishedAt) : null],
];

const target = (p: DeployEventPayload) => `${p.serviceName} (${p.environmentName})`;
const viewDeploy = (p: DeployEventPayload) => ({ label: "View deploy", url: p.url });

const serverRows = (p: ServerEventPayload): Spec["rows"] => [
  ["Server", p.serverName],
  ["Address", p.serverIp],
];
const viewServer = (p: ServerEventPayload) => ({ label: "View server", url: p.url });

const RENDERERS: { [E in NotificationEvent]: (p: EventPayloads[E]) => Spec } = {
  "deploy.started": (p) => ({
    tone: "info",
    badge: "Deploy started",
    subject: `Deploy #${p.deploymentNumber} started: ${target(p)}`,
    heading: `Deploying ${p.serviceName}`,
    summary: `Deploy #${p.deploymentNumber} of ${p.serviceName} to ${p.projectName} / ${p.environmentName} has left the queue and is building now.`,
    rows: deployRows(p, false),
    button: viewDeploy(p),
  }),

  "deploy.succeeded": (p) => ({
    tone: "success",
    badge: "Deploy succeeded",
    subject: `Deploy #${p.deploymentNumber} succeeded: ${target(p)}`,
    heading: `${p.serviceName} is live`,
    summary: `Deploy #${p.deploymentNumber} passed its health check and is now serving traffic in ${p.environmentName}.`,
    rows: deployRows(p),
    button: viewDeploy(p),
  }),

  "deploy.failed": (p) => ({
    tone: "danger",
    badge: "Deploy failed",
    subject: `Deploy #${p.deploymentNumber} failed: ${target(p)}`,
    heading: `Deploy #${p.deploymentNumber} of ${p.serviceName} failed`,
    summary: `The deploy stopped before the new version went live in ${p.environmentName}.`,
    reason: p.reason,
    reasonLabel: "Error",
    rows: deployRows(p),
    button: viewDeploy(p),
  }),

  "deploy.gate_failed": (p) => ({
    tone: "danger",
    badge: "Health check failed",
    subject: `Health check failed: ${target(p)}, deploy #${p.deploymentNumber}`,
    heading: `${p.serviceName} failed its health check`,
    summary: `Deploy #${p.deploymentNumber} built and started, but didn't pass its health check, so traffic was never switched to it.`,
    reason: p.reason,
    reasonLabel: "Health check",
    rows: deployRows(p),
    button: viewDeploy(p),
  }),

  "deploy.rolled_back": (p) => ({
    tone: "warning",
    badge: "Rolled back",
    subject: `Rolled back: ${target(p)}`,
    heading: `${p.serviceName} was rolled back`,
    summary: `Deploy #${p.deploymentNumber} put an earlier version of ${p.serviceName} back in ${p.environmentName}.`,
    reason: p.reason,
    reasonLabel: "Reason",
    rows: deployRows(p),
    button: viewDeploy(p),
  }),

  "deploy.cancelled": (p) => ({
    tone: "warning",
    badge: "Deploy cancelled",
    subject: `Deploy #${p.deploymentNumber} cancelled: ${target(p)}`,
    heading: `Deploy #${p.deploymentNumber} was cancelled`,
    summary: `Deploy #${p.deploymentNumber} of ${p.serviceName} was stopped before it went live. Nothing changed in ${p.environmentName}.`,
    reason: p.reason,
    reasonLabel: "Reason",
    rows: deployRows(p),
    button: viewDeploy(p),
  }),

  "server.offline": (p) => ({
    tone: "danger",
    badge: "Server offline",
    subject: `Server offline: ${p.serverName}`,
    heading: `${p.serverName} is unreachable`,
    summary: `Warden lost contact with ${p.serverName} (${p.serverIp}). Services running on it may be down.`,
    reason: p.reason,
    reasonLabel: "Last error",
    rows: [
      ...serverRows(p),
      ["Last seen", p.lastSeenAt ? formatDateTime(p.lastSeenAt) : null],
      ["Detected", formatDateTime(p.at)],
    ],
    button: viewServer(p),
  }),

  "server.recovered": (p) => ({
    tone: "success",
    badge: "Back online",
    subject: `Server back online: ${p.serverName}`,
    heading: `${p.serverName} is back online`,
    summary: `Warden can reach ${p.serverName} (${p.serverIp}) again.`,
    rows: [
      ...serverRows(p),
      ["Down for", duration(p.lastSeenAt, p.at)],
      ["Recovered", formatDateTime(p.at)],
    ],
    button: viewServer(p),
  }),

  "server.disk_high": (p) => ({
    tone: "warning",
    badge: "Disk almost full",
    subject: `Disk ${Math.round(p.diskUsagePercent)}% full: ${p.serverName}`,
    heading: `${p.serverName} disk is ${Math.round(p.diskUsagePercent)}% full`,
    summary: `Disk use on ${p.serverName} passed the ${Math.round(p.thresholdPercent)}% limit. Deploys can fail once the disk fills up; a Docker cleanup usually frees space.`,
    rows: [
      ...serverRows(p),
      ["Disk used", `${Math.round(p.diskUsagePercent)}%`],
      ["Limit", `${Math.round(p.thresholdPercent)}%`],
      ["Detected", formatDateTime(p.at)],
    ],
    button: viewServer(p),
  }),

  "docker.cleanup_failed": (p) => ({
    tone: "danger",
    badge: "Cleanup failed",
    subject: `Docker cleanup failed: ${p.serverName}`,
    heading: `Docker cleanup failed on ${p.serverName}`,
    summary: `The scheduled cleanup of unused images and build cache didn't finish, so no disk space was freed.`,
    reason: p.reason,
    reasonLabel: "Error",
    rows: [...serverRows(p), ["When", formatDateTime(p.at)]],
    button: viewServer(p),
  }),

  "database.backup_failed": (p) => ({
    tone: "danger",
    badge: "Backup failed",
    subject: `Backup failed: ${p.databaseName}`,
    heading: `The backup of ${p.databaseName} didn't finish`,
    summary: `Warden couldn't back up this ${p.engine} database, so the latest copy is older than planned. The previous backups are still kept.`,
    reason: p.reason,
    reasonLabel: "Error",
    rows: [
      ["Database", p.databaseName],
      ["Project", p.projectName],
      ["Server", p.serverName ?? null],
      ["When", formatDateTime(p.at)],
    ],
    button: p.url ? { label: "View database", url: p.url } : undefined,
  }),

  "member.joined": (p) => ({
    tone: "info",
    badge: "New member",
    subject: `${p.memberName} joined ${p.organizationName}`,
    heading: `${p.memberName} joined ${p.organizationName}`,
    summary: `${p.memberName} accepted an invite and joined as ${p.roleLabel}.`,
    rows: [
      ["Member", p.memberName],
      ["Email", p.memberEmail],
      ["Role", p.roleLabel],
      ["Invited by", p.by],
      ["Joined", formatDateTime(p.at)],
    ],
    button: { label: "View team", url: p.url },
  }),

  "member.removed": (p) => ({
    tone: "warning",
    badge: "Member removed",
    subject: `${p.memberName} was removed from ${p.organizationName}`,
    heading: `${p.memberName} was removed`,
    summary: `${p.memberName} no longer has access to ${p.organizationName}. Their sessions were ended on every device.`,
    rows: [
      ["Member", p.memberName],
      ["Email", p.memberEmail],
      ["Previous role", p.roleLabel],
      ["Removed by", p.by],
      ["When", formatDateTime(p.at)],
    ],
    button: { label: "View team", url: p.url },
  }),
};

/** Turn an event + its data into an email (html + text) and a chat message (text). */
export function renderEvent<E extends NotificationEvent>(
  event: E,
  payload: EventPayloads[E],
  opts: RenderOptions = {},
): RenderedMessage {
  // TypeScript can't link RENDERERS[event] to EventPayloads[event] on its own.
  const spec = (RENDERERS[event] as (p: EventPayloads[E]) => Spec)(payload);
  const footer = opts.channelName
    ? `You received this because the "${opts.channelName}" notification channel in ${payload.organizationName} listens for ${event}.`
    : `You received this because ${payload.organizationName} has notifications on for ${event}.`;
  return build(spec, footer, opts.appName);
}

/** The "Send test" message: same look as a real alert. */
export function renderTestMessage(input: {
  channelName: string;
  organizationName: string;
  appName?: string;
}): RenderedMessage {
  const spec: Spec = {
    tone: "success",
    badge: "Test notification",
    subject: `Test notification: ${input.channelName}`,
    heading: "Notifications are working",
    summary: `This is a test from the "${input.channelName}" channel in ${input.organizationName}. Real alerts will arrive here when the events it listens for happen.`,
    rows: [],
  };
  const rendered = build(
    spec,
    `You received this because someone pressed "Send test" on the "${input.channelName}" channel in ${input.organizationName}.`,
    input.appName,
  );
  // Chat keeps the short one-liner.
  return {
    ...rendered,
    text: `✅ Test from Warden: notifications for "${input.channelName}" are working.`,
  };
}

// ─── Building ───────────────────────────────────────────────────────────────

const TONE: Record<Tone, { color: string; icon: string; emoji: string }> = {
  success: { color: palette.success, icon: "&#10003;", emoji: "✅" },
  danger: { color: palette.danger, icon: "&#215;", emoji: "❌" },
  warning: { color: palette.warning, icon: "!", emoji: "⚠️" },
  info: { color: palette.muted, icon: "&#8226;", emoji: "ℹ️" },
};

const MAX_REASON = 500;

function build(spec: Spec, footer: string, appName = "Warden"): RenderedMessage {
  const tone = TONE[spec.tone];
  const rows = spec.rows.filter(
    (r): r is [string, string] => r[1] != null && r[1] !== "",
  );
  const reason = spec.reason ? clip(spec.reason, MAX_REASON) : null;
  const url = spec.button?.url;
  const preheader = clip(spec.summary, 90);

  const body = [
    badge(`${tone.icon}&nbsp;&nbsp;${esc(spec.badge)}`, tone.color),
    heading(esc(spec.heading)),
    paragraph(esc(spec.summary)),
    reason ? reasonPanel(spec.reasonLabel ?? "Reason", reason, tone.color) : "",
    rows.length ? detailsPanel(rows.map(([k, v]) => [esc(k), esc(v)])) : "",
    spec.button && url ? button(esc(spec.button.label), url) : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = shell({
    title: esc(spec.subject),
    preheader: esc(preheader),
    body,
    reason: esc(footer),
    appName,
  });

  const text = [
    `${tone.emoji} ${spec.subject}`,
    spec.summary,
    reason ? `${spec.reasonLabel ?? "Reason"}: ${reason}` : null,
    rows.length ? rows.map(([k, v]) => `${k}: ${v}`).join("\n") : null,
    url ?? null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: spec.subject, preheader, html, text };
}

/** Error text in a monospace box; the label carries the tone colour. */
function reasonPanel(label: string, text: string, color: string): string {
  return `<tr><td style="padding:0 0 20px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${palette.panel}" style="background:${palette.panel};border:1px solid ${palette.border};border-radius:14px;">
<tr><td style="padding:12px 16px 4px 16px;font-family:${font.body};font-size:12px;line-height:16px;mso-line-height-rule:exactly;font-weight:600;color:${color};">${esc(label)}</td></tr>
<tr><td style="padding:0 16px 12px 16px;font-family:${font.mono};font-size:12px;line-height:19px;mso-line-height-rule:exactly;color:${palette.body};word-break:break-word;white-space:pre-wrap;">${esc(text)}</td></tr>
</table></td></tr>`;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** "a1b2c3d · Fix login redirect" — first line of the message only. */
function commit(sha?: string | null, message?: string | null): string | null {
  if (!sha) return null;
  const short = sha.slice(0, 7);
  const first = message?.split("\n")[0].trim();
  return first ? `${short} · ${clip(first, 72)}` : short;
}

/** "45s", "3m", "3m 12s", "2h 5m". null unless both ends are known. */
function duration(from?: Date | null, to?: Date | null): string | null {
  if (!from || !to) return null;
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m}m ${s % 60}s` : `${m}m`;
  return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
}
