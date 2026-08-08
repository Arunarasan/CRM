# PRODUCTION BLOCKERS — Arudra CRM

**Assessment date:** 2026-08-08
**Method:** Static source analysis (backend Spring Boot, config, migrations). Dynamic/live exploitation **not** performed — no staging environment was provided. Findings marked *CONFIRMED* were verified in source; *NEEDS-LIVE-CONFIRM* require a running instance to demonstrate but are strongly evidenced by code.

> **Verdict driver:** The items below marked CRITICAL/HIGH constitute broken access control on financial, payroll, and user-management endpoints, a shipped default administrator credential, and a financial-document-numbering integrity defect. Per the master plan's own rule, any authentication/authorization bypass or financial-integrity error forces a **🔴 NOT PRODUCTION READY** verdict regardless of numeric score.

---

## BLK-001 — Default administrator account seeded in production
- **Severity:** 🔴 CRITICAL
- **Module:** Deployment / Authentication (`config/DataSeeder.java:398-412`)
- **Status:** CONFIRMED
- **Description:** On every startup (all profiles, including `prod`) the seeder creates `admin@arudra.com` with password `Admin@123` and `ROLE_ADMIN` if that email does not already exist. There is no profile guard and no forced password change.
- **Steps to reproduce:** Deploy fresh → `POST /api/auth/login {"email":"admin@arudra.com","password":"Admin@123"}` → receive an admin JWT.
- **Expected:** No known/default credential in production; first admin provisioned out-of-band or forced to reset.
- **Actual:** Well-known credentials grant full admin on any fresh deploy.
- **Root cause:** Seeder is unconditional and password is hardcoded.
- **Recommended fix:** Gate sample/admin seeding behind a non-prod profile or a one-time env flag; if a bootstrap admin is required in prod, read its password from a required env var and set a "must change on first login" flag.
- **Production impact:** Full system compromise (all data, all money flows) with publicly-known credentials.

## BLK-002 — Billing/payment endpoints have no authorization
- **Severity:** 🔴 CRITICAL
- **Module:** Billing (`controller/BillingController.java` — 0 of 11 endpoints annotated)
- **Status:** CONFIRMED
- **Description:** `BillingController` has **no** `@PreAuthorize` on any method. `createInvoice`, `addPayment`, `updateInvoiceStatus`, `addNote` fall through to `SecurityConfig`'s blanket `.anyRequest().authenticated()`. Any authenticated user — including the lowest-privilege `ROLE_EMPLOYEE` — can create invoices, record customer payments, change invoice status, and post credit/debit notes.
- **Steps to reproduce:** Log in as any employee → `POST /api/billing/payments` with a `CustomerPayment` body → payment is persisted.
- **Expected:** Only finance roles (`FINANCE_WRITE`/`FINANCE_COLLECT`) may write billing data.
- **Actual:** Any logged-in user can manipulate financial records.
- **Root cause:** Missing method security; controller predates the permission model (a parallel, fully-guarded `FinanceController` exists at `/api/finance`, 45/45 annotated).
- **Recommended fix:** Add `@PreAuthorize` to every `BillingController` method, or retire the controller if `/api/finance` supersedes it. Verify the frontend uses only the guarded surface.
- **Production impact:** Financial fraud, fabricated payments/invoices, corrupted AR ledger.

## BLK-003 — Project create/update/delete unauthorized
- **Severity:** 🔴 CRITICAL
- **Module:** Projects (`controller/ProjectController.java:34-66`)
- **Status:** CONFIRMED
- **Description:** The controller defines `READ`/`WRITE`/`APPROVE` authority constants but the core CRUD methods (`getAllProjects`, `getProjectDetails`, `createProject`, `updateProject`, `deleteProject`) carry **no** `@PreAuthorize`. A code comment explicitly notes legacy endpoints "stay unauthenticated beyond SecurityConfig's blanket authenticated()." Only 40 of 58 endpoints are annotated.
- **Steps to reproduce:** Log in as any employee → `DELETE /api/projects/{id}` → project deleted.
- **Expected:** `PROJECT_WRITE`/`PROJECT_DELETE` required.
- **Actual:** Any logged-in user can delete/modify any project.
- **Root cause:** Legacy endpoints never retrofitted with method security.
- **Recommended fix:** Annotate all mutating project endpoints; audit the other 18 unguarded methods.
- **Production impact:** Destructive data loss and tampering by low-privilege users.

