/**
 * Renders every notification email with sample data so you can look at them.
 *   pnpm --filter notifier preview <out-dir>
 * Writes one .html per event plus index.html (a gallery). Sample data only.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NotificationEventSchema } from "shared-types";
import { renderEvent, renderTestMessage, type EventPayloads } from "../src/index";

const out = resolve(process.argv[2] ?? "email-preview");
mkdirSync(out, { recursive: true });

const now = new Date();
const mins = (n: number) => new Date(now.getTime() - n * 60_000);

const deploy = {
  organizationName: "Acme",
  projectName: "Argus",
  environmentName: "production",
  serviceName: "api",
  deploymentNumber: 42,
  branch: "main",
  commitSha: "a1b2c3d4e5f6a7b8c9d0",
  commitMessage: "Fix login redirect after OAuth callback",
  triggeredBy: "tobi@acme.dev",
  serverName: "warden-gcp",
  startedAt: mins(3),
  finishedAt: now,
  url: "https://warden.example/deployments/42",
};
const server = {
  organizationName: "Acme",
  serverName: "warden-gcp",
  serverIp: "34.141.20.7",
  at: now,
  lastSeenAt: mins(18),
  url: "https://warden.example/servers/1",
};
const member = { organizationName: "Acme", memberName: "Ada Obi", memberEmail: "ada@acme.dev", roleLabel: "Developer", by: "Tobi Odetokun", at: now, url: "https://warden.example/team" };

const SAMPLES: EventPayloads = {
  "deploy.started": { ...deploy, finishedAt: null },
  "deploy.succeeded": deploy,
  "deploy.failed": { ...deploy, reason: "npm ERR! Missing script: \"build\"\nexit code 1 at step 4/7 (RUN npm run build)" },
  "deploy.gate_failed": { ...deploy, reason: "GET /health returned 503 three times in 30s" },
  "deploy.rolled_back": { ...deploy, deploymentNumber: 43, reason: "Rolled back by tobi@acme.dev: error rate spiked after #42" },
  "deploy.cancelled": { ...deploy, reason: "Cancelled by tobi@acme.dev while building" },
  "server.offline": { ...server, reason: "ssh: connect to host 34.141.20.7 port 22: Connection timed out" },
  "server.recovered": server,
  "server.disk_high": { ...server, diskUsagePercent: 91.4, thresholdPercent: 85 },
  "docker.cleanup_failed": { ...server, reason: "Error response from daemon: a prune operation is already running" },
  "member.joined": member,
  "member.removed": member,
};

const cards: string[] = [];
for (const event of NotificationEventSchema.options) {
  const m = renderEvent(event, SAMPLES[event] as never, { channelName: "oncall-email" });
  writeFileSync(join(out, `${event}.html`), m.html);
  writeFileSync(join(out, `${event}.txt`), m.text);
  cards.push(card(event, m.subject, m.text));
}
const t = renderTestMessage({ channelName: "oncall-email", organizationName: "Acme" });
writeFileSync(join(out, "test-message.html"), t.html);
cards.push(card("test-message", t.subject, t.text));

writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Warden emails</title>
<style>body{background:#111;color:#ddd;font:14px system-ui;margin:24px}h1{font-size:18px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(620px,1fr));gap:24px}
.c{background:#181818;border:1px solid #2a2a2a;border-radius:12px;padding:12px}
.c b{display:block;margin-bottom:4px}.c small{color:#888}
iframe{width:100%;height:760px;border:0;border-radius:8px;margin-top:8px;background:#080808}
pre{white-space:pre-wrap;background:#0c0c0c;padding:10px;border-radius:8px;color:#aaa;font-size:12px}</style>
<h1>Warden notification emails (sample data)</h1><div class="g">${cards.join("")}</div>`,
);
console.log(`Wrote ${cards.length} previews to ${out}/index.html`);

function card(name: string, subject: string, text: string) {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<div class="c"><b>${e(subject)}</b><small>${name}</small>
<iframe src="${name}.html"></iframe><details><summary>Slack / Discord text</summary><pre>${e(text)}</pre></details></div>`;
}
