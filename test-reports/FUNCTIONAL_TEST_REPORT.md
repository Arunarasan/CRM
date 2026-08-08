# FUNCTIONAL TEST REPORT — Arudra CRM

**Date:** 2026-08-08 · **Method:** Source-level analysis of controllers/services/migrations + existing project docs. **UI-driven CRUD execution was not run** (no staging DB). Items below are either code-confirmed defects or test cases prepared for execution.

## Scope executed
- Verified module/endpoint inventory: **37 controllers, ~51 services, 179 entities, 180 repositories, 26 Flyway migrations**.
- Traced authorization, validation, error handling, and calculation code paths.
- Did **not** perform live Create/View/Edit/Delete/Search/Filter/Sort/Pagination/empty-state runs — these require a seeded staging instance (see "How to execute" below).

## Confirmed functional defects (from code)

| ID | Module | Defect | Severity |
|---|---|---|---|
| FUNC-001 | Auth | `forgot-password` is a mock — no email sent, reset link only printed to stdout. Password reset unusable. | High |
| FUNC-002 | Billing/Finance | Two parallel billing surfaces exist (`/api/billing` legacy, `/api/finance` current). `/api/billing` is unguarded and may produce inconsistent state vs `/api/finance`. Clarify which is canonical. | High |
| FUNC-003 | Finance | Invoice/payment/note numbers can duplicate under concurrency (no unique constraint). | High |
| FUNC-004 | Billing search | `InvoiceRepository`/`CustomerPaymentRepository` use `like %:search%` (non-standard JPQL) — invoice/payment search may throw at runtime. **Verify.** | Medium |
| FUNC-005 | Deployment | Sample "Acme Corp" data auto-seeds into empty DB (appears in prod). | Medium |

## Validation coverage (code-level)
- Bean Validation present on entities (`@NotBlank`, `@Email` on `User`; validation errors handled → 400 with field messages via `GlobalExceptionHandler`). ✓
- Negative/duplicate/missing-field paths largely rely on DB constraints + `DataIntegrityViolation` → 409. Reasonable, but the 409 message leaks DB detail (BLK-010).
- **Not verified live:** numeric/decimal boundaries, negative amounts (e.g. can a negative payment be posted?), future/past date rules, Unicode/Tamil text, very long strings, empty-state and pagination behavior. These are prepared as test cases below.

## Module inventory vs plan (all present in code)
Authentication ✓ · Dashboard ✓ · Customers ✓ · Leads ✓ · Site Visits ✓ · Measurements ✓ · BOQ ✓ · Quotations ✓ · Projects ✓ · Project BOQ ✓ · Floors/Rooms/Phases (via project hierarchy) ✓ · Tasks ✓ · Employees/Workforce ✓ · Contractors ✓ · HR ✓ · Attendance ✓ · Payroll ✓ · Inventory ✓ · Purchasing ✓ · Material Requests ✓ · Billing/Finance ✓ · Counter Sales (verify: no dedicated controller found — may live in Inventory/Finance) ⚠️ · Payments ✓ · Reports ✓ · Notifications ✓ · Settings (verify UI-only) ⚠️ · User management (minimal — `UserController` only lists users; no create/role-assign endpoint found) ⚠️

> **Gap:** User management is effectively read-only via API (`GET /api/users`). Creating users / assigning roles has no visible endpoint — confirm how non-seeded users are provisioned. This is both a functional gap and ties to BLK-001 (default admin).

## How to execute the full functional suite (not yet run)
1. Bring up a staging DB (see PERFORMANCE_TEST_REPORT for data-gen). Never point at prod.
2. Log in per role (seed one user per role) and run, for every module, the CVEDSFSPV matrix: Create / View / Edit / Delete / Search / Filter / Sort / Pagination / Validation / Duplicate / Empty / Error.
3. Capture status codes and DB side-effects for each. Record failures here with reproduction steps.
