---
title: Troubleshooting
description: The problems people actually hit, what the messages mean, and how to fix them.
---

## Connecting a server

**"Unreachable (check IP, port, firewall)"**
The server didn't answer on its SSH port. Check the IP and port, and that the cloud firewall allows SSH from where Warden runs.

**"Key refused (check authorized_keys and username)"**
The public key isn't in `~/.ssh/authorized_keys` for that user, or the user name is wrong.

**"Docker: not installed, or this user has no permission"**
Install Docker, or add the user to the `docker` group (`sudo usermod -aG docker <user>`) and test again.

**"Port 80 or 443 is already used by something else on this server"**
Another web server (nginx, Apache, Caddy) has the ports. Stop it, then **Set up proxy** again.

## Deploys

**"The proxy isn't set up on {server}"**
Press **Set up proxy** on the server's page first.

**"Only X GB of disk is free… a build needs at least 2 GB"** or **"The server ran out of disk space during the build"**
Press **Run cleanup** on the server's page, then deploy again.

**"The build ran out of memory"**
Add swap, or use a server with more memory. Builds run on the server that runs the app.

**"Nothing healthy answered at {path} on port {port} within 90 seconds"**
The usual causes:
- The app listens on `localhost`/`127.0.0.1`. It must listen on `0.0.0.0` (or read `$PORT`).
- The port in **Settings → General** isn't the one the app uses.
- The health check path returns an error. On a custom path it must answer 2xx or 3xx.
- The app crashes on start. Read its output on the deploy's page.

**"The app stopped right after starting"**
It crashed. Check the deploy's output and the service's [logs](/logs/); a missing variable is the usual reason.

**"Railpack found nothing to start in this repo"**
For a website, set **Built site folder** (for example `dist`) in **Settings → Build & start**. For an app, set a **Start command**, or add a Dockerfile.

**"The release command failed"**
The old version is still running. The release command's output is on the deploy's page.

**"Couldn't read the repo"** / **"GitHub refused access"**
For a private repository, connect GitHub (**Settings → GitHub**) and give the Warden GitHub App access to it.

**Each push deploys twice**
The service has **Deploy on every push** on, and CI deploys it too. Turn one off.

## Apps that deploy but don't work

**Database errors such as "table does not exist"**
Nothing ran the migrations. Set a **release command**, for example `npx prisma migrate deploy`.

**The app connects to the wrong database**
A service variable with the same name (for example a `DATABASE_URL` copied from a laptop) overrides the one Warden created. Delete the service's copy. Inside the server, a database's host is its container name, not `localhost`.

**Browser requests fail with CORS errors**
An origin is scheme, host and port, and never ends in `/`. A `CORS_ORIGIN` or `FRONTEND_URL` of `https://app.example.com/` doesn't match `https://app.example.com`.

**A website still shows old settings**
Website variables are built in. Change them, then deploy again.

## Domains

**DNS doesn't point here yet**
The domain's A record must be the server's IP. DNS changes can take a while to spread. On Cloudflare, set the record to **DNS only**, or the certificate can't be issued.

## Logs

**Docker and System logs show "No access"**
Run `sudo usermod -aG systemd-journal <ssh user>` on the server. See [Server logs](/servers/server-logs/).

**"N lines dropped"**
The service printed more than 200 lines a second. Lower its log level.

## Signing in

**"GitHub didn't share your email address with Warden"**
On a self-hosted Warden, the GitHub App needs **Account permissions → Email addresses: Read-only**. Approve the new permission when GitHub asks.
