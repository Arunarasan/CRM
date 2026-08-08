# Security Audit — Arudra CRM

**Scope:** `backend` (Java 17 / Spring Boot 3.2.5, MySQL, JWT) and `frontend` (React 19 + TypeScript)
**Date:** 2026-07-17
**Type:** Static code review (read-only, documentation only — no code was modified)
**Repository state:** Confirmed **not a git repository** (`git status` at `A:\CRM` returns "fatal: not a git repository"). There is no `.git` directory anywhere under `A:\CRM`. This means the git-exposure risks noted below (hardcoded secrets, default credentials) are currently *theoretical* — but will become real the moment this project is `git init`'d and pushed, since the current `application.yml` / `.env.example` would be committed as-is unless remediated first.

---

## 1. Executive summary

| # | Severity | Finding |
|---|----------|---------|
| 1 | **Critical** | Only 1 of 17 REST controllers (`CustomerController`) enforces any role/permission check. All other controllers — including `HrController` (payroll, salaries, performance reviews), `BillingController`, `ReportController`, `PurchaseController` — allow **any authenticated user** to read/write, regardless of role. `Role`/`Permission` entities exist but are almost entirely unused. |
| 2 | **Critical** | `MeasurementController` derives the acting user's identity and role from client-supplied `X-User-Name` / `X-User-Role` request headers instead of the authenticated JWT principal (`MeasurementController.java:32,37,47`). Any authenticated (or in some deployments unauthenticated) caller can spoof an arbitrary username/role for audit and authorization purposes. |
| 3 | **High** | Hardcoded fallback JWT signing secret and DB password shipped in `application.yml` and `.env.example` (`jwt.secret: ${JWT_SECRET:404E6352...}`, `DB_PASSWORD:1234`). If `JWT_SECRET` is not set in the deployment environment, the app silently signs tokens with this static, source-committed value, letting anyone who has read the repo forge valid JWTs for any user/role. |
| 4 | **High** | Widespread mass-assignment: ~90% of `@PostMapping`/`@PutMapping` endpoints bind JPA entities directly from `@RequestBody` (not DTOs), including the inherited `id`, `createdBy`, `isDeleted` fields from `BaseEntity`. Because `JpaRepository.save()` treats a non-null `id` as an update, a client can pass an arbitrary `"id"` in a *create* request body and silently overwrite an unrelated existing record (e.g. `TaskService.createTask` → `taskRepository.save(task)`, `ContractorService.createContractor` → `contractorRepository.save(contractor)`). |
| 5 | **Medium** | `NotificationController` hardcodes `CURRENT_USER_ID = 1L` for every inbox/settings/read operation (`NotificationController.java:22`, comment: *"Hardcode for now, but in production this comes from JWT/Session"*). Every logged-in user reads and mutates user #1's notifications and settings; the feature is not multi-tenant safe. |
| 6 | **Medium** | 16 of 17 controllers declare `@CrossOrigin(origins = "*")` at the class level, alongside a separate, more restrictive global CORS policy in `SecurityConfig`. The two configurations conflict; the practical effect is that the origin allowlist in `SecurityConfig` is not reliably enforced for these endpoints. |
| 7 | **Medium** | No request-level input validation: zero `@Valid` annotations anywhere in the controller layer and zero Bean Validation annotations (`@NotNull`, `@NotBlank`, `@Size`, etc.) in the `dto` package (checked all files under `dto/`). A handful of entities have validation annotations, but since entities are saved directly, violations surface as an uncaught `ConstraintViolationException` → generic 500 response, not a clean 400. |
| 8 | **Medium** | Login brute-force protection is account-based only (5 failed attempts → 24h lock), with no per-IP throttling, no CAPTCHA, and no rate limiting anywhere in the app (no such dependency in `pom.xml`). `/api/auth/forgot-password` and `/api/auth/login` can be hit at unlimited rate. |
| 9 | **Low** | `AuthController.login`'s catch-all `Exception` handler returns `ex.getMessage()` directly to the client (`AuthController.java:94`), bypassing `GlobalExceptionHandler`'s "don't leak internals" policy used everywhere else. |
| 10 | **Low** | Refresh tokens are not rotated on use (`/api/auth/refresh` returns the *same* refresh token back to the client) and only one refresh token per user is allowed system-wide (new login invalidates all other sessions/devices). |
| 11 | **Info** | JWT access tokens stored in `localStorage` on the frontend (`frontend/src/lib/api.ts:30,70`) — readable by any injected/XSS script; no `httpOnly` cookie option is used. |
| 12 | **Info** | No HTTPS enforcement anywhere in the Spring config (no `server.ssl.*`, no HSTS header, frontend `baseURL` hardcoded to `http://localhost:8080/api`). Expected for local dev, but must be hardened before any real deployment. |
| 13 | **Info** | SQL injection risk is low: every `@Query` in the repository layer uses JPQL with bound `:parameters`; the one native query (`QuotationRepository.getMonthlyRevenue`) has no user input. No raw string concatenation found. |
| 14 | **Info** | Password hashing uses `BCryptPasswordEncoder` (good default). Forgot-password flow correctly returns a uniform response regardless of whether the email exists (prevents enumeration). |

