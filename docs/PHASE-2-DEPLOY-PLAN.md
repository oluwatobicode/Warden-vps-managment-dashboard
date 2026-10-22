# Phase 2: deploying apps — the plan, in plain words

Written 2026-10-22 for Tobi. Read it top to bottom once; after that, jump to the part you need.

> **Status 2026-10-22: stages 0–8 are built and tested on the local test server** (Dockerfile and Railpack builds, zero-downtime swaps, failed deploys, rollbacks, cancel, live logs, the webhook, domains). Not yet tested for real: the GitHub App with a real App (you create it, see "Creating the GitHub App" below), HTTPS with a real domain, and everything on GCP. "What we learned building it" at the end explains the surprises. Every decision in here was made by Tobi in chat on 2026-10-21/22, and the reasons are written next to them so you can explain them to anyone.

---

## What we are building, in one paragraph

Today Warden can run databases on your servers. Phase 2 lets it run **your own apps** too. You point a service at a GitHub repo, press **Deploy**, and Warden gets the code onto your server, turns it into a running app, checks the app is healthy, and only then lets the world see it. If anything goes wrong, the old version keeps running and nobody notices. Every push to GitHub can deploy by itself. Every app gets a web address and HTTPS. And you can always go back to an older version.

---

## The words you need (read this first)

**Container.** A sealed box on the server that runs one app, with everything that app needs inside it: the right Node version, its packages, its files. Two containers on the same server can't see each other's insides.

**Image.** A frozen copy of a box, before it runs. You build an image once, then start as many containers from it as you like. An image built today runs exactly the same next month.

**Docker.** The program on the server that builds images and runs containers. Warden already uses it for databases.

**Dockerfile.** A recipe for building an image, written by you and kept in your repo. "Start from Node 22, copy the code, run `npm ci`, run `npm run build`, start with `npm start`." Docker follows it exactly.

**Railpack.** A tool from Railway that **writes the recipe for you** by looking at your repo ("I see package.json and Next.js, so: Node 22, npm ci, npm run build, npm start") and then builds the image with Docker's builder. The result is a normal Docker image, the same kind a Dockerfile makes. The difference is only who wrote the recipe. A Dockerfile is exact and lives in git, so everyone gets the same image; Railpack's guess isn't stored in your repo and can change when Railpack updates. **Warden's rule: if the repo has a Dockerfile, use it; if not, use Railpack.**

**DNS.** The internet's phone book. It turns a name (`myshop.com`) into an IP address (`34.172.28.226`). It only answers "which IP?" — it never touches your website itself.

**sslip.io.** A free DNS service with a trick: it reads the IP **out of the name**. `myapp.34.172.28.226.sslip.io` → "34.172.28.226". Nobody has to set anything up, so every app gets a working address the moment it's deployed. We use it because you don't own a domain yet. Later, users will be able to pick between an sslip.io address and their own domain.

**Traefik.** A "reverse proxy": the front door of the server. One server has one public IP and one HTTPS port, but runs many apps. When a request arrives, Traefik reads the name in it, finds the app that name belongs to, and passes the request to that app's container. It also gets HTTPS certificates by itself, and it is what makes swaps with no downtime possible.

**GitHub App.** A "robot account" you create once on GitHub, called Warden. People install it on their GitHub account and pick which repos Warden may read. Warden then gets short-lived keys to clone those repos (private ones too), and GitHub tells Warden about every push.

**Webhook.** GitHub calling Warden: "someone just pushed to this branch". It's how auto-deploy works. It needs Warden to be reachable from the internet; in development we use **ngrok** for that (see "Before we start").

**Health check.** Warden asking the new version "are you OK?" by opening its health page (by default `/`) and waiting for a good answer. No good answer within 90 seconds = the deploy fails, and the old version stays.

**Release command.** A command Warden runs **once** with the new version **before** it goes live. The usual one is the database migration: `npx prisma migrate deploy`. If it fails, the deploy stops and the old version keeps running on the old database shape.

