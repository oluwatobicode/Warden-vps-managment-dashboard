---
title: Logs
description: Live and searchable logs for each service, a whole environment, or a server.
---

Warden collects what your apps print and keeps it for **7 days**, live and searchable. Logs are for **Developers and up**: they often contain things not everyone should see.

## Where to find them

- **A service**: its **Logs** tab. Databases have one too.
- **A whole environment**: the project sidebar's **Logs** shows every service in the selected environment together, each line tagged with its service.
- **A server**: its **Logs** tab. See [Server logs](/servers/server-logs/).

New lines appear live and the view follows the end. Scroll up to load older lines; **N new lines ↓** takes you back down.

## Searching and filtering

- **Search**: text anywhere in the line, at least 2 characters, not case-sensitive. Live lines pause while a search is showing.
- **All / Errors**: Errors shows what the app wrote to stderr.
- **Time**: the last 7 days, 24 hours, hour or 15 minutes.
- **Version**: one deploy's lines only.

Click a line to see it in full with the 50 lines before and after it. **Copy** copies the lines shown.

## Secrets are hidden

Before a line is saved, the values of the service's secret variables, and the environment's database passwords, are replaced with `••••••`. This catches an app printing its configuration or a connection URL. It can't catch a secret split across lines or encoded some other way, and values shorter than 8 characters aren't masked (they would hide ordinary words).

## Limits

- Up to **200 lines a second** per service are kept. Past that, Warden saves one line saying how many it dropped, so a crash loop can't fill the database.
- Lines longer than 16 KB are cut.

Warden also caps each container's own Docker log at 3 × 10 MB on the server, so a chatty app can't fill the server's disk.
