---
title: Addresses and domains
description: The address every app gets, and adding your own domain with HTTPS.
sidebar:
  order: 4
---

## The automatic address

Every application gets an address as soon as it's deployed:

```
http://<service>-<id>.<server ip>.sslip.io
```

[sslip.io](https://sslip.io) is a public DNS service that answers with the IP inside the name, so it works with no setup. It's plain `http`; use your own domain for HTTPS.

## Your own domain

In a service's **Settings → Domains** (applications only):

1. **Add a domain**, for example `api.example.com`.
2. At your DNS provider, add an **A record** for that domain pointing at the server's IP, which Warden shows you.
3. Press **Check**. Warden looks up the domain and shows **DNS ok**, or **DNS doesn't point here yet**.
4. **Deploy** again. Domains are used from the next deploy.

On the first visit, Traefik gets a certificate from Let's Encrypt, and `http://` redirects to `https://` from then on.

If your DNS is on Cloudflare, set the record to **DNS only** (grey cloud): Let's Encrypt has to reach your server directly.

IP addresses and `sslip.io` names can't be added as domains.
