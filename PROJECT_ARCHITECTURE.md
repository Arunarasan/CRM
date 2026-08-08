# PROJECT_ARCHITECTURE.md

## Overview

A:\CRM is a custom CRM/ERP system built for **Arudra**, a construction/interiors-style business. It covers the full commercial lifecycle: lead capture, site visits, room measurements, quotations, project execution, contractor management, inventory/procurement, billing, and HR.

The repository contains **two fully independent applications** with no monorepo tooling tying them together:

```
A:\CRM\
├── backend\             Java 17 / Spring Boot 3.2.5 REST API
├── frontend\             React 19 + TypeScript SPA (Vite)
└── tsconfig.app.json      orphaned/unused file, not referenced by any build
```

There is no root `package.json`, no Docker/Docker Compose, no CI configuration (`.github/workflows` or equivalent), and no root README describing how to run the system end to end. This set of documents (PROJECT_ARCHITECTURE.md, DATABASE_SCHEMA.md, API_DOCUMENTATION.md, BUSINESS_WORKFLOW.md, FRONTEND_STRUCTURE.md, BACKEND_STRUCTURE.md, SECURITY_AUDIT.md) is intended to fill that gap.

## High-level architecture

```
┌─────────────────────────┐        HTTPS/HTTP (dev: localhost)        ┌──────────────────────────────┐
│   React 19 + TS SPA      │ ───────────────────────────────────────▶ │  Spring Boot 3.2.5 REST API   │
│   (Vite, port 5173 dev)  │        JSON over /api/**, JWT Bearer      │  (port 8080)                  │
│   frontend/              │ ◀─────────────────────────────────────── │  backend/                     │
└─────────────────────────┘                                           └───────────────┬───────────────┘
                                                                                        │ Spring Data JPA / Hibernate
                                                                                        ▼
                                                                        ┌──────────────────────────────┐
                                                                        │   MySQL database               │
                                                                        │   arudra_crm                   │
                                                                        │   schema auto-managed by       │
                                                                        │   Hibernate ddl-auto            │
                                                                        └──────────────────────────────┘
```

- **Frontend** is a single-page app that talks to the backend exclusively through a single axios instance (`frontend/src/lib/api.ts`), hitting a hardcoded base URL of `http://localhost:8080/api`.
- **Backend** exposes a layered REST API (`controller → service → repository → entity`) secured by stateless JWT authentication, backed by MySQL via Hibernate.
- **Database** schema is not version-controlled through migrations (no Flyway/Liquibase) — it is derived entirely from JPA entity annotations and kept in sync by Hibernate's `ddl-auto` setting per environment (`update` in dev, `validate` in prod). See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for details.

## Tech stack summary

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS 3 + shadcn/ui (new-york style) |
| Frontend routing | react-router-dom v7 (inline in `App.tsx`) |
| Frontend state | Local component state (`useState`/`useEffect`); one Zustand store for the Measurements module |
| Frontend HTTP client | axios, single instance with interceptors |
| Frontend linting | oxlint (not ESLint) |
| Backend language/runtime | Java 17 |
| Backend framework | Spring Boot 3.2.5 (Spring Web, Spring Data JPA, Spring Security, Spring AOP, Bean Validation) |
| Build tool | Maven |
| Database | MySQL (`arudra_crm` schema), JDBC via `mysql-connector-j` |
| ORM | Hibernate / Spring Data JPA (no migration tool) |
| Auth | JWT (`io.jsonwebtoken`/jjwt 0.11.5), stateless, with refresh tokens |
| Boilerplate reduction | Lombok |

## How the pieces relate

1. The browser loads the Vite-built React SPA, which lazy-loads 29 page components behind `react-router-dom` routes, wrapped by a shared `DashboardLayout` (sidebar + `<Outlet/>`) for everything except `/login`.
2. Every data operation goes through `frontend/src/lib/api.ts`, which:
   - attaches `Authorization: Bearer <token>` from `localStorage` to every request,
   - unwraps the backend's `{ success, data, message }` response envelope automatically,
   - on a `401`, attempts a silent token refresh against `/api/auth/refresh` and retries the original request, queuing concurrent requests during the refresh; on failure it clears storage and hard-redirects to `/login`.
3. The backend's `SecurityConfig` installs a stateless filter chain: `/api/auth/**` is public, everything else requires a valid JWT validated by `JwtAuthenticationFilter`/`JwtUtil`, resolved to a user via `CustomUserDetailsService`.
4. Controllers delegate to services, which use Spring Data JPA repositories against ~108 entities to read/write MySQL. AOP (`@LogActivity` + `ActivityLoggerAspect`) transparently logs activity for annotated service methods. A `@ControllerAdvice` (`GlobalExceptionHandler`) converts exceptions into a consistent JSON error shape.
5. On backend startup with an empty database, `DataSeeder` (a `CommandLineRunner`) seeds default roles, a default admin user, and sample Customer/Lead/Project/Task records — this is the only "bootstrap data" mechanism; there is no separate seed script or fixture loader.

## Deployment posture (as found)

- No containerization, no environment-specific deployment manifests, no CI/CD pipeline exist in the repository.
- Both frontend and backend are configured for **localhost development only**: the frontend's API base URL and the backend's default CORS/JWT/DB settings all assume local defaults (see [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for the specific risks this creates, e.g. hardcoded secret fallbacks).
- `backend/.env.example` documents the environment variables the app expects (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION`, `CORS_ALLOWED_ORIGINS`), but Spring Boot has no built-in `.env` loader and no `spring-dotenv` (or equivalent) dependency is declared in `pom.xml` — so a `.env` file alone will not actually configure the app; real OS/process environment variables (or a properties override) are required.
- There is no reverse proxy, load balancer, or static-asset hosting configuration present — moving this to a real environment would require that work to be done from scratch.

## Related documents

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — full entity/table reference and relationships
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — every REST endpoint, request/response shapes
- [BUSINESS_WORKFLOW.md](BUSINESS_WORKFLOW.md) — end-to-end business processes across modules
- [FRONTEND_STRUCTURE.md](FRONTEND_STRUCTURE.md) — frontend folder layout, routing, state, components
- [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) — backend package layout, layered architecture, cross-cutting concerns
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md) — security findings and recommendations
