---
title: Deploy a Docker image
description: Run an image you've already built, from any registry Docker can pull from.
sidebar:
  order: 2
---

Choose **Add service → Docker image** for an image that's already built.

| Field | Notes |
|---|---|
| Service name | e.g. `api` |
| Type | **Application** serves traffic on a port. **Worker** runs background jobs, with no port |
| Image | e.g. `ghcr.io/acme/api:1.4.0` |
| Server | A deploy server, or the environment's default |
| Port | The port the app listens on (applications only) |

An application must have a port, and a worker must not.

Each deploy downloads the image and swaps it in with the same health check as a build from GitHub. To deploy a new version, change the tag under **Settings → General**, then **Deploy**.