---

## 2. Authentication & session management

**JWT implementation** — `backend/src/main/java/com/arudra/crm/security/JwtUtil.java`
- Algorithm: `HS256` via `io.jsonwebtoken` (`jjwt` 0.11.5), key built with `Keys.hmacShaKeyFor(secret.getBytes())` (`JwtUtil.java:27`). HS256 with a sufficiently random, sufficiently long secret is acceptable; see §4 for the secret-quality problem.
- Claims: subject = user email, custom `roles` claim carrying `GrantedAuthority` objects (`JwtUtil.java:44-47`). No `iss`/`aud`/`jti` claims — tokens are not scoped to a specific issuer/audience, which is fine for a single-service deployment but worth flagging if this token is ever accepted by another service.
- Expiry: `jwt.expiration` = 900000 ms = **15 minutes** by default (`application.yml`), reasonable for an access token.
- Validation: `JwtAuthenticationFilter.doFilterInternal` (`JwtAuthenticationFilter.java:34-58`) extracts the bearer token, resolves the username, then calls `jwtUtil.validateToken(token, userDetails)`, which checks `username.equals(...) && !isTokenExpired(...)` (`JwtUtil.java:60-63`). Signature verification happens implicitly inside `extractAllClaims` (`Jwts.parserBuilder().setSigningKey(...).parseClaimsJws(token)`) — a tampered/unsigned token throws and is caught, so this is sound.
- **Refresh token flow** — `RefreshTokenService.java`: opaque UUID tokens stored in the `refresh_tokens` table, 7 days (default) or 30 days (`rememberMe`) expiry (`RefreshTokenService.java:36`). `createRefreshToken` deletes any existing refresh token for the user before issuing a new one (`RefreshTokenService.java:30`) — this means **logging in on a second device invalidates the first device's refresh token** (single active refresh token per user; not necessarily intended behavior for a business CRM with multiple concurrent sessions).
- The `/api/auth/refresh` endpoint (`AuthController.java:127-140`) issues a new access token but **returns the same refresh token unchanged** — no rotation, so a leaked refresh token remains valid for its full 7/30-day lifetime even after being used.

**Password hashing** — `SecurityConfig.passwordEncoder()` returns `new BCryptPasswordEncoder()` (`SecurityConfig.java:52-55`), used for both login (`DaoAuthenticationProvider`) and password reset (`AuthController.java:160`). This is correct practice.

**Account lockout** — `AuthController.handleFailedAttempt` (`AuthController.java:98-109`) increments `failedAttempts` on `BadCredentialsException`; at 5 attempts it sets `accountNonLocked = false` and records `lockTime`. `CustomUserDetailsService.loadUserByUsername` (`CustomUserDetailsService.java:37-45`) auto-unlocks the account 24 hours after `lockTime`. This is *account*-scoped, not IP-scoped — an attacker can still brute-force many different accounts in parallel from one IP with no throttling at all, and there is no CAPTCHA or exponential backoff.

**Login history** — `LoginHistory` entity records `user`, `attemptedEmail`, `ipAddress`, `status`, `loginTime` (`LoginHistory.java`) and is written on every login attempt (success/failure) for **existing** accounts (`AuthController.logHistory`, called from both the success path and `handleFailedAttempt`). Failed attempts against a non-existent email are not logged (silently skipped, since `handleFailedAttempt` uses `userRepository.findByEmail(email).ifPresent(...)`), so there is no record of enumeration attempts against unknown emails.

