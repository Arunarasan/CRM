# E2E / BUSINESS WORKFLOW TEST REPORT — Arudra CRM

**Date:** 2026-08-08 · **Method:** Code-path tracing of inter-module data flow. **Live end-to-end runs not executed** (no staging). Where the codebase and prior module notes evidence a working guard/handoff, it is marked *Evidenced*; runtime confirmation is still required.

## Main flow: handoff analysis
Lead → Customer → Requirement → Site Visit → Measurement → BOQ → Quotation → Approval → Project → Project BOQ → Tasks → Assignment → Execution → Material Request → Inventory → Billing → Payment → Completion → Reports

| Handoff | Code evidence | Status |
|---|---|---|
| Measurement → BOQ | Guard enforced (measurement approved before BOQ) per module design; generate-from-BOQ present. | 🟢 Evidenced |
| BOQ → Quotation | Structure-from-BOQ + Sync; pricing-lock preserved; quotation hierarchy Floor→Room→Category→Item. | 🟢 Evidenced |
| Quotation → Project | Approval guard before project creation. | 🟢 Evidenced |
| Project → Tasks | Task auto-seed + checklist auto-seed on BOQ generation. | 🟢 Evidenced |
| Project → Material Request → Inventory | Material transactions reuse inventory engine (project-scoped stock in/out). | 🟢 Evidenced |
| Project → Billing | Finance module + immutable ledger, expense sync. | 🟢 Evidenced |
| Employee/Attendance → Payroll | V19 payroll; idempotent `runPayroll`; attendance/time feeds earnings. | 🟢 Evidenced |
| Contractor → Payment | Bill approval ladder + ledger. | 🟢 Evidenced |

> These handoffs are architecturally present and were built module-by-module (see project memory). **They must still be exercised live** to confirm data actually propagates and totals reconcile.

## Modification-after-stage scenarios (prepared — must run on staging)
The plan's hardest cases are mutation-after-downstream-commit. Prepare and record each:

1. Change measurement after BOQ created → does BOQ flag stale / re-sync / block?
2. Change BOQ after quotation → is quotation re-derivable, or locked?
3. Change quotation after project created → is project BOQ affected? (pricing-lock expected)
4. Reduce project budget after work begins → are committed costs/PO/bills respected?
5. Add additional work after project starts → change-request path (`ProjectChangeRequestController`).
6. Remove an unfinished BOQ item → orphan check on quotation/project items.

## Data-consistency risks to watch (from static review)
- **Invoice numbering** duplicates under concurrency (BLK-006) — breaks billing E2E integrity.
- **Dual billing surfaces** (`/api/billing` vs `/api/finance`, FUNC-002) — risk of divergent ledgers.
- **Optimistic locking (`@Version`)** protects single-row lost updates, but concurrent stock-issue against the same item may surface as an unhandled `OptimisticLockException` (500) rather than a clean 409 — verify stock decrement path handles retries.
- **Progress rollup** (Item→Room→Phase→Project) recalculation must be re-validated after mid-project edits.

## Verdict for E2E
Cannot certify end-to-end correctness without live execution. Architecture and guards are present and credible, but the **billing/finance leg has confirmed integrity defects (BLK-002, BLK-006)** that fail the E2E financial path today.