## BLK-004 — Widespread partial/absent authorization across controllers
- **Severity:** 🔴 HIGH
- **Module:** HR/Payroll, Users, Tasks, Notifications, Expenses, Dashboard
- **Status:** CONFIRMED (coverage counts) / NEEDS-LIVE-CONFIRM (per-endpoint impact)
- **Description:** `@PreAuthorize`-vs-endpoint coverage is inconsistent: `HrController` 31/55, `TaskController` 3/18, `ReportController` 12/15, and fully-open controllers `UserController` 0/1, `NotificationController` 0/9, `ExpenseController` 0/2, `DashboardController` 0/1. Notably `UserController.getAllUsers()` returns `userRepository.findAll()` to any authenticated user — leaking every user's email, name, and role assignments (password hash **is** protected via `@JsonProperty(WRITE_ONLY)`). Payroll endpoints among the 24 unguarded HR methods are sensitive.
- **Steps to reproduce:** Log in as any employee → `GET /api/users` → full user directory returned.
- **Expected:** Admin/HR-scoped access; self-scoping for personal HR data.
- **Actual:** Broad over-exposure; enables reconnaissance and (with BLK-009) targeted lockout.
- **Root cause:** Authorization applied per-controller ad hoc, not enforced by a baseline policy.
- **Recommended fix:** Establish a default-deny baseline; annotate every mutating/sensitive endpoint; add integration tests asserting 403 for under-privileged roles on each endpoint.
- **Production impact:** Sensitive data disclosure; unauthorized payroll/HR reads and writes.

## BLK-005 — Password reset is mocked (non-functional + token leaked to logs)
- **Severity:** 🔴 HIGH
- **Module:** Authentication (`controller/AuthController.java:142-151`)
- **Status:** CONFIRMED
- **Description:** `forgot-password` generates a reset token then only `System.out.println(...)`s the reset link ("MOCK EMAIL SENDER"). No email is sent, so password reset is unusable in production, and the reset token (a credential) is written to stdout/log aggregation.
- **Steps to reproduce:** `POST /api/auth/forgot-password` → no email arrives; token visible in server logs.
- **Expected:** Real transactional email; token never logged.
- **Actual:** Feature is a stub; secret token in logs.
- **Root cause:** Email integration never implemented.
- **Recommended fix:** Integrate an email provider; remove the token log line.
- **Production impact:** Users cannot self-recover accounts; log-based account takeover.

## BLK-006 — Duplicate financial document numbers possible (no unique constraint)
- **Severity:** 🔴 HIGH
- **Module:** Finance/Billing (`service/FinanceService.java:49-58,449,523`; migration `V9__billing_finance.sql`)
- **Status:** CONFIRMED (schema + code) / NEEDS-LIVE-CONFIRM (race window)
- **Description:** `invoice_number`, `payment_number`, and `note_number` are generated as `prefix + (findTopByOrderByIdDesc().id)` and have **no `UNIQUE` constraint** in the schema (only `refund_number` is `NOT NULL UNIQUE`). Two concurrent creates read the same top id and mint the same number; the DB will not reject it. `@Version` optimistic locking does not help (different rows).
- **Steps to reproduce:** Fire two concurrent `POST` invoice creations → both can receive e.g. `INV-1005`.
- **Expected:** Financial document numbers are globally unique and gap-controlled.
- **Actual:** Duplicates possible; numbering derived from mutable max-id.
- **Root cause:** No unique constraint + non-atomic number allocation.
- **Recommended fix:** Add `UNIQUE` constraints on the number columns; allocate numbers via a DB sequence / dedicated counter table (or retry on constraint violation). Prefer per-year atomic sequences.
- **Production impact:** Duplicate invoice/payment numbers → accounting/audit/GST integrity failure.

