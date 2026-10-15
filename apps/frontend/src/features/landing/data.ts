import { TONE } from "./tone";

/**
 * Everything the landing page says, in one place, so copy changes don't mean
 * digging through markup. All of it is illustrative demo content.
 */

export const NAV_LINKS = [
  { href: "#deploys", label: "Product", menu: true },
  { href: "#how", label: "How it works" },
  { href: "#docs", label: "Docs", menu: true },
  { href: "#changelog", label: "Changelog" },
  { href: "#github", label: "GitHub" },
];

export const HERO_TAGS = ["DEPLOY #418", "BUILD 38.2S", "GATE 3 OF 3", "LIVE · LAG-01"];

export const SOURCES = [
  { id: "github", label: "From GitHub", placeholder: "github.com/you/app" },
  { id: "dockerfile", label: "Dockerfile", placeholder: "Paste a Dockerfile URL or path" },
  { id: "compose", label: "Compose file", placeholder: "Paste a docker-compose.yml URL" },
] as const;

export const WHY = {
  before: [
    "SSH in, git pull, rebuild and hope",
    "Users hit errors while containers restart",
    "A bad release means rebuilding an old commit",
    "Secrets live in a .env on someone’s laptop",
    "Nobody knows who changed what, or when",
  ],
  after: [
    "Push to main and Warden deploys it",
    "New container runs beside the old one until it’s healthy",
    "Previous images stay on disk for one-click rollback",
    "Variables encrypted per environment, never in git",
    "Every deploy, rollback and change is logged",
  ],
};

export const STEPS = [
  { name: "Push", text: "You push to main or open a pull request", code: "git push origin main", tone: "#e4f222", bg: "#121308", icon: "terminal" },
  { name: "Build", text: "The image builds on your build server", code: "fra-build · 38s", tone: TONE.good, bg: "#0a130c", icon: "box" },
  { name: "Health gates", text: "New container must pass every check", code: "3 of 3 passed", tone: TONE.violet, bg: "#120d1c", icon: "shield" },
  { name: "Live", text: "Traffic swaps over with zero downtime", code: "api.argus.ng", tone: TONE.run, bg: "#081316", icon: "globe" },
] as const;

export const DEPLOY_GROUPS = [
  { label: "Gating", tone: TONE.run, dashed: true, rows: [["#418", "cache warm before swap", "api"]] },
  { label: "Live", tone: TONE.good, rows: [["#417", "rate limit public endpoints", "api"], ["#212", "pricing page copy", "web"]] },
  {
    label: "Superseded",
    tone: TONE.mute,
    rows: [["#416", "retry failed webhooks", "api"], ["#415", "upgrade to node 22", "api"], ["#211", "fix footer links", "web"]],
  },
];

/** The compose diff: [line number, text, change]. */
export const COMPOSE: Array<[string, string, "same" | "del" | "add"]> = [
  ["01", "services:", "same"],
  ["02", "  api:", "same"],
  ["03", "    image: argus-api:e91b04d", "del"],
  ["03", "    image: argus-api:7f3c2a1", "add"],
  ["04", "    restart: unless-stopped", "same"],
  ["05", "    healthcheck:", "same"],
  ["06", "      test: curl -f localhost:8080/healthz", "same"],
  ["07", "      interval: 5s", "del"],
  ["07", "      interval: 2s", "add"],
  ["08", "      retries: 5", "same"],
  ["09", "    environment:", "same"],
  ["10", "      - DATABASE_URL", "same"],
  ["11", "      - CACHE_WARM=true", "add"],
  ["12", "    labels:", "same"],
  ["13", "      - traefik.http.routers.api.rule=Host(api.argus.ng)", "same"],
];

export const GATE_FIGURES = [
  { fig: "FIG 0.1", title: "Container running", text: "Warden starts the new image beside the old one and waits for Docker to report it running." },
  { fig: "FIG 0.2", title: "HTTP health check", text: "Your health endpoint has to answer 200 five times in a row before anything moves." },
  { fig: "FIG 0.3", title: "Error-rate window", text: "Argus watches 5xx responses for 60 seconds. Above 1%, the deploy rolls back on its own." },
  { fig: "FIG 0.4", title: "Traffic swap", text: "Traefik routes requests to the new container. The old one stays on disk for instant rollback." },
];

