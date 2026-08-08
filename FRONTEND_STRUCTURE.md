# FRONTEND_STRUCTURE.md

## Overview

The frontend (`frontend/`) is a React 19 + TypeScript single-page application built with Vite, styled with Tailwind CSS 3 and shadcn/ui components. Routing is handled by `react-router-dom` v7. It is a standalone app with its own `package.json` — not part of a monorepo with the backend.

## Directory layout

```
frontend/
├── index.html                  Vite entry HTML
├── vite.config.ts              Vite build config
├── tailwind.config.js          Tailwind theme config
├── postcss.config.js           PostCSS config (Tailwind pipeline)
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json   TS project references
├── components.json             shadcn/ui config (new-york style, @/* path aliases)
├── .oxlintrc.json               oxlint (Rust-based linter) config
├── package.json / package-lock.json
├── README.md                    generic unedited Vite template boilerplate — not project-specific
├── refactor_api.cjs             one-off Node codemod script that migrated 29 pages from raw axios calls
│                                 to the shared api instance; not wired into any npm script, dead weight
├── public/                      favicon.svg, icons.svg
└── src/
    ├── main.tsx                 ReactDOM root, renders <App/>
    ├── App.tsx                  All route definitions (react-router-dom v7), lazy-loaded pages
    ├── App.css / index.css      global styles, Tailwind directives
    ├── api/
    │   └── measurementApi.ts    only dedicated per-feature API module in the app; wraps lib/api
    ├── assets/                  hero.png, react.svg, vite.svg
    ├── components/
    │   ├── dashboard/           DashboardStatsCards, LeadPipelineChart, ProjectProgressList,
    │   │                        RecentCustomersTable, RevenueChart, TasksAndFollowUps
    │   └── ui/                  shadcn/ui primitives: button, card, dialog, dropdown-menu,
    │                            input, label, switch, table, tabs
    ├── context/                 EMPTY — no React Context used anywhere in the app
    ├── hooks/                   EMPTY — no custom hooks extracted
    ├── layouts/
    │   └── DashboardLayout.tsx  sidebar nav + <Outlet/>; polls /notifications/unread-count every 30s
    ├── lib/
    │   ├── api.ts                single axios instance + interceptors (see below)
    │   └── utils.ts              cn() helper (clsx + tailwind-merge)
    ├── pages/                    29 top-level route-bound page components (see table below)
    │   ├── leads/tabs/           EMPTY — no files
    │   └── measurements/         MeasurementList.tsx, MeasurementForm.tsx, MeasurementDetails.tsx
    ├── routes/                   EMPTY — routing is fully inline in App.tsx, this folder is unused
    ├── services/                 EMPTY — no service-layer abstraction beyond lib/api.ts
    ├── store/
    │   └── measurementStore.ts   the only Zustand store in the app (measurements list/active/rooms)
    ├── types/
    │   ├── dashboard.ts
    │   └── measurement.ts
    └── utils/                    EMPTY
```

Several scaffold directories (`context/`, `hooks/`, `routes/`, `services/`, `utils/`, `pages/leads/tabs/`) exist but contain no files. This suggests an intended layered structure (routes split out, API calls behind a services layer, shared hooks, etc.) that was never filled in — most pages instead call the axios instance directly and manage state locally.

## Routing

All routes are declared inline in `frontend/src/App.tsx` using `react-router-dom` v7, with every page component wrapped in `React.lazy()` for code-splitting. There is **no `ProtectedRoute`/auth-guard wrapper** — all routes render their component tree regardless of whether a valid JWT is present in `localStorage`. Auth enforcement happens only at the API layer (a 401 response triggers redirect-to-login via the axios interceptor), not at the route layer.