**Password reset** (`AuthController.forgotPassword` / `resetPassword`, `VerificationTokenService.java`):
- Token: random `UUID`, 24-hour expiry (`VerificationTokenService.java:29`), single-use — deleted after successful reset (`AuthController.java:162`).
- Purpose-scoped (`"PASSWORD_RESET"`) via the `purpose` field, filtered on both creation and consumption.
- Correctly returns a generic success message regardless of whether the email exists (`AuthController.java:150`), preventing user enumeration via this endpoint.
- **No rate limiting** on `/api/auth/forgot-password` — an attacker can trigger unlimited token generation / mock "emails" for any address.
- The reset link is only "sent" via `System.out.println` (mock email sender, `AuthController.java:147`) — expected for a dev-stage app, but flagged as a functional gap, not a vulnerability per se.

---

## 3. Authorization

**Role/Permission model exists but is almost entirely vestigial.** `Role` (`entity/Role.java`) and `Permission` (`entity/Permission.java`) entities are seeded (`ROLE_ADMIN`, `ROLE_SALES`, `ROLE_PROJECT_MANAGER`, `ROLE_EMPLOYEE` in `DataSeeder.java:34`) and correctly loaded into Spring Security's `GrantedAuthority` set in `CustomUserDetailsService.loadUserByUsername` (`CustomUserDetailsService.java:26-35`, adds both role names and permission names as authorities). `SecurityConfig` enables `@EnableMethodSecurity` (`SecurityConfig.java:23`), so `@PreAuthorize` is wired up and functional.

However, a grep across the entire `controller` package for `@PreAuthorize|@Secured|hasRole|hasAuthority` returns matches in **exactly one file**: `CustomerController.java` (9 occurrences, one per endpoint). Every other controller — `AuthController` (expected, public), `BillingController`, `ContractorController`, `DashboardController`, `ExpenseController`, `HrController`, `InventoryController`, `LeadController`, `MeasurementController`, `NotificationController`, `ProjectController`, `PurchaseController`, `QuotationController`, `ReportController`, `SiteVisitController`, `TaskController` — has **no method-level or class-level authorization annotation at all**. The only gate on these endpoints is `SecurityConfig`'s blanket rule `.anyRequest().authenticated()` (`SecurityConfig.java:41`): once a user obtains *any* valid JWT (e.g. the `ROLE_EMPLOYEE` seeded role), they can:
- Read and create payroll/salary records and performance reviews (`HrController.java:102-133`)
- Approve/reject leave requests for any employee (`HrController.java:80-88`)
- Read/create supplier bills, purchase orders, GRNs (`PurchaseController.java`)
- Read/create invoices and customer payments (`BillingController.java`)
- Read company-wide revenue/sales dashboards (`ReportController.java`, `DashboardController.java`)

This is the single most significant finding in this audit: the permission model exists in the database schema and is technically enforceable, but it is only actually checked for the `Customer` resource.

**Note on `CustomerController`'s `hasAnyRole('ADMIN', 'MANAGER', 'SALES')`** (`CustomerController.java:22`): `hasAnyRole` auto-prefixes `ROLE_`, so this checks for authority `ROLE_MANAGER` — a role that is **not** among the four roles seeded in `DataSeeder.java` (`ROLE_ADMIN`, `ROLE_SALES`, `ROLE_PROJECT_MANAGER`, `ROLE_EMPLOYEE`). This looks like a naming mismatch/typo (`MANAGER` vs `PROJECT_MANAGER`) that would make the `GET /api/customers` list endpoint unreachable for the project-manager role as currently seeded.

