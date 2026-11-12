# Attendance System — Design & Workflow Summary

Stack: Spring Boot (Java 17, Flyway/MySQL) backend, React + TypeScript (Vite) frontend, optional Android WebView kiosk shell.
Everything below was built incrementally; migration numbers (V27…V143) show the order.

## 1. Core idea

Attendance is **hours-based**. Every clock-in → clock-out pair is a *session*; sessions roll up into one per-day aggregate; payroll is computed from those hours. Verification (geo-fence, phone binding, biometric, kiosk face/finger) is **soft**: a failed check never blocks a punch, it marks the session `FLAGGED / approval_status = PENDING` for HR to approve or reject. Only an explicit HARD device-binding mode blocks.

## 2. Data model

| Table / entity | Purpose |
|---|---|
| `attendance` (`Attendance`) | One row per employee per day (aggregate). `checkInTime` = first session in, `checkOutTime` = last session out (null while any session is open), plus day totals: breakMinutes, workedHours, overtime, dayEarnings. |
| `attendance_sessions` (`AttendanceSession`, V27) | One row per clock-in→clock-out, with its own break tracking. Carries verification columns (V83/V84/V124/V142/V143): `verification_method`, `verified`, `flagged`, `flag_reason`, `distance_meters`, `accuracy_meters`, `office_location_id`, `approval_status/approved_by/approved_at`, `device_id/device_verified/device_mismatch_reason`, `kiosk_id`, selfie in/out, `face_distance`, liveness, `finger_score_in/out`, source (`PORTAL` / `KIOSK` / `KIOSK_MANUAL` / `MANUAL`), `overtime_alert_sent`. |
| `attendance_locations` (V83) | Office geofences: lat/lng + `radius_meters`, active flag. |
| `employees` columns | `attendance_method` (`GEO` \| `OFFICE_DEVICE` \| `ANY`), `attendance_method_requested`, `device_binding_mode` (`OFF/SOFT/HARD`, null = default), wage fields used by payroll. |
| `employee_webauthn_credential` (V83) | Device-biometric (passkey) credentials. |
| `user_devices`, `user_device_events` (V124) | Phone binding: one approved phone per user; audit log. |
| `attendance_correction_requests` (V86) | Time-correction requests (snapshot of original vs requested times). |
| `attendance_kiosks` (V140, V143) | Shared office kiosk phones; hashed pairing code + token; `verify_mode` FACE\|FINGER\|EITHER. |
| `employee_face_templates` (V141) | 5 face-api 128-number descriptors per employee. |
| `employee_fingerprints` (V143) | SourceAFIS templates (consent_at, engine_version). |

## 3. Punch paths (how an employee gets a session)

### A. Employee portal (own phone) — `ClockWidget.tsx` is the only clock-in UI
1. Browser captures best-effort GPS (`lib/geo.ts getBestPosition`, samples `watchPosition` to converge) + accuracy + userAgent.
2. If the employee's method is `OFFICE_DEVICE`/`ANY` and a passkey is registered → WebAuthn assertion (`lib/webauthn.ts`).
3. Last step: sign a server nonce with the device's non-extractable ECDSA P-256 key (`lib/deviceKey.ts`, IndexedDB) → proves "this is the bound phone".
4. `EmployeePortalController` → `DeviceBindingService.check(...)` (before the time service, non-transactional so the mismatch audit commits even on refusal) → `EmployeeTimeService.clockIn/clockOut/startBreak/endBreak`.
5. `AttendanceVerificationService` decides geo/biometric/device result and stamps the session (verified or flagged + reason, admins notified once).

Multiple sessions per day are allowed ("Clock In Again"). Breaks are per session.

### B. Office kiosk (one shared phone/PC, public API `/api/public/kiosk/*`, header `X-Kiosk-Token`)
- Pair: HR creates a kiosk → 8-char code (24 h, single use) → page at `/crm/kiosk` trades it for a token (only SHA-256 hashes stored; re-pair revokes the old phone).
- `POST /punch` — **face**: client does liveness (blink/head-turn, browser-side = deterrent only) and computes a face-api descriptor; **server** does 1:N match (`FaceMatcher`: ≤0.42 confident, ≤0.50 weak → flagged PENDING, ambiguity margin 0.04).
- `POST /punch-finger` — **fingerprint**: image from SecuGen WebAPI on a PC (`lib/secugenWebApi.ts`) or the Android bridge `window.AndroidFingerprint` (`android-kiosk/`, SecuGen adapter is still a stub). SourceAFIS 1:N identify; `FingerprintPolicy` (≥50 weak/flagged, ≥70 confident, margin 15 — starting values, calibrated lightly on real scans).
- `POST /punch-manual` — **fallback**: typed employee ID/phone + photo; auto-approved if the photo's face matches that employee, else PENDING.
- `EmployeeTimeService.kioskPunch` outcomes: `CHECKED_IN`, `CHECKED_OUT`, `ALREADY_IN`, `NOT_IN`, `TOO_SOON` (<2 min), `NOT_RECOGNISED`, `AMBIGUOUS`. A strong re-scan can lift a recent weak check-in/out. Selfie stored only when a punch is recorded (uploaded off the punch request; `KioskSelfieCleanup` purges old ones).
- OFFICE_DEVICE employees default to device-binding OFF (they use the shared kiosk).

