---
title: How Warden works
description: What happens on your server during a deploy, how visitors reach your app, and what Warden stores.
---

## The pieces

- **The dashboard and API**: where you and your team work. They store your projects, settings and encrypted secrets.
- **The worker**: does the slow work: builds, deploys, backups, monitoring and log collection. It reaches your servers over SSH.
- **Your servers**: run your apps and databases as Docker containers. Warden sets up one [Traefik](https://traefik.io) proxy on each server, on ports 80 and 443.

Nothing of Warden runs on your servers apart from that proxy. Warden doesn't install an agent; it connects over SSH when it has work to do, and keeps one connection open to collect logs.

## What happens during a deploy

1. **Wait for the server**: one build runs per server at a time, so two deploys never fight over memory. Warden also checks there are at least 2 GB of free disk.
2. **Get the code**: Warden clones the commit inside a throwaway container on your server. For a private repository it uses a short-lived token from the Warden GitHub App, which never appears in a command line.
3. **Build**: with your repository's Dockerfile if it has one, otherwise with Railpack, which works out how to build most Node, Python, Go and static sites.
4. **Release command** (optional): for example, database migrations. It runs in the new image before anything changes for visitors. If it fails, the deploy stops and the old version keeps serving.
5. **Start the new version**: next to the old one, on a private network only.
6. **Health check**: Warden asks the new version for its health check path until it answers, for up to 90 seconds. A worker (an app with no web traffic) just has to keep running for 10 seconds.
7. **Switch traffic**: the new version joins the proxy's network, Traefik starts sending it requests, and the old version is stopped gracefully.
8. **Clean up**: the last 3 images of each app are kept on the server, for quick rollbacks.

If any step fails, the old version is untouched and keeps serving. You can follow every step live, with the build output, on the deploy's page.

## How a visitor reaches your app

Every app gets an address of the form `your-app-1a2b3c4d.<server ip>.sslip.io` straight away. You can add your own domains; Warden checks the DNS points at the server and gets a Let's Encrypt certificate for it.

On the server, Traefik reads the name the visitor asked for and passes the request to the container that claims that name. Apps never publish a port of their own.

## What Warden stores

- Your projects, services, deploy history and logs (logs for 7 days, deploy output for 30 days).
- **Encrypted** secrets: SSH private keys, secret variables and database passwords. Each organization has its own data key, which is itself encrypted with a master key the Warden installation keeps outside the database. See [Security](/security/).

Warden never stores your apps' traffic, and your databases' data stays on your server (backups go to the storage you choose).
