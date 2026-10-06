# Biometric Attendance Devices (HR → Attendance)

Office attendance on a dedicated, admin-approved Android terminal with an external USB fingerprint
scanner. Employees do not use personal phones. The terminal identifies the employee locally (vendor SDK)
and sends only the employee id; ArudraCS decides check-in / check-out and computes the shift figures.

This module extends the existing HR attendance — it is not a parallel system:

| Existing piece | How it is reused |
|---|---|
| `attendance` (day aggregate) + `attendance_sessions` | Device punches create the same rows, so payroll (`EmployeeTimeService`), timesheets, corrections and the flagged-review queue keep working |
| `attendance_locations` (geofences) | A device is installed at one of them; they now also belong to a branch |
| `Employee`, `Department`, users/JWT, `@PreAuthorize` (`WORKFORCE_READ/WRITE`) | Same entities and permissions |
| `activity_logs` (`ActivityLogService`), `NotificationService.dispatchToAdmins` | Audit trail and admin alerts |
| HR UI kit (`pages/workforce/hrUi.tsx`), Workforce layout | New pages sit in HR & Payroll → Time |

New: `branches` (none existed), shifts, devices, punches, biometric references.

```
Android terminal + USB scanner (vendor SDK, matching on device)
        │  HTTPS, Authorization: Device <15-min token>
        ▼
/api/device/**  ──►  DeviceAuthenticationFilter (status / credential version / branch+location, every call)
        │
        ▼
DeviceAttendanceService ── idempotency ── employee row lock ── shift rules ──► attendance + sessions
        │                                                                      ▲
        └── attendance_punches (raw log)        HR UI /api/hr/** (JWT) ────────┘
```

## Screens

| Where | What |
|---|---|
| HR & Payroll → Time → **Dashboard** (`/workforce/attendance-dashboard`) | Present / Absent / Late / On leave / Half day tiles (click to filter); day sheet with check-in/out, hours, late/early/OT, source device; filters: date, employee search, department, branch, shift, device; CSV export; auto-refresh |
| Time → **Devices** (`/workforce/attendance-devices`) | Approval queue; name, Device ID, UUID, branch, location, status (Online/Offline derived from heartbeat), last seen, app version, scanner, registered, approved by, last sync, pending sync; Register (pairing code), Approve, Reject, Block/Unblock, Revoke, Rename/Assign, Activity, Delete; Branch management |
| Time → **Shifts** (`/workforce/attendance-shifts`) | Shift CRUD (start/end, grace, break, half-day threshold, weekly off, overtime on/off, default) and bulk shift/branch assignment |
| Time → **Review & locations** | Existing: flagged clock-ins (now also unverified offline device punches), corrections, geofences (+ branch) |
| Employee → **Attendance** | Month summary (working days, present, absent, leave, half day, late, overtime) + calendar |
| Employee → **Biometric** | Start enrollment on a chosen device and follow it live; enrolled fingers; remove one/all; branch & shift |

## Device lifecycle

`PENDING → ACTIVE ⇄ BLOCKED`, `PENDING → REJECTED`, any → `REVOKED`. `OFFLINE` is **derived** (ACTIVE and no
heartbeat for `offline-after-seconds`) rather than stored, so a terminal that lost connectivity can still
sync its queue when it returns. Only ACTIVE devices with a branch and location can call device APIs.

Registration:
1. *Request → approve*: terminal `POST /api/device/register` (branch, location, hardware info) → PENDING +
   one-time poll token → admins notified ("New Attendance Device …") → admin approves → terminal polls
   `/register/status`, receives a random 256-bit **device secret** once (stored server-side only as SHA-256).
2. *Admin pairing*: admin "Register device" creates a pre-approved slot and a one-time code (24 h, rate
   limited); the terminal registers with the code and is ACTIVE immediately.

The secret is exchanged at `/api/device/auth/token` for an HS256 token (15 min, key domain-separated from
user JWTs, claims: device id, uuid, credential version). Revoke bumps the credential version, clears the
secret and revokes the biometric references held on that device; Block flips status — both stop the
device on its next request.

