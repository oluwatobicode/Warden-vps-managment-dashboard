import { ensureNetwork, ensureVolume, q, removeContainer, type Run } from "docker-client";

/*
 * Traefik: the front door on every server (ports 80/443). Apps never publish
 * a port; Traefik reads the name a visitor asked for and passes the request
 * to the container whose labels claim that name, over the warden-proxy
 * network. See docs/PHASE-2-DEPLOY-PLAN.md, "How a visitor reaches your app".
 */

/** v3.7+: older Traefik spoke a Docker API version Docker 29 no longer accepts. */
export const PROXY_IMAGE = "traefik:v3.7";
export const PROXY_CONTAINER = "warden-traefik";
export const PROXY_NETWORK = "warden-proxy";
/**
 * Which setup a server's Traefik has (Server.proxyRevision). 2 added
 * warden.yml (the config editor), its private status page and the host gateway.
 */
export const PROXY_REVISION = 2;
/** The folder Traefik watches; warden.yml lives here (a volume, so it survives re-setups). */
export const DYNAMIC_DIR = "/etc/traefik/dynamic";

const ARGS = [
  "--providers.docker=true",
  // Only containers Warden labelled traefik.enable=true; anything else on the server is ignored.
  "--providers.docker.exposedbydefault=false",
  `--providers.docker.network=${PROXY_NETWORK}`,
  "--entrypoints.web.address=:80",
  "--entrypoints.websecure.address=:443",
  // HTTPS certificates for custom domains, proven over port 80 (no DNS keys needed).
  "--certificatesresolvers.le.acme.httpchallenge=true",
  "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web",
  "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json",
  "--ping=true",
  "--ping.entrypoint=web",
  // warden.yml, edited on the server page → Proxy. Reloaded live when it changes.
  `--providers.file.directory=${DYNAMIC_DIR}`,
  "--providers.file.watch=true",
  // Traefik's status page, so Warden can ask whether a change loaded cleanly.
  // Bound to 127.0.0.1 INSIDE the container: not reachable from the apps'
  // network, and never published (only 80/443 are).
  "--api=true",
  "--api.insecure=true",
  "--entrypoints.traefik.address=127.0.0.1:8080",
  // Zero-downtime swaps. When the old version stops, its address vanishes, so a
  // request already sent to it would wait out the 30s default before the retry
  // rule could send it to the new version. Measured in the test server: with
  // these two settings, 0 of 360 requests failed across 3 swaps (1 in 40 without).
  "--serversTransport.forwardingTimeouts.dialTimeout=1s",
  "--providers.providersThrottleDuration=200ms",
];

/**
 * Start (or replace) Traefik. Idempotent: running it again recreates the
 * container with the current settings; certificates survive in the volume.
 */
export async function setupProxy(run: Run): Promise<void> {
  await ensureNetwork(run, PROXY_NETWORK);
  await ensureVolume(run, "warden-traefik-acme");
  await ensureVolume(run, "warden-traefik-dynamic");
  const pull = await run(`docker pull -q ${PROXY_IMAGE}`);
  if (pull.code !== 0) throw new Error(`Couldn't download Traefik: ${firstLine(pull.stderr || pull.stdout)}`);
  await removeContainer(run, PROXY_CONTAINER);
  const r = await run(
    [
      "docker run -d",
      `--name ${PROXY_CONTAINER}`,
      "--restart unless-stopped",
      "-p 80:80 -p 443:443",
      `--network ${PROXY_NETWORK}`,
      // Read-only: Traefik only watches containers, it never starts or stops them.
      "-v /var/run/docker.sock:/var/run/docker.sock:ro",
      "-v warden-traefik-acme:/letsencrypt",
      `-v warden-traefik-dynamic:${DYNAMIC_DIR}`,
      // "host.docker.internal" = the server itself, for routes to apps not deployed by Warden.
      "--add-host=host.docker.internal:host-gateway",
      "--label warden=1",
      PROXY_IMAGE,
      ...ARGS,
    ].join(" "),
  );
  if (r.code !== 0) {
    const why = firstLine(r.stderr || r.stdout);
    throw new Error(
      /address already in use|port is already allocated/i.test(why)
        ? "Port 80 or 443 is already used by something else on this server (nginx? apache? another proxy). Stop it, then try again"
        : `Couldn't start Traefik: ${why}`,
    );
  }
  await waitForProxy(run);
}

/** Traefik answers /ping on port 80 once it's up. */
export async function waitForProxy(run: Run, timeoutMs = 30_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const r = await run(`docker exec ${PROXY_CONTAINER} wget -q -O - http://127.0.0.1/ping`);
    if (r.code === 0 && r.stdout.includes("OK")) return;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Traefik started but doesn't answer. Check the server's logs for warden-traefik");
}

export async function proxyRunning(run: Run): Promise<boolean> {
  const r = await run(`docker inspect --format '{{.State.Running}}' ${PROXY_CONTAINER}`);
  return r.code === 0 && r.stdout.trim() === "true";
}

/**
 * The labels that make Traefik send `hosts` to this container. Every version
 * of a service carries the SAME router name, so during a swap Traefik serves
 * both versions; the retry rule re-sends a request that hit the version being
 * stopped (see the timeouts in ARGS).
 */
export function routeLabels(service: { router: string; port: number; hosts: string[]; httpsHosts: string[] }): string[] {
  const r = service.router;
  const rule = (hosts: string[]) => hosts.map((h) => `Host(\`${h}\`)`).join(" || ");
  const labels = [
    "traefik.enable=true",
    `traefik.http.services.${r}.loadbalancer.server.port=${service.port}`,
    `traefik.http.middlewares.${r}-retry.retry.attempts=3`,
    `traefik.http.middlewares.${r}-retry.retry.initialinterval=100ms`,
  ];
  if (service.hosts.length) {
    labels.push(
      `traefik.http.routers.${r}.rule=${rule(service.hosts)}`,
      `traefik.http.routers.${r}.entrypoints=web`,
      `traefik.http.routers.${r}.service=${r}`,
      `traefik.http.routers.${r}.middlewares=${r}-retry`,
    );
  }
  if (service.httpsHosts.length) {
    // Custom domains: HTTPS with a Let's Encrypt certificate, and http → https.
    labels.push(
      `traefik.http.routers.${r}-tls.rule=${rule(service.httpsHosts)}`,
      `traefik.http.routers.${r}-tls.entrypoints=websecure`,
      `traefik.http.routers.${r}-tls.tls.certresolver=le`,
      `traefik.http.routers.${r}-tls.service=${r}`,
      `traefik.http.routers.${r}-tls.middlewares=${r}-retry`,
      `traefik.http.routers.${r}-http.rule=${rule(service.httpsHosts)}`,
      `traefik.http.routers.${r}-http.entrypoints=web`,
      `traefik.http.routers.${r}-http.middlewares=${r}-to-https`,
      `traefik.http.middlewares.${r}-to-https.redirectscheme.scheme=https`,
    );
  }
  return labels.flatMap((l) => ["--label", q(l)]);
}

const firstLine = (s: string) => s.trim().split("\n")[0]?.slice(0, 300) ?? "";