| Route | Page component(s) | Purpose |
|---|---|---|
| `/login` | `Login.tsx` | Auth form; POSTs `/auth/login`, stores `token`/`refreshToken`/roles in `localStorage`, hard-redirects to `/dashboard` |
| `/` | — (redirect) | Redirects to `/dashboard` |
| `/dashboard` | `Dashboard.tsx` | KPI cards, revenue chart, lead pipeline chart, tasks/follow-ups, recent customers; calls `/dashboard/summary` |
| `/users` | inline placeholder `<div>` in `App.tsx` | **Stub — not implemented** |
| `/customers`, `/customers/:id` | `Customers.tsx`, `CustomerProfile.tsx` | Customer list / detail |
| `/leads`, `/leads/:id` | `Leads.tsx`, `LeadProfile.tsx` | Lead list / detail |
| `/site-visits`, `/site-visits/:id` | `SiteVisits.tsx`, `SiteVisitProfile.tsx` | Site visit list / detail |
| `/measurements`, `/measurements/new`, `/measurements/:id` | `measurements/MeasurementList.tsx`, `MeasurementForm.tsx`, `MeasurementDetails.tsx` | Measurement CRUD (standalone measurement module, see BUSINESS_WORKFLOW.md for its relationship to site-visit measurements) |
| `/quotations`, `/quotations/builder`, `/quotations/builder/:id`, `/quotations/:id` | `Quotations.tsx`, `QuotationBuilder.tsx`, `QuotationView.tsx` | Quotation list, builder (create/edit), read-only view |
| `/projects`, `/projects/:id` | `Projects.tsx`, `ProjectCommandCenter.tsx` | Project list / detail |
| `/tasks` | `Tasks.tsx` | Task board/list |
| `/contractors`, `/contractors/:id` | `Contractors.tsx`, `ContractorProfile.tsx` | Contractor list / detail |
| `/inventory` | `Inventory.tsx` | Inventory management |
| `/purchases`, `/purchases/orders/new`, `/purchases/orders/:id` | `Purchases.tsx`, `PurchaseOrderBuilder.tsx`, `PurchaseOrderProfile.tsx` | Purchase order flow |
| `/billing`, `/billing/invoices/new`, `/billing/invoices/:id` | `Billing.tsx`, `InvoiceBuilder.tsx`, `InvoiceProfile.tsx` | Billing / invoice flow |
| `/hr`, `/hr/employees/:id` | `HumanResources.tsx`, `EmployeeProfile.tsx` | HR module |
| `/reports` | `ReportsHub.tsx` | Reports (only page referencing Expenses) |
| `/notifications` | `NotificationCenter.tsx` | Notification center |
| `/settings` | inline placeholder `<div>` in `App.tsx` | **Stub — not implemented** |

## State management

- **No Redux** despite `@reduxjs/toolkit`/`react-redux`/`redux` appearing in `node_modules` — these are transitive dependencies of something else and are not imported anywhere under `src/`.
- **No React Context** — `src/context/` is empty.
- **One Zustand store** — `src/store/measurementStore.ts`, scoped only to the Measurements feature (list, active measurement, rooms).
- Everywhere else, state is local `useState`/`useEffect` inside each page component, with data fetched directly via the shared axios instance on mount.

## API layer

`frontend/src/lib/api.ts` is the single point of contact with the backend:

- Axios instance with `baseURL: 'http://localhost:8080/api'` **hardcoded** — not driven by a Vite env var (`import.meta.env.VITE_API_URL`); no `frontend/.env` exists.
- **Request interceptor**: reads `localStorage.getItem('token')` and attaches `Authorization: Bearer <token>` to every outgoing request.
- **Response interceptor**:
  - Unwraps the backend's `{ success, data, message }` envelope so callers receive `response.data` directly as the `data` payload.
  - On `401`, attempts a token refresh via `POST /auth/refresh` (queuing concurrent in-flight requests to avoid duplicate refresh calls), retries the original request on success, and on refresh failure clears stored tokens and hard-redirects to `/login`.
- `src/api/measurementApi.ts` is the only page-specific wrapper module built on top of this instance; every other page calls `api.get/post/put/delete(...)` directly inline (confirmed by the historical `refactor_api.cjs` codemod that converted 29 pages from raw `axios` calls to this shared instance).
- `Dashboard.tsx` manually re-adds an `Authorization: Bearer ...` header on its own `/dashboard/summary` call even though the interceptor already does this globally — redundant leftover code.

## Components

- `components/ui/` — shadcn/ui primitives (button, card, dialog, dropdown-menu, input, label, switch, table, tabs), the design-system building blocks used across all pages.
- `components/dashboard/` — dashboard-specific composite widgets (stats cards, charts, tables) consumed only by `Dashboard.tsx`.
- No shared component library exists for other modules (e.g. no reusable `LeadCard`, `CustomerTable` abstraction) — each page largely builds its own UI from the shadcn primitives.

## Testing

No test runner is configured in `package.json`, and no `*.test.*` / `*.spec.*` files exist anywhere under `frontend/src`. There is no frontend test coverage.

## Notable gaps

- `/users` and `/settings` routes are unimplemented placeholders.
- `src/context/`, `src/hooks/`, `src/routes/`, `src/services/`, `src/utils/`, `src/pages/leads/tabs/` are empty scaffold directories.
- No auth route guarding at the UI level.
- API base URL is hardcoded, requiring a code change (not just config) to point at a different backend.
- `refactor_api.cjs` is a dead one-time migration script left in the repo root.

See [BACKEND_STRUCTURE.md](BACKEND_STRUCTURE.md) for the server side this frontend talks to, and [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for the exact endpoints each page consumes.