## BLK-007 — Wildcard CORS on every controller overrides the allowlist
- **Severity:** 🟠 MEDIUM
- **Module:** All controllers (`@CrossOrigin(origins = "*")` on 37/37); `SecurityConfig.corsConfigurationSource()`
- **Status:** CONFIRMED
- **Description:** SecurityConfig builds a specific-origin, credentialed CORS policy, but every controller is annotated `@CrossOrigin(origins="*")`, which takes precedence at the MVC layer and reflects `*`. The configured allowlist is effectively dead. (Impact is bounded because auth is a bearer header, not a cookie, so the browser won't auto-attach the token.)
- **Recommended fix:** Remove per-controller `@CrossOrigin`; rely solely on the central config, and confirm `.cors()` wires the bean (`cors(withDefaults())`).
- **Production impact:** Any origin may call the API; weakens defense-in-depth and future cookie-based flows.

## BLK-008 — Uploaded documents are publicly served, no access control; SVG/HTML allowed
- **Severity:** 🟠 MEDIUM
- **Module:** File upload (`controller/FileUploadController.java`, `config/StaticResourceConfig.java`, `SecurityConfig` `/uploads/** permitAll`)
- **Status:** CONFIRMED
- **Description:** Everything under `/uploads/**` is `permitAll` (even unauthenticated) and served from disk with no per-document authorization. Any file (invoices, ID docs, contractor KYC) is retrievable by anyone holding/guessing the URL. Upload allows `image/*` (includes `image/svg+xml`) and archives; an authenticated user can upload an SVG/HTML payload served same-origin → stored-content/XSS vector. Path traversal itself is mitigated (UUID + `cleanPath` + sanitized name).
- **Recommended fix:** Serve documents through an authenticated, authorization-checked controller (not static `permitAll`); block SVG/HTML or force `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- **Production impact:** Confidential document leakage; stored XSS.

## BLK-009 — No rate limiting; targeted account-lockout DoS
- **Severity:** 🟠 MEDIUM
- **Module:** Authentication (`AuthController`, whole API)
- **Status:** CONFIRMED
- **Description:** No throttling on `/login`, `/forgot-password`, `/refresh`, or any API. Lockout triggers after 5 failed attempts (24h auto-unlock). Combined with BLK-004 (email enumeration via `/api/users`), an attacker can lock any user for 24h, and brute-force/enumeration is unthrottled.
- **Recommended fix:** Add IP+account rate limiting (bucket4j / gateway), CAPTCHA after N failures, and throttle password-reset.
- **Production impact:** Availability (targeted lockouts), brute-force exposure, resource exhaustion.

## BLK-010 — DB constraint messages leaked to clients
- **Severity:** 🟡 LOW
- **Module:** Error handling (`exception/GlobalExceptionHandler.java:116-129`)
- **Status:** CONFIRMED
- **Description:** The generic `Exception` handler correctly hides internals, but the `DataIntegrityViolationException` handler returns `ex.getMostSpecificCause().getMessage()` to the client, exposing table/column/constraint names. `AuthController`'s manual 500 branch also returns `ex.getMessage()`.
- **Recommended fix:** Return a generic 409 message; log the cause server-side only. Remove `ex.getMessage()` from the AuthController 500 branch.
- **Production impact:** Schema disclosure aiding further attacks.

## BLK-011 — Committed weak default secrets
- **Severity:** 🟡 LOW (on Render) / 🟠 MEDIUM (any other deploy)
- **Module:** Config (`application.yml:16,29`)
- **Status:** CONFIRMED
- **Description:** `DB_PASSWORD` defaults to `1234`/`root`; `JWT_SECRET` defaults to a well-known public hex string. **Mitigated on Render** (`render.yaml`: `JWT_SECRET generateValue:true`, `DB_PASSWORD sync:false`), but any deployment that forgets these env vars silently ships a known JWT signing key (→ token forgery) and a trivial DB password.
- **Recommended fix:** Remove defaults; fail fast on startup if `JWT_SECRET`/`DB_PASSWORD` are unset in `prod`.
- **Production impact:** Auth forgery / DB compromise on misconfigured deploys.

## BLK-012 — Sample/test data seeded into empty production DB
- **Severity:** 🟠 MEDIUM
- **Module:** Deployment (`config/DataSeeder.java:414-453`)
- **Status:** CONFIRMED
- **Description:** When `customers` is empty, the seeder inserts "Acme Corp" customer + lead + project + task. On a fresh prod DB this injects fake business records.
- **Recommended fix:** Gate sample data behind a non-prod profile.
- **Production impact:** Polluted production data; misleading reports.

## BLK-013 — Startup runs raw DDL; Flyway/ddl-auto intent is contradictory
- **Severity:** 🟡 LOW–MEDIUM
- **Module:** Deployment (`config/DataSeeder.java:34-53`, `application.yml` flyway block)
- **Status:** CONFIRMED
- **Description:** A `CommandLineRunner` executes `ALTER TABLE boq_items DROP COLUMN ...` on every boot (guarded by information_schema), while its comment claims "this project has no migration tool" even though Flyway is enabled with 26 versioned migrations and `ddl-auto: validate`. Mixed schema-management strategies are fragile.
- **Recommended fix:** Move any remaining cleanup into a Flyway migration; delete the raw-DDL runner and stale comments.
- **Production impact:** Schema drift / startup-time surprises.

---

### Non-blocking observations (fix soon)
- **PERF-001 (MEDIUM):** `JwtAuthenticationFilter` calls `loadUserByUsername` on **every** request; `User.roles` is `@ManyToMany(fetch = EAGER)` with nested permissions and no caching → a users+roles+permissions query per request. Hikari `maximum-pool-size: 10`. This will be the first bottleneck under load. Consider caching authorities or embedding roles as JWT claims (already added to token) and trusting them for the request.
- **SEC-011 (LOW):** No security headers (HSTS, `X-Content-Type-Options`, `X-Frame-Options`/frame-ancestors, CSP).
- **FUNC-001 (NEEDS-LIVE-CONFIRM):** `InvoiceRepository`/`CustomerPaymentRepository` search JPQL uses `like %:search%`, which is non-standard and may throw at runtime — verify invoice/payment search works.
