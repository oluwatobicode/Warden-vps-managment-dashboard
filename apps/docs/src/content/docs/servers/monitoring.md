---
title: Monitoring and cleanup
description: CPU, memory and disk charts, server statuses, disk alerts and Docker cleanup.
sidebar:
  order: 2
---

Warden checks every server once a minute over one SSH connection: CPU, memory, disk, and Docker's containers and disk use.

## Statuses

| Status | Meaning |
|---|---|
| **Connected** | Reachable, with containers running |
| **Idle** | Reachable, with nothing running (or no Docker) |
| **Offline** | Three checks in a row failed |

When a server that was reachable goes **Offline**, and when it comes back, Warden can [notify you](/notifications/).

## Resources

The server page's **Resources** tab shows the last 24 hours: CPU (with load averages), memory and disk, as 5-minute averages with peak and average. Memory counts what's really in use (total minus what Linux can free). The **Docker disk** chart, checked every 10 minutes, splits Docker's space into images, volumes, build cache and containers, and shows how much is reclaimable.

Readings are kept for 7 days.

**Containers** lists what's running: state, CPU, memory and status.

## Disk alerts

When the disk passes 90% full, Warden sends a **Disk almost full** alert once. It alerts again only after usage has dropped below 85% and climbed back.

## Run cleanup

**Run cleanup** (DevOps and Admin) frees disk space Docker no longer uses. It shows what it would free first, then removes, in order:

1. Stopped containers.
2. Dangling images (untagged leftovers).
3. Build cache.
4. Unused networks.

It never removes volumes (your databases' data) or tagged images (which rollbacks use). You can close the window while it runs.