**Rollback.** Going back to an older version of the app.

---

## How a visitor reaches your app

Say someone opens `myshop.34.172.28.226.sslip.io`.

1. Their browser asks DNS: "where is myshop.34.172.28.226.sslip.io?"
2. sslip.io's DNS server reads the IP out of the name and answers: "34.172.28.226".
3. The browser connects to 34.172.28.226 on port 80 (http) or 443 (https). On GCP, the firewall checkboxes "Allow HTTP traffic" and "Allow HTTPS traffic" must be ticked; those are the only new ports.
4. Behind the firewall, **Traefik** is the only thing listening on 80 and 443.
5. Traefik reads the name in the request ("myshop…") and looks at the rules Warden put on the containers. One container's rule says "requests for myshop… come to me, on port 3000".
6. Traefik passes the request to that container over a private Docker network called **warden-proxy**. The app's port is never open to the internet; only Traefik can reach it.
7. The app answers, and Traefik sends the answer back to the browser.

If someone asks for a name no app has, Traefik answers 404. Never some random app.

**Two separate roads into your server**, and they never mix:

- **Visitors → your apps**: the internet → ports 80/443 → Traefik → the app.
- **Warden → your server**: SSH on port 22, used only by Warden to run commands (clone the code, build, start containers). Visitors never touch it.

---

## How an app reaches its database

Every app joins **two** private networks:

- **warden-proxy**, so Traefik can bring it requests.
- **warden-env-…**, the private network of its environment, where its databases already live. That's why the `DATABASE_URL` Warden created for your database works from inside the app: it points at the database container by name.

Databases join **only** their environment network. So Traefik can't reach them, the internet can't reach them, and the **staging** app can't reach the **production** database, because they're on different networks.

This is also why an app must run on the **same server** as its database (already a rule from the databases work).

---

## One deploy, step by step

**Step 0 — someone asks for a deploy.** You press **Deploy** on a service, or you push to its branch and GitHub's webhook asks for you. The API checks you're Developer or higher, creates **Deployment #N** with status QUEUED, and puts a job in the worker's queue. If this service already has a deploy running, you're told "already deploying". Only one **build** runs per server at a time, so two builds never fight over a small server's memory.

**Step 1 — checks before anything happens.** The worker connects to the server over SSH and checks there's enough free disk space (at least 2 GB). If there isn't, the deploy stops right here with a clear message and a link to Docker cleanup. Nothing on the server was touched.

**Step 2 — get the code.** The worker asks GitHub for a key that works for one hour, then clones **that exact commit** into a temporary folder on the server. The key is written to a private file, never put on the command line where other users of the server could see it. (Public repos need no key at all.)

**Step 3 — build** (status BUILDING). If the repo has a Dockerfile (at the path set on the service, `Dockerfile` by default), Warden runs `docker build`. If not, it runs Railpack. The result is an image called `warden/<service>:<N>`. Every line of the build appears on your screen live, and each step's time is recorded.

**Step 4 — release command, if there is one.** Warden starts a one-off container from the new image, runs the release command (for example the migration), and waits for it to finish. If it fails, the deploy stops here and the old version keeps running.

**Step 5 — start the new version** (status DEPLOYING). The new container starts **next to** the old one; the old one keeps serving visitors. It gets its variables (the environment's, with the service's own on top) from a private file, the same way databases get theirs, and it joins both networks.

**Step 6 — health check** (status HEALTH_CHECK). Warden opens the app's health page from inside the server, for up to 90 seconds (a slow app on a small server can take a while to start). With the default path `/`, any answer short of a server error counts, because an API often has nothing at `/` and says 404 even though it's running fine. A health path you set yourself (like `/health`) must really succeed (2xx or 3xx). A WORKER service has no web page, so for it the check is "still running after 10 seconds".