export interface FleetServer {
  host: string;
  role: "Deploy" | "Build";
  tone: string;
  state: string;
  cpu: number;
  mem: number;
  disk: number;
  warning?: string;
  rows: Array<[string, string, string]>; // tone, name, right-hand note
}
export const FLEET: FleetServer[] = [
  {
    host: "ams-01",
    role: "Deploy",
    tone: TONE.crit,
    state: "Disk 91%",
    cpu: 47,
    mem: 62,
    disk: 91,
    warning: "Old images are using 18 GB. Run cleanup to free space.",
    rows: [[TONE.crit, "argus-ingest", "restarting"], [TONE.good, "postgres-replica", "12d"]],
  },
  {
    host: "lag-01",
    role: "Deploy",
    tone: TONE.good,
    state: "Connected",
    cpu: 34,
    mem: 58,
    disk: 42,
    rows: [[TONE.good, "argus-api-green", "2h"], [TONE.run, "argus-api-blue", "gating"], [TONE.good, "argus-web", "3d"], [TONE.good, "traefik", "21d"]],
  },
  {
    host: "fra-build",
    role: "Build",
    tone: TONE.run,
    state: "Building",
    cpu: 88,
    mem: 71,
    disk: 56,
    rows: [[TONE.run, "build · argus-worker:a1c9e02", "01:12"], [TONE.mute, "build · argus-web:d40f7b3", "queued"]],
  },
  {
    host: "lag-02",
    role: "Deploy",
    tone: TONE.good,
    state: "Connected",
    cpu: 21,
    mem: 40,
    disk: 37,
    rows: [[TONE.good, "argus-worker", "5h"], [TONE.good, "redis-cache", "21d"], [TONE.good, "postgres-main", "21d"]],
  },
];

export interface FeedEvent {
  init: string;
  bg: string;
  fg: string;
  who: string;
  time: string;
  hi?: string;
  hiTone?: string;
  rest: string;
}
export const FEED: FeedEvent[] = [
  { init: "AO", bg: "#d0d6e0", fg: "#08090a", who: "Adaeze", time: "14:02", rest: "Deployed #417 to production" },
  { init: "W", bg: "#23252a", fg: "#e5e5e6", who: "Warden", time: "14:08", hi: "#418 passed gate 2", hiTone: TONE.run, rest: " · checking error rate" },
  { init: "W", bg: "#23252a", fg: "#e5e5e6", who: "Warden", time: "14:09", hi: "#418 failed gate 3", hiTone: TONE.crit, rest: " with 5xx at 3.4%. Traffic stayed on #417." },
  { init: "DA", bg: TONE.violet, fg: "#ffffff", who: "Dami", time: "14:11", rest: "Set CACHE_WARM=true on staging" },
  { init: "TB", bg: "#e4f222", fg: "#08090a", who: "Tobi", time: "14:15", rest: "Ran cleanup on ams-01 and freed 18.2 GB" },
];

export const BOARD = [
  {
    label: "Building",
    tone: "#e4f222",
    dashed: true,
    cards: [
      { id: "#420 · worker", title: "retry failed webhooks", tag: "fra-build", tagTone: TONE.run },
      { id: "#213 · web", title: "new pricing table", tag: "staging", tagTone: TONE.violet },
    ],
  },
  { label: "Gating", tone: TONE.run, dashed: true, cards: [{ id: "#418 · api", title: "cache warm before swap", tag: "gate", tagTone: TONE.run }] },
  {
    label: "Live",
    tone: TONE.good,
    cards: [
      { id: "#417 · api", title: "rate limit public endpoints", tag: "lag-01", tagTone: TONE.good },
      { id: "#212 · web", title: "pricing page copy", tag: "lag-01", tagTone: TONE.good },
      { id: "#088 · worker", title: "queue backoff", tag: "lag-02", tagTone: TONE.good, faded: true },
    ],
  },
];

