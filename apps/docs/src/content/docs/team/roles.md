---
title: Roles
description: The four roles - Viewer, Developer, DevOps and Admin - and exactly what each can do.
sidebar:
  order: 1
---

Every member has one of four roles for the whole organization. Each role can do everything the one before it can. The line between them is: can this break something that isn't yours?

| | Viewer | Developer | DevOps | Admin |
|---|:-:|:-:|:-:|:-:|
| See projects, services, servers and deploys (secrets masked) | ✓ | ✓ | ✓ | ✓ |
| See project Activity, move boxes on the canvas | ✓ | ✓ | ✓ | ✓ |
| Add and edit services and variables, reveal secrets | | ✓ | ✓ | ✓ |
| Deploy, roll back, cancel, stop and start | | ✓ | ✓ | ✓ |
| Databases (create, restart, back up, restore, delete, including data), the Data tab | | ✓ | ✓ | ✓ |
| App and server logs | | ✓ | ✓ | ✓ |
| Create and delete projects and environments | | | ✓ | ✓ |
| Servers, SSH keys, the proxy, Docker cleanup | | | ✓ | ✓ |
| Connect GitHub, backup storage | | | ✓ | ✓ |
| Team, invitations and roles | | | | ✓ |
| API tokens, notification channels, the audit log | | | | ✓ |

New members join as **Viewer** unless the invitation says otherwise. The person who creates the organization is its first **Admin**.

Warden hides what your role can't do, but the real check happens on the server: a request your role doesn't allow is refused even if you send it some other way.

## Changing a role

**Team & roles** (Admin). The member is asked to sign in again, and their new role applies at once. You can't change your own role, and an organization always keeps at least one Admin.
