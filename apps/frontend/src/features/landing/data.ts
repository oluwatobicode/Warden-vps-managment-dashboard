import expressLogo from "devicon/icons/express/express-original.svg";
import nestjsLogo from "devicon/icons/nestjs/nestjs-original.svg";
import nextjsLogo from "devicon/icons/nextjs/nextjs-original.svg";
import viteLogo from "devicon/icons/vitejs/vitejs-original.svg";
import pythonLogo from "devicon/icons/python/python-original.svg";
import fastapiLogo from "devicon/icons/fastapi/fastapi-original.svg";
import goLogo from "devicon/icons/go/go-original.svg";
import rubyLogo from "devicon/icons/ruby/ruby-original.svg";
import phpLogo from "devicon/icons/php/php-original.svg";
import rustLogo from "devicon/icons/rust/rust-original.svg";
import nuxtLogo from "devicon/icons/nuxtjs/nuxtjs-original.svg";
import svelteLogo from "devicon/icons/svelte/svelte-original.svg";
import astroLogo from "devicon/icons/astro/astro-original.svg";
import reactRouterLogo from "devicon/icons/reactrouter/reactrouter-original.svg";
import postgresLogo from "devicon/icons/postgresql/postgresql-original.svg";
import mysqlLogo from "devicon/icons/mysql/mysql-original.svg";
import redisLogo from "devicon/icons/redis/redis-original.svg";
import { TONE } from "./tone";

/**
 * Everything the landing page says, in one place, so copy changes don't mean
 * digging through markup. Names, numbers and logs are made-up demo content,
 * but every feature shown here exists in Warden today. Anything not built yet
 * is labelled "coming later".
 */

export const GITHUB_URL = "https://github.com/oluwatobicode/Warden-vps-managment-dashboard";

export const NAV_LINKS = [
  { href: "#deploys", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#stack", label: "What you can deploy" },
  { href: "#changelog", label: "Changelog" },
  { href: GITHUB_URL, label: "GitHub", external: true },
];

export const HERO_TAGS = ["DEPLOY #42", "BUILT WITH RAILPACK", "GET / → 200", "LIVE · 3 IMAGES KEPT"];

export const SOURCES = [
  { id: "github", label: "From GitHub", placeholder: "github.com/you/app" },
  { id: "image", label: "Docker image", placeholder: "ghcr.io/you/app:latest" },
  { id: "database", label: "Database", placeholder: "Postgres 18, MySQL 8.4 or Redis 8.10" },
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
    "Push to your branch and Warden deploys it",
    "New container runs beside the old one until it’s healthy",
    "The last three images stay on the server for rollback",
    "Variables encrypted per environment, never in git",
    "Every deploy, rollback and change is logged",
  ],
};

export const STEPS = [
  { name: "Push", text: "You push to the branch a service follows", code: "git push origin main", tone: "#e4f222", bg: "#121308", icon: "terminal" },
  { name: "Build", text: "On your own server, from your Dockerfile or with Railpack", code: "railpack · 1m 46s", tone: TONE.good, bg: "#0a130c", icon: "box" },
  { name: "Health check", text: "The new version has to answer before it gets traffic", code: "GET / → 200", tone: TONE.violet, bg: "#120d1c", icon: "shield" },
  { name: "Live", text: "Traefik switches traffic over with zero downtime", code: "api.example.com", tone: TONE.run, bg: "#081316", icon: "globe" },
] as const;

export const DEPLOY_GROUPS = [
  { label: "Deploying", tone: TONE.run, dashed: true, rows: [["#42", "add rate limits to public routes", "api"]] },
  { label: "Live", tone: TONE.good, rows: [["#41", "fix webhook retries", "api"], ["#17", "new pricing page", "web"]] },
  {
    label: "Image kept for rollback",
    tone: TONE.mute,
    rows: [["#40", "upgrade to node 22", "api"], ["#39", "add /health route", "api"], ["#16", "fix footer links", "web"]],
  },
  { label: "Failed, old version kept serving", tone: TONE.crit, rows: [["#38", "nothing answered on / in 90s", "api"]] },
];

