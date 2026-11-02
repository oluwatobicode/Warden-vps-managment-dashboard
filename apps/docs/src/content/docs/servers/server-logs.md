---
title: Server logs
description: Traefik, Docker and system logs from each server, and the permission they need.
sidebar:
  order: 4
---

The server page's **Logs** tab shows the server's own logs, live and kept for 7 days, with the same search as [app logs](/logs/). It's for Developers and up.

## Sources

| Source | What it shows |
|---|---|
| **Traefik** | Certificate errors, routing errors, bad config (not one line per request) |
| **Docker** | The Docker daemon: crashes, out-of-memory kills, image pull failures |
| **System** | The rest of the system journal, warnings and worse |
| **Warden** | Lines Warden writes: the server going offline and coming back, disk alerts, Docker missing, cleanups, proxy setup and changes |

Each source shows whether Warden can read it: **Reading**, **Not running** (the proxy isn't set up), **No journal** (the server has no systemd journal, e.g. it runs inside a container), **No access** or **Not checked yet**.

## Giving access to the journal

Docker and system logs come from the systemd journal, which only root and members of `systemd-journal`, `adm` or `wheel` can read. For other users it's silently empty. If the tab shows **No access**, run this on the server:

```bash
sudo usermod -aG systemd-journal <ssh user>
```

Warden reconnects by itself within a minute and starts reading.
