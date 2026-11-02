---
title: The proxy
description: Traefik on each server - setting it up, updating it, and adding your own routes and redirects.
sidebar:
  order: 3
---

Every deploy server runs one [Traefik](https://traefik.io) proxy, `warden-traefik`, on ports 80 and 443. It sends each visitor to the right app by the domain they asked for, and gets HTTPS certificates from Let's Encrypt. Apps never open ports of their own.

## Set up proxy

On the server's page (DevOps and Admin), press **Set up proxy**. It needs ports 80 and 443 free: if something else uses them, you'll see "Port 80 or 443 is already used by something else on this server (nginx? apache? another proxy)". Stop that program, then try again.

Certificates are kept in a volume, so setting the proxy up again doesn't lose them. **Update proxy** appears when Warden's proxy settings have changed since yours was set up; it restarts Traefik, so the server's sites are unreachable for 2 to 3 seconds.

## Routes right now

The **Proxy** tab lists the routes Traefik is serving, read live from it. Routes for apps deployed by Warden are shown read-only: they come from the apps themselves.

## Your own routes: warden.yml

For anything else, the Proxy tab edits one file, `warden.yml`, which Traefik reloads within seconds with no restart. **Edit with** offers two ways:

**Form**: the common cases.

- **Force HTTPS for every domain**: redirect `http://` to `https://`. `sslip.io` addresses are left alone; they have no certificates.
- **Extra routes**: a domain to a port on the server, for an app running directly on the server, not deployed by Warden. Optionally with HTTPS.
- **Redirects**: from one domain to another, optionally keeping the path, permanent (301) or temporary (302).

**YAML**: anything else Traefik supports. Names starting with `svc-` or `form-` are Warden's and can't be used.

:::caution
A change here goes live for every site on the server.
:::

Before saving, Warden checks the file: valid YAML (with line numbers for mistakes), valid against Traefik's own schema, and no references to routers, services or middlewares that don't exist. **Apply** stays disabled until the check passes.

After saving, Warden asks Traefik whether it loaded the change. If Traefik refuses any of it, the previous version is put back automatically and you see Traefik's error.

## Versions

Every change is kept in **Versions**: the live one, and any that Traefik refused and Warden rolled back. **Revert to this** brings an earlier version back.