## Punch rules (server-side)

1. `(device_id, idempotency_key)` is unique; a replay returns the stored outcome (`duplicate: true`).
2. Time: online punches use **server time**. Offline punches carry the terminal's server-anchored
   monotonic time (`timeSource=SERVER_ANCHORED`); `DEVICE_CLOCK` punches are accepted but flagged for HR;
   punches > 2 min in the future or older than `max-offline-hours` are rejected. Sync batches are applied
   oldest-first, each in its own transaction.
3. Employee must exist, not be terminated, have an ACTIVE biometric enrollment, and (when
   `enforce-branch`) belong to the device's branch.
4. State per attendance day (employee row locked, so racing punches serialise):
   no attendance → **CHECK_IN**; checked in → **CHECK_OUT**, or **ALREADY_CHECKED_IN** within
   `min-checkout-gap-minutes`; checked out → **ALREADY_CHECKED_OUT**. Overnight shifts close the previous
   day's open check-in.
5. Figures (`AttendanceShiftCalculator`): late = check-in − (start + grace) (09:23 vs 09:00+15 ⇒ 8 min);
   early = end − check-out; working = gross check-in→check-out; the shift break is unpaid on a full day;
   overtime = (working − break) − shift net hours, when enabled; status = HALF_DAY under the half-day
   threshold, else LATE when late, else PRESENT. `check_in_method/check_out_method = BIOMETRIC_DEVICE`,
   `biometric_verified = true`. Payroll's worked hours are recomputed from the sessions.

Days without a row are shown (not stored) as WEEK_OFF (shift weekly off), NOT_MARKED (before shift
start + grace today, or future) or ABSENT. Approved leave already writes LEAVE rows.

## Biometric privacy

* Raw fingerprint images are never read, stored or sent. Templates stay on the terminal — SQLCipher
  database + per-row AES-GCM under a non-exportable Android Keystore key — and matching runs there.
* The server stores only `employee_biometrics`: employee, device, provider id, opaque `template_ref`,
  finger, quality, who/when. Removing an enrollment changes the device's enrollment revision; the
  terminal deletes the template on its next heartbeat.
* Enrollment is always HR-initiated (`biometric_enrollment_sessions`, 10-minute expiry) and can only be
  completed by the device it was addressed to. The terminal refuses a finger already enrolled for
  another employee and refuses ambiguous 1:N matches.
* Trade-off: because templates are not centralised, an employee must be enrolled on each terminal they
  use, and a replaced terminal needs re-enrollment.

## APIs

Terminal (`Authorization: Device <token>` unless marked open):

| Method | Path | |
|---|---|---|
| GET | `/api/device/register/options` | open — branches + locations for the registration screen |
| POST | `/api/device/register` | open — request registration, or pair with `pairingCode` |
| POST | `/api/device/register/status` | open — poll with registration id + poll token; returns the secret once approved |
| POST | `/api/device/auth/token` | open — device secret → short-lived token (+ server time) |
| POST | `/api/device/heartbeat` | health in; server time, config, pending enrollment, enrollment revision out |
| GET | `/api/device/employees`, `/api/device/employees/lookup?code=` | roster / ID lookup (name + enrolled only) |
| POST | `/api/device/attendance/punch` · `/check-in` · `/check-out` | one punch (AUTO / forced action) |
| POST | `/api/device/attendance/sync` | offline batch (≤ 200), per-record results; `RETRY` = keep |
| GET | `/api/device/attendance/today?employeeId=` | today's state for one employee |
| GET | `/api/device/biometric/enrollments` | authoritative template references for this device |
| GET | `/api/device/biometric/sessions/pending` | next enrollment for this device |
| POST | `/api/device/biometric/sessions/{id}/start` · `/complete` · `/fail` | enrollment progress; `complete` carries only `templateRef` |

Admin (user JWT; read = `ROLE_ADMIN|WORKFORCE_READ`, write = `ROLE_ADMIN|WORKFORCE_WRITE`):

