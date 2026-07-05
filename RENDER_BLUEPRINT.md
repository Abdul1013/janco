# Render Deployment Blueprint — JANCO backend

This document describes two recommended ways to deploy the JANCO backend to Render and a ready-to-use checklist of environment variables and health checks.

Overview
- Service type: Web Service (Docker)
- Port: `8000`
- Health check (liveness): `/health`
- Readiness check: `/v1/ready`

Option A — Deploy from container image (recommended)

1. Publish the image to GitHub Container Registry (GHCR) using the included GitHub Actions workflow (already added to this repo).

2. In Render: New → Service → Deploy from Docker Image.
   - Image: `ghcr.io/<your-org>/janco-backend:latest`
   - If the image is private, add a Private Registry under Account Settings (username + Personal Access Token) or provide credentials when creating the service.
   - Set the `PORT` environment variable to `8000`.
   - Set the health check path to `/health` and readiness path to `/v1/ready`.

3. Add environment variables (use Render secrets for sensitive values):
   - `DATABASE_URL` (Postgres connection string)
   - `REDIS_URL` (Redis connection string)
   - `SECRET_KEY` (random secret)
   - `CORS_ORIGINS` (comma-separated origins or JSON array)
   - `SENTRY_DSN` (optional)
   - `UVICORN_WORKERS` (e.g. `4`)
   - `REMINDERS_ENABLED` (`true` / `false`)

4. Attach a managed Postgres database (Render → New → PostgreSQL). Copy the connection string and save it to `DATABASE_URL` for the service.

5. If you need Redis, create a private Redis instance (Add-ons) or use an external provider and set `REDIS_URL` accordingly.

6. Domain & TLS: Add custom domain in Render and enable automatic TLS.

Option B — Deploy from repository (Render builds Dockerfile)

1. In Render: New → Web Service → Connect to your GitHub repo and choose the branch to deploy.
2. Set the Environment to `Docker` (Render will build using the repo `Dockerfile` in `backend/`).
3. Set build and start commands (usually not needed because Dockerfile defines CMD). Ensure `PORT=8000` is set in env.
4. Add environment variables and managed DB/Redis steps as in Option A.

Health checks & scaling
- Liveness: `/health` (200 expected)
- Readiness: `/v1/ready` (returns 200 only when DB and Redis reachable)
- Set a sensible instance size and auto-scaling policy; adjust `UVICORN_WORKERS` relative to vCPU count.

Sample `render.yaml` (illustrative — adapt in Render UI if keys differ):

```yaml
services:
  - type: web
    name: janco-backend
    env: docker
    dockerImage: ghcr.io/<your-org>/janco-backend:latest
    plan: starter # change to professional for more resources
    region: oregon
    envVars:
      - key: PORT
        value: "8000"
      - key: DATABASE_URL
        value: "${{ DATABASE_URL }}"
      - key: REDIS_URL
        value: "${{ REDIS_URL }}"
      - key: SECRET_KEY
        value: "${{ SECRET_KEY }}"

databases:
  - name: janco-db
    plan: starter # choose size
    databaseName: janco_prod

```

Checklist before go-live
- Ensure `SECRET_KEY` is a securely generated secret.
- Confirm `CORS_ORIGINS` contains your frontend domains.
- Set `REMINDERS_ENABLED=false` for initial launch unless you want background tasks running.
- Configure a monitoring/log drain (optional): forward logs to Papertrail/Datadog.

If you want, I can:
- Create a `render.yaml` file in repo (I can generate a strict variant once you confirm the exact Render plan/region and whether the GHCR image will be public or private).
- Trigger a test image push via CI to confirm Render can pull it.