/** The deploy log shown next to the list: [time, text, tone]. */
export const DEPLOY_LOG: Array<[string, string, string]> = [
  ["14:08:02", "Connecting to lag-01", "#8a8f98"],
  ["14:08:03", "Getting the code (you/shop @ main) → e91b04d", "#8a8f98"],
  ["14:08:05", "No Dockerfile found, so Railpack works out how to build it", "#8a8f98"],
  ["14:09:41", "Built warden/3f9c1a2b:41 (1m 36s)", TONE.text],
  ["14:09:42", "Running the release command: npx prisma migrate deploy", TONE.text],
  ["14:09:47", "Starting warden-app-3f9c1a2b-41", TONE.text],
  ["14:09:49", "Checking / on port 3000", TONE.text],
  ["14:09:51", "Health check passed: / answered 200", TONE.good],
  ["14:09:51", "Switching visitors to the new version", TONE.text],
  ["14:09:53", "Stopping the previous version (warden-app-3f9c1a2b-40)", "#8a8f98"],
  ["14:09:54", "Live", TONE.good],
];

export const GATE_FIGURES = [
  {
    fig: "STEP 1",
    title: "Starts beside the old one",
    text: "The new version starts on a private network next to the live one. Visitors can’t reach it yet. A release command, like a migration, runs first if you set one.",
  },
  {
    fig: "STEP 2",
    title: "Health check",
    text: "Your health path has to answer 2xx or 3xx within 90 seconds. The default / passes on any answer below 500. Workers just have to still be running after 10 seconds.",
  },
  {
    fig: "STEP 3",
    title: "Traffic switch",
    text: "Only then does Traefik send visitors to the new version. The old one gets SIGTERM and 10 seconds to finish what it’s doing.",
  },
  {
    fig: "IF ANYTHING FAILS",
    title: "Nothing changes",
    text: "A failed build, release command or health check removes the new container. The old version keeps serving and you get the error in the log.",
  },
];

/**
 * "What you can deploy": each language's own full-colour logo (Devicon, MIT)
 * and whether we deployed it ourselves. `invert`: the logo is plain black,
 * so it's drawn white on the dark page.
 */
export interface StackItem {
  name: string;
  logo: string;
  invert?: boolean;
  tested: boolean;
}
export const STACK: StackItem[] = [
  { name: "Node + Express", logo: expressLogo, invert: true, tested: true },
  { name: "NestJS", logo: nestjsLogo, tested: true },
  { name: "Next.js", logo: nextjsLogo, tested: true },
  { name: "Vite / static site", logo: viteLogo, tested: true },
  { name: "Python (Flask)", logo: pythonLogo, tested: true },
  { name: "Python (FastAPI)", logo: fastapiLogo, tested: true },
  { name: "Go", logo: goLogo, tested: true },
  // Sinatra has no logo of its own here; it's Ruby.
  { name: "Ruby (Sinatra)", logo: rubyLogo, tested: true },
  { name: "PHP", logo: phpLogo, tested: true },
  { name: "Rust", logo: rustLogo, invert: true, tested: true },
  { name: "Nuxt", logo: nuxtLogo, tested: false },
  { name: "SvelteKit", logo: svelteLogo, tested: false },
  { name: "Astro", logo: astroLogo, tested: false },
  { name: "Remix / React Router", logo: reactRouterLogo, tested: false },
];

export const DATABASES = [
  { engine: "PostgreSQL", logo: postgresLogo, versions: ["18", "17", "16"], tone: "#5b8fd6", variable: "DATABASE_URL" },
  { engine: "MySQL", logo: mysqlLogo, versions: ["9.7", "8.4"], tone: "#f29111", variable: "DATABASE_URL" },
  { engine: "Redis", logo: redisLogo, versions: ["8.10", "8.8", "8.6"], tone: "#ff4438", variable: "REDIS_URL" },
];