| Method | Path |
|---|---|
| GET / POST | `/api/hr/attendance-devices` (list / admin register → pairing code) |
| GET / PUT / DELETE | `/api/hr/attendance-devices/{id}` |
| POST | `/api/hr/attendance-devices/{id}/approve` · `reject` · `block` · `unblock` · `revoke` · `pairing-code` |
| GET | `/api/hr/attendance-devices/{id}/activity` |
| GET | `/api/hr/biometric/{employeeId}/status` |
| POST | `/api/hr/biometric/enroll`, `/api/hr/biometric/sessions/{id}/cancel` |
| GET | `/api/hr/biometric/sessions/{id}` |
| DELETE | `/api/hr/biometric/{employeeId}`, `/api/hr/biometric/enrollments/{biometricId}` |
| GET | `/api/hr/attendance/dashboard`, `/today`, `/history`, `/report` |
| GET / POST / DELETE | `/api/hr/attendance/shifts[/{id}]` |
| PUT | `/api/hr/attendance/assignments` |
| GET / POST / DELETE | `/api/hr/branches[/{id}]` |

Device errors use `ApiError.error` codes the terminal acts on: `DEVICE_BLOCKED`, `DEVICE_REVOKED`,
`DEVICE_PENDING`, `CREDENTIAL_REVOKED`, `INVALID_CREDENTIAL`, `TOKEN_INVALID`, `DEVICE_UNASSIGNED`,
`PAIRING_INVALID`, `RATE_LIMITED`.

## Data model (V122)

`attendance` gains `attendance_type`, `device_id`, `branch_id`, `location_id`, `shift_id`,
`biometric_verified`, `check_in_method`, `check_out_method`, `working_minutes`, `overtime_minutes`,
`late_minutes`, `early_departure_minutes` (the day column remains `date`; `status` now also carries LATE,
HOLIDAY, WEEK_OFF, ON_DUTY, WORK_FROM_HOME). New tables: `branches`, `attendance_shifts` (seeded with
"General Shift 09:00–18:00, grace 15, break 60, Sunday off"), `attendance_devices`,
`attendance_device_events`, `attendance_punches`, `employee_biometrics`, `biometric_enrollment_sessions`;
`employees.branch_id`, `employees.attendance_shift_id`, `attendance_locations.branch_id`.

## Configuration (`app.attendance.device.*`)

| Key (env) | Default | |
|---|---|---|
| `token-secret` (`ATTENDANCE_DEVICE_TOKEN_SECRET`) | derived from `jwt.secret` | device token signing |
| `token-ttl-seconds` | 900 | device token lifetime |
| `heartbeat-interval-seconds` | 60 | sent to terminals (they clamp to 30–300) |
| `offline-after-seconds` | 300 | shown OFFLINE + one admin alert |
| `min-checkout-gap-minutes` | 15 | second scan within this ⇒ "Already checked in" |
| `max-offline-hours` | 72 | older offline punches rejected |
| `enforce-branch` | true | employee must belong to the device's branch |
| `code-prefix` | ARUDRA-ATT | device id prefix |
| `pairing-ttl-hours` / `enrollment-ttl-minutes` | 24 / 10 | |

## Audit

`activity_logs` (module `ATTENDANCE_DEVICE` / `BIOMETRIC`): registration requests, pairing, approve, reject,
block, unblock, revoke, update, delete, shift and branch changes, assignments, enrollment start / complete
/ fail / cancel, biometric removal. `attendance_device_events` (per device, shown in *View activity*):
the above plus credential issue/activation, auth failures, heartbeat transitions (online/offline, scanner),
every check-in/out and every rejected punch with its reason.

## Not included / follow-ups

* Holiday calendar (HOLIDAY rows can still be written manually) and persisting ABSENT rows nightly.
* Centralised template distribution across several terminals (deliberately not done — see privacy).
* The Android `app` module has not been compiled in CI here (no Android SDK in this environment);
  `core` is built and unit-tested. See `android-attendance/README.md`.
