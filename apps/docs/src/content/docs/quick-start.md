---
title: Quick start
description: Sign up, add a server, and deploy your first app from GitHub in about ten minutes.
---

You need a Linux server with Docker that you can reach over SSH (a $5 VPS is enough to start), and an app in a GitHub repository.

## 1. Create your workspace

1. Go to [app.trywarden.xyz](https://app.trywarden.xyz) and choose **Create an instance**, or **Continue with GitHub**.
2. With email, Warden sends you a secure link. It expires in 15 minutes and works once; open it on the same device.
3. Under **Name your workspace**, enter your name and an **Organization name**, then **Create workspace**. You're the organization's Admin.

## 2. Add an SSH key

Warden reaches your servers over SSH with a key of its own.

1. Go to **Settings → SSH keys** and add a key. **Generate ed25519** makes a new pair; **Paste private key** imports one you already use. Only the public half is ever shown again.
2. On your server, append the public key to `~/.ssh/authorized_keys` of the user Warden will log in as.

The user needs to be able to run Docker. If it isn't root, add it to the `docker` group: `sudo usermod -aG docker <user>`.

## 3. Add the server

1. Go to **Settings → Remote servers → Add server**.
2. Fill in **Server name**, **Host or IP**, **SSH user** and **SSH key**. Keep **Server type** on **Deploy server**.
3. **Save server**, then press **Test connection**. All four checks (reach the host, SSH login, system info, Docker) should pass.
4. On the server's page, press **Set up proxy**. This starts Traefik on ports 80 and 443, which must be free and open in your cloud firewall.

More detail: [Add a server](/servers/add-a-server/).

## 4. Create a project

1. Go to **Projects** and create one. Pick the environments to start with (production is ticked) and choose your server under **Server for its environments**.

## 5. Deploy an app

1. In the project's **Overview**, choose **Add service → From GitHub**.
2. Paste a public repository's address (or connect GitHub first for private repositories), then **Read the repo**.
3. Warden lists the apps it found. Pick yours and **Continue**.
4. Check the settings it filled in (port, health check path, variables), then **Create and deploy**.

You'll see each step live: getting the code, building, the health check, then **Live**. Your app's address appears on its **Deployments** tab.

## Next

- [Add your own domain](/deploying/domains/) with HTTPS.
- [Add a database](/databases/create-and-connect/).
- [Deploy on every push](/deploying/build-settings/#deploy-on-every-push).