/** The backups list in the databases section: [when, size]. */
export const BACKUPS: Array<[string, string]> = [
  ["Today 02:00 UTC", "48.2 MB"],
  ["Yesterday 02:00 UTC", "47.9 MB"],
  ["Oct 26 02:00 UTC", "47.1 MB"],
  ["Oct 25 02:00 UTC", "46.8 MB"],
];

export interface FleetServer {
  host: string;
  provider: string;
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
    provider: "Hetzner",
    tone: TONE.crit,
    state: "Disk 91%",
    cpu: 47,
    mem: 62,
    disk: 91,
    warning: "Old images and build cache are using 18 GB. Run Docker cleanup to free it.",
    rows: [[TONE.crit, "ingest", "restarting"], [TONE.good, "postgres-18", "12d"]],
  },
  {
    host: "lag-01",
    provider: "DigitalOcean",
    tone: TONE.good,
    state: "Connected",
    cpu: 34,
    mem: 58,
    disk: 42,
    rows: [[TONE.good, "api #41", "2h"], [TONE.run, "api #42", "health check"], [TONE.good, "web #17", "3d"], [TONE.good, "warden-traefik", "21d"]],
  },
  {
    host: "lag-02",
    provider: "Vultr",
    tone: TONE.good,
    state: "Connected",
    cpu: 21,
    mem: 40,
    disk: 37,
    rows: [[TONE.good, "worker #9", "5h"], [TONE.good, "redis-8.10", "21d"], [TONE.good, "postgres-18", "21d"]],
  },
  {
    host: "fra-01",
    provider: "GCP",
    tone: TONE.mute,
    state: "Idle",
    cpu: 3,
    mem: 12,
    disk: 18,
    rows: [[TONE.mute, "Nothing running yet", ""]],
  },
];

/** The Traefik editor preview: the free YAML a team added beside the form's routes. */
export const TRAEFIK_YAML = [
  "http:",
  "  routers:",
  "    grafana:",
  "      rule: Host(`grafana.example.com`)",
  "      service: grafana",
  "      tls:",
  "        certResolver: le",
  "  services:",
  "    grafana:",
  "      loadBalancer:",
  "        servers:",
  "          - url: http://host.docker.internal:3001",
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
  { init: "AO", bg: "#d0d6e0", fg: "#08090a", who: "Adaeze", time: "14:02", rest: "Deployed #43 to production" },
  { init: "W", bg: "#23252a", fg: "#e5e5e6", who: "Warden", time: "14:08", hi: "#43 is live", hiTone: TONE.good, rest: " · health check passed on /" },
  { init: "W", bg: "#23252a", fg: "#e5e5e6", who: "Warden", time: "14:21", hi: "#44 failed its health check", hiTone: TONE.crit, rest: ": nothing answered on / within 90s. #43 kept serving." },
  { init: "DA", bg: TONE.violet, fg: "#ffffff", who: "Dami", time: "14:24", rest: "Changed LOG_LEVEL on staging" },
  { init: "TB", bg: "#e4f222", fg: "#08090a", who: "Tobi", time: "14:30", rest: "Ran Docker cleanup on ams-01 and freed 18.2 GB" },
];

export const BOARD = [
  {
    label: "Building",
    tone: "#e4f222",
    dashed: true,
    cards: [
      { id: "#10 · worker", title: "retry failed webhooks", tag: "lag-02", tagTone: TONE.run },
      { id: "#18 · web", title: "new pricing table", tag: "staging", tagTone: TONE.violet },
    ],
  },
  { label: "Health check", tone: TONE.run, dashed: true, cards: [{ id: "#44 · api", title: "cache warm on start", tag: "health check", tagTone: TONE.run }] },
  {
    label: "Live",
    tone: TONE.good,
    cards: [
      { id: "#43 · api", title: "rate limit public endpoints", tag: "lag-01", tagTone: TONE.good },
      { id: "#17 · web", title: "pricing page copy", tag: "lag-01", tagTone: TONE.good },
      { id: "#9 · worker", title: "queue backoff", tag: "lag-02", tagTone: TONE.good, faded: true },
    ],
  },
];

