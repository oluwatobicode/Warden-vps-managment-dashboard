---
title: Introduction
description: What Warden is, who it's for, and how it compares with hosted platforms and other self-hosted tools.
---

Warden turns servers you already have (a VPS, an EC2 instance, a box under your desk) into a deploy platform. You connect a server, point Warden at a GitHub repository, and every push can build, health-check and swap in a new version without downtime. If something goes wrong, the old version keeps serving, and rollback is one click.

## What you get

- **Deploys from GitHub**: Warden reads your repository, detects the apps in it (monorepos included), and builds each one with its Dockerfile or, if it has none, with [Railpack](https://railpack.com).
- **Zero-downtime swaps**: the new version starts next to the old one, must pass a health check, and only then takes traffic.
- **Rollback**: back to any earlier version, reusing its kept image when it's still on the server.
- **Domains and HTTPS**: every app gets an address straight away, and custom domains get Let's Encrypt certificates automatically.
- **Databases**: Postgres, MySQL and Redis, on a private network, with encrypted daily backups and a built-in data browser.
- **Variables and secrets**: per environment and per service, encrypted, with every reveal recorded.
- **Logs and monitoring**: live, searchable app and server logs, CPU, memory and disk charts, and alerts by email, Slack or Discord.
- **Teams**: four roles, from read-only Viewer to Admin, and an audit log.
- **CI**: API tokens that can deploy, roll back and cancel, with a ready-made GitHub Actions workflow.

## How it compares

| | Hosted platforms (Railway, Render, Heroku) | Warden |
|---|---|---|
| Where your apps run | Their servers | **Your** servers |
| Cost | Per app, per resource, rising with usage | Your server's price |
| Setup | None | Add a server (a few minutes) |
| Lock-in | Their build system and services | Standard Docker containers on your machine |

Compared with other self-hosted tools such as Coolify or Dokploy, Warden is deliberately narrower. It focuses on the deploy flow (build, health check, swap, rollback) and on running a few apps and databases well, rather than on hosting every kind of service.

## How it reaches your servers

Warden connects to each server over **SSH** and runs Docker commands there. There's no agent to install and nothing listening on your server apart from the Traefik proxy Warden sets up on ports 80 and 443. Builds run on the server that will run the app. See [How Warden works](/how-it-works/).

## Two ways to use it

- **Use the hosted dashboard** at [app.trywarden.xyz](https://app.trywarden.xyz): sign up and connect your own servers. Your apps run on your servers; only the dashboard is hosted.
- **Self-host Warden itself**: run the whole dashboard on a server you own. See [Self-hosting Warden](/self-hosting/install/).