**IDOR (Insecure Direct Object Reference) risk.** This CRM is single-tenant (one company's staff accessing shared company records), so cross-*customer* data isolation is not the model — but two concrete IDOR-flavored issues were found:
- **Record overwrite via mass assignment** (see §6): because entities are saved directly from request bodies and `id` is a bindable field, a "create" call with a guessed/known `id` can silently overwrite another record the caller has no business editing — e.g. `POST /api/tasks` with `{"id": 42, ...}` will update Task #42 instead of creating a new task, with no ownership check performed anywhere in `TaskService.createTask` (`TaskService.java:59-63`).
- **`MeasurementController`'s client-supplied identity headers** (`X-User-Name`, `X-User-Role`, `MeasurementController.java:32,37,47`) mean any caller can attribute actions to, or claim the privileges of, an arbitrary user/role string, since these values are trusted as-is rather than derived from `SecurityContextHolder`/JWT.
- `NotificationController`'s hardcoded `CURRENT_USER_ID = 1L` (§1, finding 5) is a related but distinct bug: it's not attacker-controlled, but it means the notification feature has no real per-user scoping at all.

---

## 4. Secrets management

**Hardcoded defaults in `application.yml`** (`backend/src/main/resources/application.yml`):
```yaml
datasource:
  password: ${DB_PASSWORD:1234}
jwt:
  secret: ${JWT_SECRET:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}
  expiration: ${JWT_EXPIRATION:900000}
```
Both the DB password (`1234`) and the JWT secret have fallback defaults baked directly into the committed config file, and the **exact same values** are duplicated in `backend/.env.example`. Decoding the hex JWT-secret default yields the ASCII string `@NcRfUjXn2r5u8x/A?D(G+KbPdSgVkYp` — a 32-byte (256-bit) string that has the shape of a well-known placeholder/example key seen in various public JWT/crypto tutorials, not a value generated for this project. If any environment (dev, staging, or worse, prod) runs without `JWT_SECRET` set, the application will silently sign all tokens with this static, source-visible key — anyone with read access to the repository (or this audit document) can then mint arbitrary valid JWTs for any user/role, including `ROLE_ADMIN`, without ever authenticating. This is the most severe secrets-management issue in the codebase.

**`.env` is not actually auto-loaded by the application.** `backend/pom.xml` was checked for a dotenv-style dependency (`me.paulschwarz:spring-dotenv`, `io.github.cdimascio:java-dotenv`, etc.) — **none is present**. `.env.example` is documentation-only; the real mechanism for supplying `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRATION`, `CORS_ALLOWED_ORIGINS` is native OS/container environment variables (Spring's `${VAR:default}` placeholder resolution), e.g. via `docker-compose`, systemd `Environment=`, or a shell export before `java -jar`. This is a reasonable pattern, but it means a developer copying `.env.example` to `.env` and expecting it to "just work" will silently fall back to the hardcoded defaults above unless they also wire up a mechanism to export those values into the process environment.

**Git exposure risk** — re-verified: `A:\CRM` has no `.git` directory (`git status` fails with "not a git repository"); only `frontend/.gitignore` exists, and there is no root/backend `.gitignore`. If this project is initialized with git today and pushed as-is, `application.yml` and `.env.example` (containing the fallback secret and DB password) would be committed and become permanently part of history unless purged. **Recommendation: add a `.gitignore` for `backend/.env` and rotate/randomize the `jwt.secret` and `DB_PASSWORD` defaults (or remove the defaults entirely and fail fast if unset) before this repo is ever put under version control.**

---

## 5. CORS

Two independent, conflicting CORS configurations exist:

1. **Global (Spring Security), `SecurityConfig.java:70-81`** — a `CorsConfigurationSource` bean registered for `/**`, driven by `app.cors.allowed-origins` (`SecurityConfig.java:32`):
   - `application-dev.yml`: defaults to `http://localhost:5173,http://localhost:3000`
   - `application-prod.yml`: defaults to `https://crm.arudra.com,https://app.arudra.com`
   - `allowCredentials(true)`, explicit method/header allowlists. This is a sensible, environment-aware policy.

2. **Per-controller, `@CrossOrigin(origins = "*")`** — present on 16 of 17 controllers (all except `CustomerController`, which has no `@CrossOrigin` at all and therefore relies solely on the global policy — the one controller that also happens to be the one with real authorization checks).

**Practical effect:** `SecurityConfig`'s `.cors(cors -> cors.configure(http))` (`SecurityConfig.java:38`) wires Spring Security's `CorsFilter` to use the registered `CorsConfigurationSource` bean, which runs early in the filter chain and governs CORS preflight (`OPTIONS`) handling for every path. However, Spring MVC's own handler-level CORS processing (triggered by the `@CrossOrigin` annotation) also runs once the request reaches `DispatcherServlet`/`HandlerMapping`, and for the 16 annotated controllers it applies the annotation's `origins = "*"` policy to the actual response. In practice this means the origin allowlist defined in `SecurityConfig` is **not reliably the effective policy** for any endpoint outside `CustomerController` — the `*` annotation undermines it. The two configurations should never have been combined; having both is a code-hygiene problem that makes the actual runtime behavior ambiguous and inconsistent between endpoints, which is itself a risk (the team likely *believes* CORS is locked down to known origins, per `SecurityConfig`, when in practice it mostly isn't).

**Mitigating factor:** this API authenticates via a `Bearer` token attached manually in JS (`frontend/src/lib/api.ts:31-33`), not via an automatically-sent cookie, and the frontend axios instance does not set `withCredentials: true`. A malicious page on another origin cannot read the victim's `localStorage` token (blocked by the browser's same-origin policy independent of CORS), so it cannot forge the `Authorization` header needed to ride an authenticated session purely by virtue of permissive CORS. The wildcard CORS is therefore not immediately exploitable for cross-origin session riding under the current auth model, but it is still bad practice, inconsistent with the intended origin allowlist, and would become dangerous if the auth model ever moves to cookies (or if any endpoint is added that trusts an `Origin`/`Referer` header for anything).

**Recommendation:** remove all 16 `@CrossOrigin(origins = "*")` annotations and rely solely on the `SecurityConfig` global bean.

---

## 6. Input validation & injection risks

**SQL injection — low risk, confirmed.** Every repository method was reviewed. All `@Query` annotations use JPQL with named `:parameter` bindings (e.g. `CustomerRepository.searchCustomers`, `LeadRepository.searchLeads`, `QuotationRepository.searchQuotations` — all use `LOWER(x) LIKE LOWER(CONCAT('%', :search, '%'))` pattern, never raw string concatenation of user input into the query text). The single native query, `QuotationRepository.getMonthlyRevenue()` (`QuotationRepository.java:33`), is a fixed literal string with no parameters at all. No evidence of `Statement`/raw JDBC usage or `EntityManager.createNativeQuery` with concatenated input anywhere in the codebase. **No SQL injection vectors were found.**

**Request validation — effectively absent.** `grep -r "@Valid" controller/` returns zero matches across all 17 controllers, and `grep` for `@NotNull|@NotBlank|@NotEmpty|@Size|@Email|@Pattern|@Min|@Max` in the entire `dto` package also returns zero matches. `spring-boot-starter-validation` is a declared dependency (`pom.xml`) but is never actually invoked at the controller boundary. A handful of entities (`User`, `Customer`, `Lead`, `Task`, `Project`, `ProjectStage`, `ProjectQualityCheck`, `ProjectCustomerApproval`) do carry Bean Validation annotations (e.g. `User.java:20-29` has `@NotBlank @Email` on `email`, `@NotBlank` on `password`/`name`), but because controllers bind and save these entities directly rather than going through `@Valid`-annotated DTOs, any violation is only caught by Hibernate's automatic pre-persist validation and surfaces as an uncaught `jakarta.validation.ConstraintViolationException`. `GlobalExceptionHandler` has no handler for that exception type, so it falls through to the generic `Exception` handler (`GlobalExceptionHandler.java:97-110`) and returns an opaque `500 Internal Server Error` instead of a proper `400 Bad Request` — functionally confusing, though it does not leak information (see §8).

**Mass assignment — confirmed, and concretely exploitable.** Grepping `@RequestBody` across all controllers shows the large majority bind JPA `@Entity` classes directly (`Task`, `Lead`, `Project`, `Contractor`, `Employee`, `SalaryRecord`, `Department`, `Attendance`, `LeaveRequest`, `EmployeeDocument`, `PerformanceReview`, `Supplier`, `PurchaseBill`, `PurchasePayment`, `Invoice`-adjacent types, `SiteVisit`, `Measurement`, `Product`, `InventoryTransaction`, `Quotation`, `NotificationSettings`, etc.) rather than dedicated request DTOs. Only `CustomerController`, `AuthController`, and parts of `BillingController`/`PurchaseController` use DTOs. Because these entities extend `BaseEntity` (`entity/BaseEntity.java`), which exposes a bindable `id` field (`GenerationType.IDENTITY`, no `@JsonIgnore`), and the corresponding service methods pass the bound entity straight to `repository.save(...)` (confirmed in `TaskService.createTask` → `taskRepository.save(task)`, `ContractorService.createContractor` → `contractorRepository.save(contractor)`), a client can supply an `id` for an *existing* row in what is nominally a "create" request. Spring Data JPA's `save()` treats a non-null identifier as "not new" and performs `EntityManager.merge()`, overwriting the targeted row with attacker-supplied field values — including any field on the entity that the frontend never intended to be user-settable (e.g. `createdBy`, `isDeleted`, foreign-key relationship fields, or business fields the UI hides). This applies broadly across the create/update endpoints listed above; it was spot-verified in `TaskService` and `ContractorService` but the same `save(directlyBoundEntity)` pattern recurs throughout the `service` package.

---

## 7. Frontend security

`frontend/src/lib/api.ts`:
- Access token and refresh token are both stored in `localStorage` (`localStorage.getItem('token')` at line 30, `setItem('token', ...)`/`setItem('refreshToken', ...)` at lines 82-83). **XSS implication:** any successful script injection (stored/reflected XSS, or a compromised third-party npm dependency) can read `localStorage` directly and exfiltrate both tokens, giving a persistent attacker the ability to silently refresh access tokens indefinitely (since the refresh token itself is also exposed and not `httpOnly`). An `httpOnly`, `Secure`, `SameSite=Strict` cookie for the refresh token (with the access token kept short-lived in memory) would meaningfully reduce this blast radius; this app uses neither.
- Token attachment: a request interceptor (`api.ts:28-37`) attaches `Authorization: Bearer <token>` to every outgoing request from `localStorage`.
- Refresh flow: a response interceptor (`api.ts:39-101`) catches `401`s, queues concurrent requests while a refresh is in flight, calls `POST /api/auth/refresh`, and on success replays queued requests with the new token; on failure it clears both tokens and hard-redirects to `/login` (`api.ts:91-93`). The concurrency handling (queue + `isRefreshing` flag) is implemented correctly and avoids a refresh-token stampede.
- `baseURL` is hardcoded to `http://localhost:8080/api` (`api.ts:4`) — plain HTTP, and not environment-configurable (no `import.meta.env.VITE_API_URL` or similar was found anywhere in `frontend/src`). This is fine for local dev but means the frontend cannot point at a different/HTTPS backend without a code change and rebuild.
- No hardcoded API keys or secrets were found anywhere in `frontend/src` (searched for `api[_-]?key`, `secret`, `VITE_`, `import.meta.env`, `process.env` — zero matches). No `.env` files exist under `frontend/`.
- No sensitive data (tokens, passwords, PII) was found being placed in URL query strings; the password-reset token is passed as a URL query param (`?token=...`, mocked in `AuthController.java:147`) which is a common, generally-accepted pattern for reset links but does mean the token can end up in browser history/referrer logs — low risk given its 24h expiry and single-use consumption.

---

## 8. Error handling & information disclosure

`GlobalExceptionHandler.java` is generally well-built:
- `ResourceNotFoundException` → 404 with the exception's own message (`handleResourceNotFoundException`, line 21-33) — safe, these messages are developer-authored (e.g. "Customer not found").
- `MethodArgumentNotValidException` → 400 with field-level validation messages (line 35-53) — safe, these are the DTO's own `@NotBlank`-style messages (though as noted in §6, this handler is effectively dead code today since nothing triggers `@Valid`).
- `AccessDeniedException` → 403 with a fixed generic message, not `ex.getMessage()` (line 55-67) — safe.
- `AuthenticationException` → 401 with a fixed generic message (line 69-81) — safe.
- `SQLIntegrityConstraintViolationException` → 409 with a fixed generic message, no raw SQL/constraint name exposed (line 83-95) — safe.
- Catch-all `Exception` → 500 with the hardcoded string `"An unexpected error occurred"` and an explicit code comment `// Do not expose stack traces!` (line 97-110) — the exception itself is only logged server-side via `log.error("Unexpected error occurred: ", ex)` (full stack trace to logs, not to the client). **This is correct, security-conscious design.**

**One exception to the above pattern:** `AuthController.login`'s own local `try/catch` (not routed through `GlobalExceptionHandler`) has a catch-all block that returns `ex.getMessage()` directly in the JSON response body: `Map.of("success", false, "message", ex.getMessage())` (`AuthController.java:93-94`). Depending on what underlying exception is thrown here (e.g. a database connectivity error, a `NullPointerException` message, or any other unexpected runtime exception during authentication), this could leak internal implementation details to an unauthenticated caller — inconsistent with the "don't expose internals" discipline used everywhere else in the codebase. Low likelihood of triggering in normal operation (most auth failures are caught earlier by `BadCredentialsException`/`LockedException`), but should be fixed for consistency.

---

## 9. Data-at-rest / transport

- No `server.ssl.*` configuration exists in `application.yml`, `application-dev.yml`, or `application-prod.yml` — the embedded Tomcat server runs plain HTTP in every profile, including the `prod` profile.
- No HSTS header, no forced HTTPS redirect, no `Secure` cookie flags (moot, since no auth cookies are used — see §7).
- `DB_URL` default explicitly disables SSL to MySQL: `useSSL=false` (`application.yml`) — data in transit to the database is unencrypted by default.
- Frontend `baseURL` is hardcoded `http://` (§7).
- `application-prod.yml`'s CORS default origins (`https://crm.arudra.com`, `https://app.arudra.com`) suggest an eventual HTTPS deployment target was anticipated, but no corresponding TLS termination/config exists in this repository (likely intended to be handled by a reverse proxy/load balancer outside the Spring app, which is a reasonable architecture — but nothing in this repo enforces or documents that requirement).
- **Assessment:** this is expected and low-priority for a localhost-focused dev setup (consistent with the instructions for this audit), but it is flagged as a hard blocker for any real deployment: TLS termination (via reverse proxy or `server.ssl.*`) and `useSSL=true` (or equivalent) for the DB connection must be in place before this app handles real customer/employee/payroll data outside a local machine.

---

## 10. Recommendations (prioritized)

1. **(Critical)** Add `@PreAuthorize` (or equivalent method security) to every controller method outside `CustomerController`, especially `HrController` (payroll/salary/performance data) and `BillingController`/`PurchaseController` (financial data). Decide on a role/permission matrix per module and enforce it consistently — the `Role`/`Permission` infrastructure already exists and works, it just isn't used.
2. **(Critical)** Replace `MeasurementController`'s `X-User-Name`/`X-User-Role` headers with `@AuthenticationPrincipal`/`SecurityContextHolder`-derived identity, matching the pattern already used correctly (if unused) in `LeadController`/`QuotationController` via `@AuthenticationPrincipal UserDetails`.
3. **(High)** Remove the hardcoded JWT-secret and DB-password defaults from `application.yml`/`.env.example`; generate a strong random secret per environment and fail application startup if `JWT_SECRET`/`DB_PASSWORD` are unset in non-dev profiles. Rotate the current default secret immediately since it is now documented in this file.
4. **(High)** Stop binding JPA entities directly from `@RequestBody`. Introduce request DTOs for every create/update endpoint (mirroring `CustomerController`'s pattern), explicitly mapping only the fields the client should be allowed to set, and never let a client-supplied `id` reach `repository.save()` on a create path.
5. **(Medium)** Fix `NotificationController`'s hardcoded `CURRENT_USER_ID`; derive the user from the authenticated principal.
6. **(Medium)** Remove all `@CrossOrigin(origins = "*")` annotations; rely solely on the environment-aware global CORS bean in `SecurityConfig`.
7. **(Medium)** Wire up `@Valid` on every `@RequestBody` DTO parameter and add Bean Validation annotations (`@NotBlank`, `@Size`, `@Email`, etc.) to the new request DTOs from item 4; add a `ConstraintViolationException` handler to `GlobalExceptionHandler` as a safety net for any validation that still happens at the entity/JPA layer.
8. **(Medium)** Add IP-based rate limiting (e.g. Bucket4j, or a reverse-proxy-level limiter) to `/api/auth/login` and `/api/auth/forgot-password`, independent of the existing per-account lockout.
9. **(Low)** Fix `AuthController.login`'s catch-all to return a generic error message instead of `ex.getMessage()`.
10. **(Low)** Rotate refresh tokens on use (issue a new refresh token on every `/api/auth/refresh` call and invalidate the old one) to limit the blast radius of a leaked refresh token.
11. **(Info, pre-deployment)** Before any non-local deployment: terminate TLS (reverse proxy or `server.ssl.*`), enable `useSSL=true` for the MySQL connection, set `CORS_ALLOWED_ORIGINS` to the real production origins only, and move the frontend `baseURL` to an environment-configurable value.
12. **(Info, hygiene)** Add a `.gitignore` covering `backend/.env` (and confirm secrets are excluded) before this project is ever initialized as a git repository.
