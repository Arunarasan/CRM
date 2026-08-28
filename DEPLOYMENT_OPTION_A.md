# Deploying Option A — one host, website at `/`, CRM at `/crm`

The public website (`website/`) and the CRM (`frontend/`) are served from **one nginx container**
that holds both built bundles. The Spring Boot backend is unchanged.

Artifacts:
- **`Dockerfile.web`** (repo root) — builds `website/` (base `/`) + `frontend/` (base `/crm/`) and
  copies both into nginx.
- **`nginx.web.conf`** (repo root) — routes `/crm/*` → CRM SPA, `/*` → website SPA, and proxies
  `/api` + `/uploads` to the backend.
- **`frontend/vite.config.ts`** — production `base: '/crm/'` (dev stays `/`, so the CRM dev workflow
  is unchanged). Overridable with `VITE_BASE`.
- **`frontend/src/App.tsx`** — router `basename={import.meta.env.BASE_URL}` follows that base.

## Local / self-hosted (docker-compose)
Already wired — the `web` service builds `Dockerfile.web`:
```bash
docker compose up --build
# → website at http://localhost/  ·  CRM at http://localhost/crm  ·  API proxied to backend
```
Here nginx proxies `/api` to the `backend` service, so the SPAs call same-origin `/api`.

## Render (production)
Render runs the website + CRM bundles from one Docker web service. Replace the current
`crm-frontend` static-site block in `render.yaml` with:

```yaml
  - type: web
    name: jbdecor-web
    runtime: docker
    dockerfilePath: ./Dockerfile.web
    dockerContext: .
    plan: free
    healthCheckPath: /healthz
    envVars:
      # Build-time: the SPAs call the backend directly (CORS already allows it). Point at the
      # backend's public API. nginx's /api proxy is only used in docker-compose.
      - key: VITE_API_URL
        value: https://crm-backend.onrender.com/api
```
Then add the website origin to the backend's `CORS_ALLOWED_ORIGINS` (e.g.
`https://jbdecor-web.onrender.com`). No second host, no second bill — one service serves both.

## Before go-live
- Replace `https://jbdecor.com` in `website/public/robots.txt` and `sitemap.xml` with the real host.
- Set `website/.env` values (`VITE_WHATSAPP_NUMBER`, contact details, `VITE_CRM_URL`).
