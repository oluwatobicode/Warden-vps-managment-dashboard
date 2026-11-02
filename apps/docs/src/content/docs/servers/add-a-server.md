---
title: Add a server
description: What a server needs, how to add it with an SSH key, and what Test connection checks.
sidebar:
  order: 1
---

Warden connects to each server over SSH and runs Docker commands there. Nothing gets installed on the host apart from the Traefik proxy.

## What the server needs

- **Linux** (monitoring reads `/proc`).
- **Docker**, usable by the SSH user. Use root, or add the user to the `docker` group (`sudo usermod -aG docker <user>`, then log in again).
- **SSH access** with a key, from where Warden runs.
- For a deploy server: **ports 80 and 443** free and open in the cloud firewall (on GCP: "Allow HTTP and HTTPS traffic"; on AWS: the security group).
- Optional, for Docker and system logs: the SSH user can read the system journal. See [Server logs](/servers/server-logs/).

## SSH keys

Add keys under **Settings → SSH keys → Add SSH key**:

- **Generate ed25519**: a new pair, made in Warden.
- **Paste private key**: one you already use. Keys protected by a passphrase aren't accepted, and neither is a public key on its own.

The private half is stored encrypted and never shown again; the public half is. Put the public half in `~/.ssh/authorized_keys` on each server that should accept it. A key can't be deleted while a server still uses it.

## Add the server

**Settings → Remote servers → Add server** (DevOps and Admin):

| Field | Notes |
|---|---|
| Server name | Lowercase letters, digits and dashes, e.g. `hel-06` |
| Host or IP | An IP address or hostname |
| SSH port | 22 unless you changed it |
| SSH user | A Linux username, e.g. `deploy` |
| SSH key | One of your keys |
| Server type | **Deploy server** runs containers and serves traffic. **Build server** builds images only, no traffic |
| Provider, Location | Optional labels, e.g. Hetzner, Falkenstein |

The same IP and port can only be added once.

## Test connection

**Test connection** runs four checks and shows where it stops:

1. **Reach the host**: is the IP and port reachable? "Unreachable (check IP, port, firewall)" means it isn't.
2. **SSH login**: "key refused (check authorized_keys and username)" means the public key isn't on the server for that user.
3. **System info**: reads the kernel version.
4. **Docker daemon**: "not installed, or this user has no permission" means Docker is missing or the user isn't in the `docker` group.

A successful login marks the server **Connected**; a failure marks it **Offline**.

## Changing or removing a server

- **Details → Connection**: change the address, user or key. The server shows **Offline** until Warden reaches it again, usually within a minute.
- **Danger zone → Remove server**: type its name to confirm. Refused while services run on it or while it's an environment's default server. Warden forgets the host; your SSH key stays.
