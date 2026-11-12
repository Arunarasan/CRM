# Security Findings (static review, 2026-11-12)

Method: source review only. No live exploitation. NEEDS-LIVE-CONFIRM items are unverified at runtime.

## Earlier blockers (test-reports/PRODUCTION_BLOCKERS.md, 2026-08-08): current status

| Old ID | Issue | Current status (evidence) |
|---|---|---|
| BLK-001 | Default admin Admin@123 in prod | FIXED. Seeding guarded to non-prod (DataSeeder.java:262-295); DefaultPasswordSweeper present |
| BLK-002 | BillingController unauthenticated | FIXED. FinanceController 71/71 endpoints annotated |
| BLK-003 | Project CRUD unauthorized | FIXED. ProjectController 99/99 annotated |
| BLK-004 | Partial authz (HR, Users, Tasks) | Largely FIXED. HrController 108/109, UserController class-level ADMIN, TaskController 20/20, notifications scoped to current user |
| BLK-005 | Password reset mocked | Per project notes: real SMTP + OTP. Not re-verified at runtime |
| BLK-006 | Duplicate doc numbers | MITIGATED. DocumentNumberService + UNIQUE constraints in V1 |
| BLK-007 | Wildcard CORS | FIXED. No @CrossOrigin in controllers |
| BLK-008 | Public uploads / SVG | PARTIAL. SVG/HTML/XML rejected; /uploads/** still permitAll (AUD-004) |
| BLK-009 | No rate limiting | PARTIAL. RateLimitFilter exists (in-memory, per-IP); effectiveness NOT TESTED |
| BLK-010 | Constraint message leak | FIXED (GlobalExceptionHandler.java:160) |
| BLK-011 | Weak default secrets | FIXED for prod profile; dev defaults remain in application.yml |

## Open findings
- AUD-003 (Medium): endpoints with only authenticated() and no record-level scoping. IDOR risk, needs live confirm.
- AUD-004 (Medium): public /uploads/** and permitAll backup download route (ticket-protected).
- AUD-008 (Low): security headers beyond X-Frame-Options not visible in app config.
- AUD-007 (Low): System.out.println usage.
- CSRF disabled: acceptable for a bearer-token API. Tokens in localStorage mean XSS leads to token theft (accepted risk).
- Kiosk /api/public/kiosk/** relies on pairing code and X-Kiosk-Token; brute-force resistance depends on RateLimitFilter (NOT TESTED).

## Not assessed
Dependency CVE scan (recommend OWASP dependency-check and npm audit), JWT forgery and refresh rotation at runtime, brute force, IDOR with real tokens.
