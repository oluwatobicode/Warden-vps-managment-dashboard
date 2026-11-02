---
title: Notifications
description: Alerts by email, Slack or Discord when deploys finish, servers go offline, disks fill up or backups fail.
---

**Settings → Notifications** (Admin) sends alerts to channels you choose.

## Channels

| Type | What it needs |
|---|---|
| **Discord** | A webhook URL (`https://discord.com/api/webhooks/…`): channel settings → Integrations → Webhooks |
| **Slack** | An incoming webhook URL (`https://hooks.slack.com/services/…`) |
| **Email** | Up to 20 addresses, one per line or comma-separated |

Each channel has a name, an **Enabled** switch and the events it receives. Webhook URLs are stored encrypted and hidden behind **Show URL**, which is recorded in the audit log. **Send test** checks a channel and tells you what went wrong if it fails (the provider didn't answer within 5 seconds, refused the request, or email isn't set up on this Warden).

## Events

| Event | When |
|---|---|
| Deploy started | A deploy left the queue and began building |
| Deploy succeeded | A deploy went live |
| Deploy failed | A deploy stopped with an error; the old version keeps serving |
| Health check failed | A new version started but never passed its health check |
| Rolled back | A rollback went live (sent instead of Deploy succeeded) |
| Deploy cancelled | Someone cancelled a deploy |
| Server unreachable | A server that was working failed 3 checks in a row |
| Server back online | It's reachable again after an alert |
| Disk almost full | A server's disk passed 90% |
| Cleanup failed | A Docker cleanup stopped with an error |
| Backup failed | A database's backup failed (sent once, not on every retry) |
| Member joined | Someone accepted an invite, including a removed member coming back |
| Member removed | An Admin removed a member |

Creating and restarting a database also send **Deploy succeeded** or **Deploy failed**.