export const OPEN_SOURCE = [
  { title: "Auditable", text: "Every line that handles your SSH keys and secrets is public.", tone: "#6366f1", bg: "rgba(99,102,241,0.14)", icon: "lock" },
  { title: "Self-hosted", text: "Run the whole control plane on your own server, so your keys and secrets stay with you.", tone: TONE.good, bg: "rgba(39,166,68,0.14)", icon: "server" },
  { title: "No agent", text: "Warden talks to your servers over SSH. Docker is the only thing they need.", tone: TONE.violet, bg: "rgba(139,92,246,0.14)", icon: "terminal" },
  { title: "Issues on GitHub", text: "Found a bug or want something? Open an issue on the repo.", tone: TONE.crit, bg: "rgba(235,87,87,0.14)", icon: "people" },
] as const;

export const CHANGELOG = [
  { title: "Deploy from CI", text: "Create a deploy token and call Warden from GitHub Actions. Tokens only work for deploys, and can be tied to one project.", date: "OCT 28, 2026", latest: true },
  { title: "Traefik config editor", text: "Edit the proxy with a form or YAML. Checked before saving, put back on its own if Traefik refuses it, with every version kept.", date: "OCT 24, 2026" },
  { title: "Databases and backups", text: "Postgres, MySQL and Redis on your servers, with daily encrypted backups to S3 or R2. Download or restore any of them.", date: "OCT 22, 2026" },
  { title: "Add a service from GitHub", text: "Warden reads the repo, finds each app in it, monorepos too, and suggests how to build and start them.", date: "OCT 22, 2026" },
  { title: "Project canvas", text: "See a project’s services as boxes on one shared layout and drag them where they make sense.", date: "OCT 19, 2026" },
];

/* The console preview under the hero (the design's screenshot, drawn live). */
export const CONSOLE = {
  services: [
    { name: "api", kind: "App", tone: TONE.run, on: true },
    { name: "web", kind: "Website", tone: TONE.good },
    { name: "worker", kind: "Worker", tone: TONE.good },
    { name: "postgres", kind: "Postgres", tone: TONE.good },
    { name: "redis", kind: "Redis", tone: TONE.good },
    { name: "ingest", kind: "App", tone: TONE.crit },
  ],
  steps: [
    { name: "Get the code", state: "7f3c2a1", tone: TONE.good, icon: "ok" },
    { name: "Build with Railpack", state: "1m 36s", tone: TONE.good, icon: "ok" },
    { name: "Release command", state: "Done", tone: TONE.good, icon: "ok" },
    { name: "Start on the private network", state: "Done", tone: TONE.good, icon: "ok" },
    { name: "Health check: GET /", state: "Waiting for a 2xx/3xx", tone: TONE.run, icon: "run" },
    { name: "Switch traffic", state: "Waiting", tone: TONE.mute, icon: "wait" },
    { name: "Stop the old version", state: "Waiting", tone: TONE.mute, icon: "wait" },
  ],
  logs: [
    ["14:08:02", "Connecting to lag-01", "#8a8f98"],
    ["14:08:03", "Getting the code (you/shop @ main) → 7f3c2a1", "#8a8f98"],
    ["14:09:41", "Built warden/3f9c1a2b:42 with Railpack (1m 36s)", TONE.text],
    ["14:09:42", "Running the release command: npx prisma migrate deploy", TONE.text],
    ["14:09:47", "Starting warden-app-3f9c1a2b-42", TONE.text],
    ["14:09:49", "Checking / on port 3000", TONE.text],
    ["14:09:50", "Health check: / answered 503, waiting for a 2xx/3xx…", TONE.run],
    ["14:09:50", "Visitors are still on #41", TONE.mute],
  ],
  servers: [
    { host: "lag-01", state: "Connected", tone: TONE.good, cpu: "34%", role: "6 containers" },
    { host: "lag-02", state: "Connected", tone: TONE.good, cpu: "21%", role: "4 containers" },
    { host: "fra-01", state: "Idle", tone: TONE.mute, cpu: "3%", role: "Nothing running" },
    { host: "ams-01", state: "Disk 91%", tone: TONE.crit, cpu: "47%", role: "3 containers" },
  ],
};
