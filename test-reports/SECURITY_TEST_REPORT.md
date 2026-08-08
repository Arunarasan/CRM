# SECURITY TEST REPORT — Arudra CRM

**Date:** 2026-08-08 · **Method:** Defensive static analysis (source, config, migrations). No live exploitation. Categories 9 & 10 of the master plan.

## Summary by severity

| Severity | Count | IDs |
|---|---|---|
| 🔴 Critical | 3 | BLK-001, BLK-002, BLK-003 |
| 🟠 High | 3 | BLK-004, BLK-005, BLK-006 |
| 🟠 Medium | 5 | BLK-007, BLK-008, BLK-009, BLK-012, PERF/CORS |
| 🟡 Low | 4 | BLK-010, BLK-011, BLK-013, SEC-011 |
| ℹ️ Informational | — | see positives |

Full reproduction detail for each ID is in **PRODUCTION_BLOCKERS.md**. This report covers the security *checklist* coverage.

## Checklist results

| # | Check | Result | Notes |
|---|---|---|---|
| Authentication | JWT login, lockout, refresh | 🟡 Partial | BCrypt, lockout (5→24h auto-unlock), refresh tokens, email-enum prevented. But default admin (BLK-001), no rate limit (BLK-009), reset mocked (BLK-005). |
| Authorization / RBAC | `@PreAuthorize` per endpoint | 🔴 Fail | Systemic gaps: BLK-002/003/004. Good permission model exists but not applied uniformly. |
| IDOR | ID-swap on `/api/{resource}/{id}` | 🔴 Fail (likely) | Object-level ownership checks not evident on most `getById`/`update`/`delete`; only self-scoped portals (`EmployeePortalController`, `ContractorPortalController`) are safe by design. **Needs live confirmation** per resource, but absence of ownership checks + blanket `authenticated()` = high IDOR risk on Projects/Customers/Leads/Tasks/Payroll/Payments/Documents. |
| SQL Injection | native/JPQL queries | 🟢 Pass | All `@Query` use named params / `CONCAT`; Specifications use CriteriaBuilder. No string-built SQL found. |
| XSS (stored) | file upload content types | 🟠 Medium | SVG/HTML uploadable, served same-origin (BLK-008). Frontend is React (auto-escapes) — verify no `dangerouslySetInnerHTML`. |
| CSRF | state-changing requests | 🟢 N/A | Stateless bearer-token API; CSRF disabled appropriately (no cookie auth). |
| JWT security | signing, expiry, algo | 🟡 Partial | HS256, 15-min access token, 256-bit key on Render. Committed default key is a trap off-Render (BLK-011). No token revocation (refresh tokens are DB-revocable). |
| Session security | statelessness | 🟢 Pass | `SessionCreationPolicy.STATELESS`. |
| Password security | hashing, policy | 🟡 Partial | BCrypt ✓, `WRITE_ONLY` ✓. No password-complexity policy enforced server-side (verify). |
| API security | authz coverage | 🔴 Fail | See RBAC. |
| CORS | allowed origins | 🟠 Medium | Wildcard `@CrossOrigin` overrides allowlist (BLK-007). |
| Security headers | HSTS/XCTO/XFO/CSP | 🟡 Low | None configured (SEC-011). |
| Rate limiting | login/API | 🟠 Medium | None (BLK-009). |
| File upload security | type/size/path | 🟡 Partial | Size+type allowlist ✓, path traversal mitigated ✓; SVG + public serving = issue (BLK-008). |
| Path traversal | stored filename | 🟢 Pass | UUID + `cleanPath` + sanitized name + normalized path. |
| Sensitive data exposure | responses/logs/errors | 🟠 Medium | User directory over-exposed (BLK-004); DB cause leaked (BLK-010); reset token logged (BLK-005). Password hash NOT exposed ✓. |
| Secrets in source | keys/creds | 🟠 Medium | Default JWT/DB creds committed (BLK-011); default admin password (BLK-001). |
| Secrets reaching browser | frontend bundle | ℹ️ Verify | Frontend uses `VITE_API_BASE_URL`; grep the built bundle for tokens/keys before release (not executed here). |

## IDOR test matrix (to execute on staging)
For each: authenticate as a low-privilege user, then request another tenant's/user's id.

| Endpoint pattern | Expected | Priority |
|---|---|---|
| `GET/PUT/DELETE /api/projects/{id}` | 403 unless owner/authorized | High |
| `GET /api/customers/{id}` | 403/scoped | High |
| `GET /api/leads/{id}` | 403/scoped | High |
| `GET /api/tasks/{id}` | 403/scoped | High |
| `GET /api/hr/**` (payroll/{employeeId}) | 403 unless HR/self | Critical |
| `GET /api/billing/invoices/{id}` | 403 unless finance | Critical |
| `GET /uploads/{path}` | 401/403 unless authorized | High |

## Positives (do not regress)
- BCrypt password hashing; password field `WRITE_ONLY`; lockout fields `@JsonIgnore`.
- Account lockout with time-based auto-unlock; login-history + failed-attempt tracking.
- Email enumeration prevented on `forgot-password`.
- Parameterized queries throughout — no SQL injection surface found.
- Central `GlobalExceptionHandler` returns generic 500 (no stack traces) and correct status codes.
- Stateless JWT + `@Version` optimistic locking on all entities.
- Render deployment injects a generated JWT secret and non-defaulted DB credentials.
- Well-structured permission model (90+ granular permissions mapped to 14 roles) — the foundation is there; it is simply not enforced on every endpoint.
