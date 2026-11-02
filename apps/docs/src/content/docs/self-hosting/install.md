---
title: Install
description: Run Warden itself on your own server, for example an AWS EC2 instance, with HTTPS on your own domain.
sidebar:
  order: 1
---

Warden runs as a handful of Docker containers on one server: the dashboard, the API, the worker, Postgres and Redis, behind the same Traefik proxy Warden uses on every server it deploys to. Because of that shared proxy, the server that runs Warden can also run apps you deploy with it.

Nothing is built on your server. The images are built by GitHub Actions and published to GitHub's container registry, for both Intel/AMD (`amd64`) and ARM (`arm64`) machines. Your server only downloads them.

## What you need

- A Linux server with **2 GB of memory** or more (Ubuntu 24.04 is what the installer is tested on). With 1 GB, run Warden only and deploy apps to other servers.
- About 30 GB of disk.
- A domain you can add a DNS record to, for example `app.example.com`.

On AWS, a `t4g.small` (ARM, 2 GB) is the cheapest size that's comfortable; `t3.small` is the Intel equivalent.

## 1. Prepare the server

1. **Open the ports.** In your firewall (on EC2, the instance's security group):

   | Port | Allow from |
   |---|---|
   | 80 and 443 | Anywhere |
   | 22 | Your own IP only |

2. **Give it a fixed address.** On EC2, allocate an **Elastic IP** and associate it with the instance, so the address survives a stop and start.
3. **Point your domain at it.** Add an `A` record for your domain (for example `app`) with the server's IP. If your DNS is on Cloudflare, set the record to **DNS only** (grey cloud): Let's Encrypt has to reach the server directly.

## 2. Install

SSH into the server, then:

```bash
git clone --depth 1 https://github.com/oluwatobicode/Warden-vps-managment-dashboard.git warden
cd warden/infra/production
WARDEN_HOST=app.example.com ./install.sh
```

The installer:

1. Installs Docker, if it isn't there.
2. Adds a 2 GB swap file on servers with less than 3 GB of memory.
3. Writes `.env` with fresh secrets (database password, master key, sign-in keys).
4. Starts Warden's Traefik on ports 80 and 443.
5. Downloads Warden's images and starts it. Database migrations run before the API and worker start.

Running it again is safe: it keeps your `.env` and an existing proxy.

:::caution[Save your master key]
Copy `MASTER_KEY` from `.env` (`grep MASTER_KEY .env`) into a password manager, **off the server**. Every SSH key, secret variable and database password Warden stores is encrypted with it. Without it they can't be read, even from a backup.
:::

## 3. Open it

Visit `https://app.example.com`. The first visit takes a few seconds while Let's Encrypt issues the certificate; after that, Traefik renews it on its own.

Sign up to create your organization. Until you [set up email](/self-hosting/configuration/#email), sign-in links aren't sent; find them in the API's log:

```bash
sudo docker compose logs api | grep -i http
```

## Next

- [Configuration](/self-hosting/configuration/): email, GitHub sign-in, the GitHub App, backups.
- [Updates and backups](/self-hosting/updates-and-backups/).
- To deploy apps to this same server, add it in Warden like any other server (see [Add a server](/servers/add-a-server/)). Its firewall also needs SSH allowed from its own public IP, because Warden connects to it over SSH.