### C. HR corrections (no punch needed)
- Employee requests a correction for a date (new in/out, or a fully missed day) with reason → HR approves → session times rewritten (missed day creates a `MANUAL` verified session) → `recomputeAggregate` → payroll auto-follows.
- HR can also apply directly: `POST /api/hr/attendance/corrections/apply` and `/apply-sessions` ("Fix a time").

## 4. Verification rules (`AttendanceVerificationService`)

- **Geo**: Haversine to nearest active fence. Inside if `distance − min(accuracy, 200–300m) ≤ radius`, plus a small grace (`app.attendance.geo-grace-meters`, `max-accuracy-margin-meters`). Rollout-safe: GEO method + no fences configured ⇒ verified `NONE`. Common false flags: office centre mis-placed (use the map picker `LocationMapPicker.tsx`) or GPS drift.
- **Biometric (WebAuthn, webauthn4j 0.25)**: needs HTTPS secure context and a real domain (not bare IP). rpId/origin derived from request `Origin`. Challenges are in-memory (single instance only).
- **Phone binding** (`DeviceBindingService`): default SOFT; first device auto-approved; max 1 device per user; attendance-only (not login). Outcomes `VERIFIED, NO_PROOF, NOT_BOUND, PENDING, REVOKED, BAD_CHALLENGE, BAD_SIGNATURE`. Shared phone → refused + admin notified. HARD failure → 403 `DEVICE_NOT_AUTHORIZED`; SOFT → flagged PENDING. HR can revoke/reset; reset soft-deletes rows so the next bind auto-approves.
- **Method per employee**: `GEO` | `OFFICE_DEVICE` | `ANY`. Employee may request biometric (`attendance_method_requested`), HR approves.

## 5. Hours, overtime, payroll (`EmployeeTimeService`)

- `computeBreakdown` sums payable minutes across **all** of a day's sessions (minus breaks), then overtime applies on the **daily total** beyond `standardDailyHours` (default 8). `syncAggregate` writes the day totals onto `attendance`.
- **Missed check-out rule**: an open session on a past day is *not paid*. Hourly scheduler `AttendanceOvertimeScheduler.flagMissedCheckouts` (cron `0 15 * * * *`, last 31 days) flags it PENDING ("No check-out") and notifies admins once. HR setting a check-out auto-approves it; HR cannot approve an open past session.
- `alertLongOpenSessions` (every 30 min) alerts admins once when a session runs very long (`overtime_alert_sent`).
- **Payroll** (`PayrollService.calculate`) always derives from `hourlySummary` attendance hours; HR picks HOURLY vs MONTHLY at generate time (MONTHLY = base_salary ÷ (standardDailyHours × workingDays) × regular hrs, capped at base_salary, plus OT). Rejected/pending-unresolved sessions don't count. Counted rewards (QR reviews, qualified leads) and manual line items are added to payslips.

## 6. HR / admin surface

Backend `AttendanceAdminController` (`/api/hr/attendance`, HR_READ/HR_WRITE): `locations`, `pending` (+`/count`, `/kiosk-log`), `sessions/{id}/approve|reject`, `sessions/approve-many`, `method-requests`, `corrections…`, `devices…`; `KioskAdminController` for kiosks/enrolment.
Frontend: `HrAttendancePage` (To-approve, Office Locations, requests, phone changes), `AttendanceRegister` (day register), `kioskAdmin`/`kioskLog` (pairing, face/finger enrolment, selfies + scores), `deviceAdmin` (phone rules), employee portal `Attendance.tsx` (timesheet, corrections) and Settings (biometric + registered phone).

## 7. Key design decisions / gotchas

- Soft enforcement everywhere; HR approval queue is the safety net.
- Phone fingerprints/passkeys can't tell *which person* → shared-machine identification uses face or an external USB sensor (earlier ZKTeco machine design was removed in V139).
- Browser camera needs HTTPS/localhost; liveness is client-side only.
- iOS Safari evicts IndexedDB after ~7 days unless installed as PWA (affects device key).
- In-memory WebAuthn/device nonces ⇒ single backend instance assumed.
- Fingerprint accuracy not validated at scale; Android SecuGen adapter pending vendor SDK; Mantra MFS110 L1 unusable (encrypted RD).
- Tests: `AttendancePayableTest`, `AttendanceBonusHoursTest`, `DeviceBindingCheckTest`, `DeviceBindingCryptoTest`.
