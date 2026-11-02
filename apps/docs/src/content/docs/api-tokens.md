---
title: API tokens and CI
description: Deploy from GitHub Actions or any script with an API token.
---

API tokens let CI and scripts deploy, roll back, cancel and read deployments, and nothing else.

## Create a token

**Settings → API tokens → Create API token** (Admin):

- **Token name**: e.g. `github-actions`.
- **Scope**: **Read only** (read deployments and their logs) or **Deploy** (also deploy, roll back and cancel).
- **Project**: every project, or one project's services only. A project token gets "not found" for anything outside it.
- **Expires**: 30 days, 90 days (the default), 1 year or never.

The token (starting `wdn_`) is shown **once**. Warden keeps only a hash of it.

## What a token can do

| Request | Read only | Deploy |
|---|:-:|:-:|
| `GET /deployments?serviceId=…`, `GET /deployments/:id`, `GET /deployments/:id/logs` | ✓ | ✓ |
| `POST /deployments` (optional `commitSha`) | | ✓ |
| `POST /deployments/:id/rollback`, `POST /deployments/:id/cancel` | | ✓ |

Any other request with a token is refused. A leaked CI token can't create tokens, touch servers, read variables or change roles. Tokens also can't stop or start services.

Send it as a header: `Authorization: Bearer wdn_…`. To check one, call `GET /api-tokens/whoami`.

## GitHub Actions

1. Copy the service's ID: the service → **Settings → General → Service ID**.
2. In your repository's **Settings → Secrets and variables → Actions**, add `WARDEN_URL` (Warden's address ending in `/api`, e.g. `https://app.trywarden.xyz/api`) and `WARDEN_TOKEN` (a Deploy token).
3. Add this workflow. It starts a deploy of the pushed commit and waits for the result; the job fails if the deploy does.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy with Warden
        env:
          WARDEN_URL: ${{ secrets.WARDEN_URL }}     # Warden's address, ending in /api
          WARDEN_TOKEN: ${{ secrets.WARDEN_TOKEN }} # a Deploy token
          SERVICE_ID: paste-the-service-id          # service → Settings → General
        run: |
          auth="Authorization: Bearer $WARDEN_TOKEN"
          id=$(curl -fsS -X POST -H "$auth" -H "Content-Type: application/json" \
            -d "{\"serviceId\":\"$SERVICE_ID\",\"commitSha\":\"$GITHUB_SHA\"}" \
            "$WARDEN_URL/deployments" | jq -r .data.id)
          echo "Deploy $id queued"
          for i in $(seq 1 180); do
            status=$(curl -fsS -H "$auth" "$WARDEN_URL/deployments/$id" | jq -r .data.status)
            echo "$status"
            case $status in
              SUCCESS) exit 0 ;;
              FAILED|GATE_FAILED|ROLLED_BACK|CANCELLED) exit 1 ;;
            esac
            sleep 5
          done
          echo "Still not finished after 15 minutes"; exit 1
```

:::caution
If the service also has **Deploy on every push** on, each push deploys twice. Turn it off in **Settings → Build & start** when CI deploys.
:::