**Step 7 — the swap, with no downtime.** The new container was started with the same Traefik rule as the old one, so for a moment Traefik sends visitors to **both**. Then Warden stops the old one politely: Docker tells it "finish what you're doing" and gives it about 10 seconds to complete the requests it's in the middle of. Traefik notices it's gone within a second, and only the new version serves. At no moment are there zero containers, so there is no downtime.

**Step 8 — finish** (status SUCCESS). Warden keeps the last 3 images on the server (so going back is instant), deletes older ones and the temporary folder, and sends the "deploy succeeded" notification. The Home page's "Recent deployments" finally fills up.

---

## Watching it happen: live logs

While a deploy runs, the worker sends every line it sees (the clone, the build, the app's first log lines) to Redis. The API listens there and passes the lines to your browser over a live connection (Socket.io). The same lines are saved in the database, so you can open any old deploy's log later. Logs are kept for **30 days**.

Before your browser gets a single line, the API checks that the deploy belongs to your organization. Nobody can read another org's build log.

---

## When things go wrong

The most important rule of the whole design: **the old version is never stopped until the new one is healthy.** So whatever breaks during a deploy, the live app keeps running, and the only thing that changes is that this deploy is marked failed, with the reason.

What each failure looks like:

- **Disk almost full:** caught before building (step 1). If the disk fills up **during** the build, Warden spots "no space left on device" in the output and shows the same friendly message, pointing at Docker cleanup.
- **The build runs out of memory** (likely on a 1 GB server): Docker reports exit code 137; Warden says "the build ran out of memory" and suggests swap or a bigger server.
- **The build takes forever:** stopped after 20 minutes.
- **The release command fails:** its output is in the log; the old version keeps running on the old database.
- **The app crashes or fails its health check:** Warden shows the last 50 lines of the **app's own** log, so you see its real error.
- **The server or SSH connection drops, or the worker restarts mid-deploy:** the deploy is marked failed after a while, and any half-started container is removed by name (the same kind of clean-up the backups already do). The live app never noticed.
- **The repo was deleted, or the GitHub App was uninstalled:** the deploy fails before touching the server, with that reason.

After **any** failure, the temporary folder and the half-built image are cleaned up.

---

## Going back: rollbacks

There are three kinds.

**1. Automatic, during a deploy.** If the build, the release command or the health check fails, the new container is deleted and the old one was never stopped. Nothing needs "rolling back", because nothing was switched yet.

**2. Manual: "go back to #12".** Deploy #15 went live but has a bug. You open #12 and press **Rollback**. Warden makes a new deployment (#16, marked as a rollback) that **skips the clone and build** — the image `warden/<service>:12` is still on the server — and does steps 5 to 8 as usual. It takes seconds. If #12 is older than the 3 images Warden keeps, Warden rebuilds it from #12's saved commit: slower, same result.

**3. What a rollback does NOT undo** — this is the important part, and the Rollback window will say it:

- **Database changes.** If #15's migration dropped a column, going back to #12's code doesn't bring the column back. Code can go back in time; data can't. If you really need the data back, restore a database backup from before #15 on the database's page.
- **Variables changed since.** A rollback uses today's variables, not the ones #12 had. (Versioning variables is deliberately left out for now.)

**How to avoid needing database rollbacks at all: safe migrations.** Change the database in two steps. First, a deploy that **adds** the new column and code that works with both old and new. Later, a second deploy that removes the old column once nothing uses it. Done this way, rolling back the code is always safe, because the database still has what the old code needs. This is a team habit, not a Warden feature; Warden's docs recommend it. The **release command** helps too: a failed migration never goes live.

---

## Versions

Every deploy **is** a version. Warden records for each one: its number (#N), the commit it came from (sha and message), the branch, who or what started it (you, a push, or a rollback), when, how long each step took, and whether it's the one live right now. The image is named after the number. By default a deploy takes the newest commit on the branch; you can also pick a specific commit.

---

## Monorepos (like Warden's own repo)

Warden's own repo is a monorepo: `apps/api`, `apps/frontend` and `apps/worker` share code from `packages/*`. The API **can't** be built from the `apps/api` folder alone, because it needs `packages/db` and the others. So every service gets these settings, all editable on the service's Settings page in the dashboard:

- **Root directory:** where the build starts. The repo's root by default, so shared packages are visible.
- **Dockerfile path:** for example `apps/api/Dockerfile`, still built from the root, so it can copy the shared packages.
- **Build command** and **start command** (for Railpack builds): for example build `pnpm turbo build --filter=api`, start `node apps/api/dist/main.js`.
- **Watch paths:** which folders a push must touch for this service to deploy. The API might watch `apps/api/**` and `packages/**`; the frontend watches `apps/frontend/**` and `packages/shared-types/**`. A push that only changes the frontend won't redeploy the API. Empty means "any change".
- **Health path, port, release command, auto-deploy on push (on/off).**

So one repo becomes three services, each building only its own part. That is exactly how Warden could one day deploy itself.

---

## The GitHub App

1. **You create one GitHub App, once**, named Warden, on your GitHub account. It asks for read access to code, and to be told about pushes. Its ID, private key and webhook secret go in the API and worker `.env`, the same way the R2 keys did.
2. In Warden, someone (DevOps or higher) presses **Connect GitHub**. They're sent to GitHub, pick an account and which repos to allow, and GitHub sends them back to Warden with an "installation" number. Warden checks it with GitHub and saves it for that organization. An organization can connect several GitHub accounts.
3. On a service's settings, Warden now lists the repos and branches it may read, private ones included.
4. On every push, GitHub sends a webhook, **signed** with the secret. Warden checks the signature (so a fake "deploy!" from a stranger is ignored), finds the services that use that repo and branch, have auto-deploy on, and whose watch paths match the changed files, and queues a deploy for each.

Public repos also work **without** the App (a plain clone), which is how we test before the App exists.

---

## Web addresses

**Now: sslip.io.** Every deployed APPLICATION gets `<service>-<short id>.<server ip>.sslip.io` automatically, over plain http. (HTTPS on sslip.io names is unreliable because of Let's Encrypt's limits, so we don't promise it.)

**Later, when you own a domain**, users pick per service:

- **Their own domain**, like `api.myshop.com`: they point its DNS at the server's IP, Warden checks it really points there, and Traefik gets an HTTPS certificate automatically.
- **A wildcard per server**: one DNS record, `*.gcp.yourdomain.xyz` → the server's IP, covers every app on that server (`shop.gcp.yourdomain.xyz`, `blog.gcp.yourdomain.xyz`…). The dangers, so you can explain them:
  - **Subdomain takeover.** If you delete the server and GCP gives its IP to someone else, your wildcard now sends your names to *their* server. Delete the DNS record when you retire a server, and use static IPs (you already reserved one).
  - **Apps can touch each other's cookies** under a shared parent name. Keep the wildcard on its own subdomain, never on the main domain Warden itself lives on (the reason GitHub Pages lives on github.io, not github.com).
  - **Names aren't secret.** Every HTTPS certificate is listed in public logs, so never rely on a hidden name for security.
  - **No wildcard certificates.** Those need an API key that can edit your DNS. Traefik gets a normal certificate per name instead, which needs no keys.

Phase 2 builds sslip.io addresses and custom domains. Per-server wildcards wait for your domain.

---

## Before we start (things only you can do)

1. **ngrok**, for development: GitHub has to reach your laptop for the App's install callback and its webhook. Sign up at ngrok, claim the **one free static domain** (otherwise the address changes on every restart and you'd keep editing the App), and run `ngrok http 3000`.
2. **Create the GitHub App** (exact settings in "Creating the GitHub App" below).
3. **GCP:** tick "Allow HTTP traffic" and "Allow HTTPS traffic" on the VM.
4. Nothing else. A domain for Warden itself can come later.

---

## What gets added to the code (in words)

**Database.** A table of GitHub installations per organization. Services gain: the GitHub repo they come from, root directory, Dockerfile path, build and start commands, release command, health path, watch paths, auto-deploy on/off. A table of domains per service (one for now; a table so more is free later). Deployments gain: the image name, how it was built (Dockerfile or Railpack), what started it (manual, push or rollback, and which deploy it rolls back to), and how long each step took. A table of deploy log lines, kept 30 days. Servers gain: whether Traefik is installed. All of it is added, nothing existing is removed.

**Worker.** A "set up Traefik" job, the deploy job (steps 1 to 8), the rollback path, log streaming to Redis, the clean-up of old images and stuck deploys.

**API.** Deploy, cancel and rollback routes; the deployment list and log for each service; the GitHub connect flow, repo and branch lists, and the webhook; domain routes; the live log connection.

**Dashboard.** A Deploy button and a deployment history on each app's page; a deploy page with the live log and step times; Rollback with its warnings; the build settings on the service's Settings page; Connect GitHub in Settings; the domain and address shown on the app's page; Traefik status and a "Set up" button on the server's page.

---

## The order we build it in

Each stage ends with "done when". We test every stage on the local test server first, then on GCP.

**Stage 0 — the database and shared types.** Add everything listed above to the schema and the shared types.
Done when: the migration is applied and everything still builds.

**Stage 1 — Traefik on a server.** A "Set up proxy" button on the server's page: the worker starts Traefik on ports 80/443 with the warden-proxy network, and the page shows it's running.
Done when: opening the server's IP in a browser gets Traefik's 404.

**Stage 2 — the deploy job, with Dockerfile builds and public repos.** Steps 0 to 8, the disk check, the release command, the health check, the swap, keeping 3 images, the sslip.io address.
Done when: a public repo with a Dockerfile goes live at its sslip.io address; a second deploy swaps with no failed requests; a deliberately broken version fails while the old one keeps answering.

**Stage 3 — Railpack.** Install Railpack on the server when first needed; build repos without a Dockerfile; the build and start commands.
Done when: a Node app with no Dockerfile deploys.

**Stage 4 — live logs and the deploy page.** Lines flow live to the browser and are saved; step times shown.
Done when: you watch a build live, refresh the page and see it continue, and reopen it the next day.

**Stage 5 — the GitHub App.** Connect GitHub, the repo and branch pickers, private repos.
Done when: a private repo of yours deploys.

**Stage 6 — auto-deploy on push.** The signed webhook, branch and watch-path matching.
Done when: a push deploys by itself, and a push touching only another service's folder doesn't.

**Stage 7 — rollback and cancel.** Roll back to any successful deploy (instant if its image is kept, rebuild otherwise), with the database and variables warnings; cancel a running deploy.
Done when: you go back from a broken version to a good one in seconds.

**Stage 8 — custom domains with HTTPS.** Add a domain, check its DNS, Traefik gets the certificate.
Done when: an https:// domain serves the app. (Needs a domain; it can be tested with any domain you control, even a cheap one.)

---

## Decided (and why)

- Builds run **on the server the app runs on**: simplest, no image registry needed. A 1 GB server will struggle with big builds; Tobi accepts that and will add servers when needed.
- **Dockerfile if present, Railpack otherwise**: Railpack for convenience, a Dockerfile when the team wants an exact, shared recipe.
- **A GitHub App**, one for all of Warden, created by Tobi; its keys in `.env`.
- First release: Deploy button, live logs, auto-deploy on push, domains + HTTPS, rollback to any old deploy.
- **sslip.io addresses now**; custom domains in Stage 8; users will later pick between the two.
- **Release command**: yes. **Safe migrations**: recommended in the docs.
- **Variables are not versioned** for now; a rollback uses today's variables.
- Deploy logs kept **30 days**. The last **3 images** kept per service.
- **Developer and higher** can deploy and roll back; **DevOps and higher** set up Traefik and connect GitHub.
- Monorepo settings (root directory, Dockerfile path, build/start commands, watch paths) are **editable from the dashboard**.

## Later, not Phase 2

- **Server firewall management** (Phase 3): a read-only "open ports" view first, then managing the server's own firewall, with safety rails: never close SSH, and every change undoes itself unless confirmed within 60 seconds. Note: on GCP the cloud firewall sits outside the server and still applies.
- Per-server wildcard domains (once there's a domain).
- Versioning variables per deploy.
- Building on a separate BUILD server.
- Warden deploying itself (and the self-update rules already written in CLAUDE.md).

---

## Creating the GitHub App (once)

On GitHub: your profile picture → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.

- **GitHub App name:** something like `warden-tobi` (it must be unique on GitHub). Its URL name becomes the **slug**: github.com/apps/**warden-tobi**.
- **Homepage URL:** anything for now (your portfolio is fine).
- **Callback URL / "Request user authorization (OAuth) during installation":** leave empty and unticked. Warden doesn't log people in through the App.
- **Setup URL:** where GitHub sends the browser after someone installs it. In development: `http://localhost:3000/api/github/callback`. Tick **"Redirect on update"** too.
- **Webhook:** tick **Active**. **Webhook URL:** in development your ngrok static domain, `https://<your-ngrok-domain>/api/github/webhook`. **Webhook secret:** a long random string (`openssl rand -hex 32`); keep it, it goes in `.env`.
- **Permissions → Repository permissions:** **Contents: Read-only** (to clone). **Metadata: Read-only** is required by GitHub anyway. Nothing else.
- **Subscribe to events:** tick **Push**.
- **Where can this GitHub App be installed?** "Only on this account" while testing; "Any account" when others will use your Warden.

Press **Create GitHub App**. On the page that opens:

- Copy the **App ID** (a number near the top).
- Scroll down → **Private keys** → **Generate a private key**. A `.pem` file downloads.

Then in **both** `apps/api/.env` and `apps/worker/.env`:

```
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=warden-tobi
GITHUB_APP_WEBHOOK_SECRET=<the random string>
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```

The private key goes on **one line** with `\n` where the line breaks were (`awk 'NF {printf "%s\\n", $0}' key.pem` prints it like that). Restart the api and worker, then in Warden: **Settings → GitHub → Connect GitHub**.

In production (Warden on GCP with its own domain), change the Setup URL and the Webhook URL to that domain.

---

## What we learned building it (the surprises)

These are the things that only showed up when testing for real. Each is now handled in the code, and each is a good story for an interview.

1. **Swaps weren't zero-downtime at first.** With old and new versions behind one Traefik route, stopping the old one still failed about 1 request in 40. When a container stops, its network address disappears, so a request already on its way waited out Traefik's 30-second connection timeout instead of being retried. Fix: a retry rule on every route, a 1-second connection timeout, and Traefik reacting to container changes within 200 ms. Measured after: **0 failures in 1,500 requests across a live deploy.** Taking the old container off the network *before* stopping it made things worse (requests vanished into nothing), so we don't.
2. **Traefik would send visitors to a version that hadn't passed its health check.** Traefik starts routing to a labelled container the moment it joins the proxy network. So the new version starts on its environment network only, is health-checked there by a tiny probe container, and joins the proxy network only once healthy.
3. **…but then Traefik answered 504.** Joining a network isn't a *container* event, and Traefik only re-reads containers on container events, so it kept the app's old, unreachable address. Any container starting makes Traefik re-read everything, so Warden starts a throwaway one right after the join. Then it asks Traefik for the app the way a visitor would, and logs the answer.
4. **Older Traefik doesn't work with Docker 29** (your GCP server's version): Docker 29 dropped old API versions. Warden pins `traefik:v3.7`.
5. **Railpack's options take values on the command line,** which other users of a server can see. So only Railpack's own settings (build/start command, versions) go there; the app's variables are handed to the build as Docker secret files (0600), never as arguments.
6. **The test server had to be made more like a real one.** On the pretend VPS the `docker` command and the Docker engine were in different containers, so a folder made over SSH wasn't where Docker looked for it. On a real server they're the same machine; the test setup now shares the folder at the same path.
7. **Live logs arrived empty in the browser** (but not in a script). The browser asks to watch a deploy the instant it connects, while the api is still checking the login cookie; the early request saw "not logged in" and was dropped. Each request now waits for that connection's check to finish.
8. **A log chunk can arrive twice.** The browser loads the saved log and listens live at the same time, so the same chunk can come both ways. Every chunk has a sequence number; the page keeps each number once, in order.

---

## Adding a service, the new way (built 2026-10-22, after the first real deploys)

The first real deploy tried to build your GitHub *profile* repo (only a README), because the old form asked you to type a repo URL and left the server, build settings and GitHub repo to separate cards afterwards. So adding a service now goes like Railway:

1. **Every environment has a default server**, chosen when the project is created (Project settings → Environments to change it). New services and databases land there unless they pick another. Why per environment: apps must sit next to their databases (private network), and staging can still live on another server than production. A server that's still some environment's default can't be deleted.
2. **Add service → From GitHub** has three steps:
   - **The repo:** pick it from the repos the GitHub App can see (private ones too), or paste a public one, then the branch.
   - **What Warden found:** Warden reads the repo through GitHub's API (no clone, a couple of seconds) and lists the apps in it. A monorepo (pnpm/npm/yarn workspaces) lists each app; libraries like `packages/db` are left out. You tick which become services. A repo with nothing to run says so instead of failing a build.
   - **Check and deploy:** each app's name, server, port, build and start commands, health path, watch paths and build-time variables are prefilled and editable. **Create and deploy** creates them all in one go and starts their first deploys.
3. **Websites** (Vite, Create React App, Astro): Railpack builds them and serves the built folder with its own small web server on `$PORT`, answering `/health`. That's why a website has no start command (setting one would switch that off) and gets a "built site folder" instead (`RAILPACK_SPA_OUTPUT_DIR`, needed when the site isn't at the repo root). Variables like `VITE_API_URL` are baked in when the site is built, so the form asks for them before the first deploy.
4. **Monorepos are built from the repo root** so an app can use the shared packages: for a pnpm + Turborepo repo the build is `pnpm turbo run build --filter=<app>...` (the `...` builds the packages it depends on too) and the start is `pnpm --filter <app> run start`.

**Rate limits:** reading a repo costs a few GitHub API calls. With GitHub connected, Warden uses the App's key (5,000 calls an hour), even for public repos. Without it, GitHub allows only 60 an hour per IP address, which a few tries can use up; Warden then says so and suggests connecting GitHub.

**Two lessons from the first real repos (fixed):**

- **A plain HTML site with a stray `package.json`** (your blogr repo: `index.html` + `style.css` + a `package.json` holding only framer-motion) made Railpack think "Node app", find nothing to start, build anyway, and fail the health check 90 seconds later with no output. Now Warden reads Railpack's plan right after `prepare`: if it has nothing to start, the deploy stops in seconds and says to set **Built site folder** (Settings → Build & start; `.` for files at the repo root). And Add service → From GitHub recognises such a repo as a website with the folder already set to `.`.
- **Every setting passed to `railpack prepare` must also be handed to the build.** Railpack's plan reads each one (its own settings like `RAILPACK_SPA_OUTPUT_DIR` and the build/start commands, plus the app's variables) as a BuildKit secret; a missing one fails the build with "secret X: not found". Warden now writes all of them as 0600 files. This would have broken every monorepo app (they all use custom build/start commands); the first tests happened not to use any.

**Known gap (found while testing, not fixed yet):** deleting a project or environment removes its services from Warden but leaves their app containers running on the server. Stop or delete the services first, until that's handled.