export const QUOTES = [
  {
    text: "“We moved six services off a PaaS onto two VPS boxes in an afternoon. Rollback went from a full redeploy to one button.”",
    init: "AO",
    name: "Adaeze Okafor",
    role: "CTO, Argus",
    bg: "linear-gradient(160deg, #dfe6ff, #ece6ff)",
    wide: true,
  },
  {
    text: "“The health gates caught a bad migration before a single user saw it.”",
    init: "TA",
    name: "Tobi Adeyemi",
    role: "Platform lead, Lumen",
    bg: "#e4f222",
  },
];

export const OPEN_SOURCE = [
  { title: "Auditable", text: "Every line that handles your SSH keys and secrets is public.", tone: "#6366f1", bg: "rgba(99,102,241,0.14)", icon: "lock" },
  { title: "Community driven", text: "Roadmap, issues and discussions all happen on GitHub.", tone: TONE.violet, bg: "rgba(139,92,246,0.14)", icon: "people" },
  { title: "Self-hosted", text: "Runs on your VPS. Code and secrets never leave it.", tone: TONE.good, bg: "rgba(39,166,68,0.14)", icon: "server" },
  { title: "Free forever", text: "Deploys, rollbacks and health gates stay free.", tone: TONE.crit, bg: "rgba(235,87,87,0.14)", icon: "heart" },
] as const;

export const CHANGELOG = [
  { title: "Preview environments", text: "Every pull request gets its own URL on a staging server, removed when the branch merges.", date: "OCT 6, 2026", latest: true },
  { title: "Cleanup with dry run", text: "See exactly which images, volumes and build cache will go before Warden deletes anything.", date: "SEP 22, 2026" },
  { title: "Magic-link sign in", text: "Sign in and accept invites with an email link. Password reset by one-time code still works.", date: "SEP 9, 2026" },
  { title: "Dedicated build servers", text: "Point builds at a separate machine so compiles never compete with production traffic.", date: "SEP 1, 2026" },
];

export const INSTALL_COMMAND = "curl -sSL get.warden.dev | sh";

/* The console preview under the hero (the design's screenshot, drawn live). */
export const CONSOLE = {
  services: [
    { name: "api", kind: "App", tone: TONE.run, on: true },
    { name: "web", kind: "App", tone: TONE.good },
    { name: "worker", kind: "Compose", tone: TONE.good },
    { name: "postgres-main", kind: "Postgres", tone: TONE.good },
    { name: "redis-cache", kind: "Redis", tone: TONE.good },
    { name: "ingest", kind: "App", tone: TONE.crit },
  ],
  gates: [
    { name: "Container up", state: "Passed", tone: TONE.good, icon: "ok", pct: 100 },
    { name: "GET /healthz → 200", state: "Checking 4 of 5", tone: TONE.run, icon: "run", pct: 72 },
    { name: "Argus error rate < 1%", state: "Waiting", tone: TONE.mute, icon: "wait", pct: 0 },
  ],
  logs: [
    ["14:08:02", "ssh deploy@lag-01 · connected", "#8a8f98"],
    ["14:08:03", "git fetch origin main → 7f3c2a1", "#8a8f98"],
    ["14:08:41", "build  ✓ image argus-api:7f3c2a1 (38.2s)", TONE.text],
    ["14:08:44", "start  argus-api-blue on :8081", TONE.text],
    ["14:08:46", "gate 1 ✓ container running", TONE.good],
    ["14:08:48", "gate 2 · GET /healthz 200 (41ms)  1/5", TONE.text],
    ["14:08:50", "gate 2 · GET /healthz 200 (38ms)  2/5", TONE.text],
    ["14:08:52", "gate 2 · GET /healthz 200 (44ms)  3/5", TONE.text],
    ["14:08:54", "gate 2 · GET /healthz 200 (39ms)  4/5", TONE.run],
    ["14:08:54", "traffic still on argus-api-green · waiting for gate 3", TONE.mute],
  ],
  servers: [
    { host: "lag-01", state: "Connected", tone: TONE.good, cpu: "34%", role: "Deploy · 6 containers" },
    { host: "lag-02", state: "Connected", tone: TONE.good, cpu: "21%", role: "Deploy · 4 containers" },
    { host: "fra-build", state: "Building", tone: TONE.run, cpu: "88%", role: "Build server" },
    { host: "ams-01", state: "Disk 91%", tone: TONE.crit, cpu: "47%", role: "Deploy · 3 containers" },
  ],
};
