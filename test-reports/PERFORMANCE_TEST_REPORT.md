# PERFORMANCE / LOAD / STRESS / SOAK REPORT — Arudra CRM

**Date:** 2026-08-08
**Status:** ⚠️ **NOT EXECUTED.** Load, stress, spike, and soak testing require a running staging environment with realistic data and a load-generation tool. None was provided, and the master plan explicitly forbids testing against production. **No latency/throughput numbers are reported because none were measured — fabricating them would violate the "do not hide or skip" rule.**

Below is (a) the static performance risk assessment I *can* give from code, and (b) a ready-to-run plan.

## Static performance risk assessment (from code)

| Risk | Evidence | Impact | Severity |
|---|---|---|---|
| Per-request auth DB hit | `JwtAuthenticationFilter` → `loadUserByUsername` on **every** request; `User.roles` is `@ManyToMany(fetch=EAGER)` + nested permissions; no cache. | 1+ join query per request; roles already in JWT but re-fetched. First bottleneck under load. | High (perf) |
| Small connection pool | `hikari.maximum-pool-size: 10` | ~10 concurrent DB ops ceiling; combined with per-request auth query, saturates early. | High (perf) |
| Free-tier infra | `render.yaml` backend `plan: free`; DB external (Aiven). | Very low CPU/RAM ceiling; not representative of prod capacity. | High |
| Potential N+1 | 179 entities, many EAGER relations (e.g. `User.roles`); list endpoints returning full entities (`GET /api/users` = `findAll()`; project/entity graphs serialized directly). | Large payloads + lazy/eager fan-out on list pages. | Medium |
| Full-entity responses | Controllers return JPA entities (not slim DTOs) for lists → over-fetching + serialization cost. | Larger payloads, more rendering. | Medium |
| Unbounded `findAll()` | `UserController.getAllUsers()` returns all users unpaged. | Grows linearly; fine now, bad at scale. | Low–Medium |

## Indexing (positive)
Flyway migrations define indexes (e.g. `idx_user_email`). A full index audit against the query set is required (category 18) — run `EXPLAIN` on the search queries (LEAD/CUSTOMER/PRODUCT/PURCHASE_ORDER use `LIKE '%term%'`, which **cannot use a normal B-tree index** → full scans as data grows; consider full-text indexes).

## Ready-to-run plan (execute on staging only)

### 1. Data generation targets
1,000 customers · 5,000 leads · 1,000 projects · 10,000 products · 50,000 tasks · 100,000 transactions · 100+ employees · 100+ contractors. Seed via SQL scripts or a seeding profile against the **staging** DB.

### 2. Tooling
- **k6** (recommended) or JMeter/Gatling. Example k6 skeleton:
```bash
# login once, reuse token; ramp VUs 10→25→50→100→250
k6 run --vus 10 --duration 2m load.js
```
`load.js` should: authenticate, then weight requests across `GET /api/projects`, `GET /api/customers?search=`, `GET /api/finance/...`, `POST` create flows.

### 3. Levels & metrics to capture
Concurrency 10 → 25 → 50 → 100 → 250. For each record: requests/sec, avg, P50, P95, P99, error %, backend CPU/mem, DB CPU, DB connections, Hikari pool usage (`hikaricp_connections_active`), network.

### 4. Stress / spike / soak
- **Stress:** ramp until errors/timeouts start; record safe capacity, breaking point, recovery point.
- **Spike:** 10→100 and 50→500 instantaneous; measure error rate + recovery time.
- **Soak:** steady realistic load for 30m / 1h / 4h / 8h; watch heap growth, DB connection count, file descriptors for leaks.

### 5. Prediction (hypothesis to validate, not a result)
Given `pool=10` + per-request auth query + free tier, expect the breaking point to be **low (tens of concurrent users)**. Validate; then (a) cache authorities / trust JWT role claims, (b) raise pool size to match DB limits, (c) convert hot list endpoints to paged DTO projections, (d) move off free tier.

## Observability gaps (category 24)
No Actuator/metrics/health config found in the reviewed files (confirm `spring-boot-starter-actuator` and a `/health` endpoint before go-live). No APM/log-aggregation/uptime monitoring evident. This must be in place before load testing so the runs are measurable.
