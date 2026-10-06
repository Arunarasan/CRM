# ArudraCS Attendance — Android terminal

The kiosk app for the office attendance terminal: one dedicated Android device with an **external USB
fingerprint scanner**, registered and approved in ArudraCS (HR → Attendance → Devices). Employees never
use their own phones; matching happens on this device and only an employee id reaches the server.

```
android-attendance/
├── core/   pure Kotlin (JVM) — BiometricProvider, ExternalScannerProvider, ScannerDriver seam,
│           TrustedClock, offline queue + OfflineSyncer, PunchService, BiometricSync. Unit tested.
└── app/    Android — Compose kiosk UI, vendor driver per product flavour, SQLCipher + Keystore
            storage, Retrofit device API, device-owner lockdown, WorkManager sync.
```

## Scanner SDK requirements (read before buying hardware)

The phone's built-in fingerprint sensor **cannot** identify multiple people (Android only says
"the device owner's finger matched"). The terminal needs a USB/OTG scanner whose vendor ships an
**Android SDK that returns minutiae templates and can match two templates** (1:1, which the app loops
for 1:N).

| Need | Why |
|---|---|
| USB host (OTG) on the Android device, Android 9+ (`minSdk 28`) | scanner power/data; device-owner lock-task APIs |
| Vendor **non-RD** Android SDK (template extraction + match) | UIDAI *RD Service* only emits encrypted Aadhaar PID blocks; it cannot be used for local identification |
| ISO/IEC 19794-2 (or ANSI 378) templates | stable, vendor-neutral template format |
| Native libs for the device ABI (`arm64-v8a` at least) | SDKs are JNI |

### Implemented: Mantra MFS100 (flavour `mantra`)

Driver: `app/src/mantra/java/.../scanner/MantraMfs100Driver.kt`. The SDK is licensed by Mantra Softech
and is **not committed**. Obtain the "MFS100 Android SDK" from Mantra and place:

```
app/libs/mantra/mantra.mfs100.jar
app/src/mantra/jniLibs/<abi>/libMFS100V9032.so   (+ libc++_shared.so from the SDK)
```

API used (signatures checked against `mantra.mfs100.jar`): `MFS100(MFS100Event)`,
`SetApplicationContext`, `LoadFirmware`, `Init`, `UnInit`, `IsConnected`, `GetDeviceInfo`,
`AutoCapture(FingerData, timeoutMs, detectFinger)`, `FingerData.ISOTemplate()/Quality()`,
`MatchISO(probe, gallery)` (score; default accept ≥ 96, Mantra's reference operating point),
`StopAutoCapture`. USB ids: `04B4:8613` (firmware load) → `2C0F:1005` (ready) — see
`res/xml/usb_device_filter.xml`. Only `ISOTemplate()` is read; `FingerImage()`/`RawData()` are never used.

### Adding another vendor (SecuGen, Startek, …)

1. Add a product flavour in `app/build.gradle.kts` and put the SDK under `app/libs/<vendor>/`.
2. Implement `ScannerDriver` (`open/close/status/info/capture/match/cancel`) in `app/src/<vendor>/java/.../scanner/`.
3. Provide `ScannerDriverFactory` in the same source set.

Nothing else changes: `ExternalScannerProvider` (enrolment quality/consistency/duplicate checks,
1:N with ambiguity rejection, 1:1 verify), the kiosk, sync and the server are vendor-neutral.

### Flavour `simulated`

A software scanner with "Finger 1–5" buttons for testing flows on any phone/emulator. Debug only —
the build fails if anyone tries to assemble a `simulatedRelease`.

## Build

```bash
# keystore.properties (repo root of android-attendance, not committed) or environment variables:
ATTENDANCE_API_BASE_URL=https://crm.example.com/api/
ATTENDANCE_CERT_PINS=sha256/AAAA...=,sha256/BBBB...=     # optional OkHttp pins for the API host
ATTENDANCE_KEYSTORE=/path/release.jks
ATTENDANCE_KEYSTORE_PASSWORD=... ATTENDANCE_KEY_ALIAS=... ATTENDANCE_KEY_PASSWORD=...

./gradlew :core:test                    # JVM unit tests
./gradlew :app:assembleMantraRelease    # production APK (needs the Mantra SDK files above)
./gradlew :app:assembleSimulatedDebug   # hardware-free test build
```

The base URL must be `https://`; cleartext traffic and user-installed CAs are disabled
(`res/xml/network_security_config.xml`).

## Provisioning a terminal (IT, once)

1. Factory-reset the device; skip adding a Google account.
2. Install the APK and make it **device owner**:
   `adb shell dpm set-device-owner com.arudracs.attendance/.kiosk.KioskAdminReceiver`
   (or QR / zero-touch provisioning with the same component).
3. Connect Wi-Fi, plug in the scanner, open the app (it is now the home screen).
4. Either
   * **Request approval** — pick Branch + Attendance Location → *Request registration*; an admin approves
     it in HR → Attendance → Devices; or
   * **Pairing code** — in ArudraCS click *Register device*, then enter the one-time code on the terminal
     (*I have a pairing code*) — active immediately.

Once device owner, the app applies (`kiosk/KioskPolicy.kt`): lock-task (no home/recents/notifications/
status bar), persistent HOME, forced network time + `DISALLOW_CONFIG_DATE_TIME`, uninstall blocked, no
factory reset / safe boot / new users / USB file transfer / ADB / app installs / external media, screen
on while powered, OS updates only 02:00–04:00. Back is disabled and screenshots are blocked.

**Admin access on the terminal:** long-press the *ARUDRACS* wordmark → sign in with an ArudraCS account
that has `ROLE_ADMIN` or `WORKFORCE_WRITE` (checked online; the CRM session token is discarded). The panel
shows device health and offers *Sync now*, *Reconnect* and a 5-minute **maintenance mode** (lifts the
install/ADB restrictions and lock-task for app updates, then re-locks).

## How it works

* **Credentials** — install UUID, one-time poll token and the device secret live in
  `EncryptedSharedPreferences` (Android Keystore). The secret is exchanged for a 15-minute device token;
  the server re-checks device status on every call, so *Block* / *Revoke* take effect immediately.
* **Templates** — stored in a SQLCipher database (random 256-bit key) and additionally sealed per row
  with AES-256-GCM under a non-exportable (StrongBox where available) Keystore key. The server only ever
  gets the opaque `templateRef`. HR deleting an enrolment changes the server's enrolment revision; the
  next heartbeat reconciles and wipes the template here. Revoking the device wipes all local templates.
* **Enrolment** — HR starts it from Employee → Biometric; it arrives with the next heartbeat; the employee
  scans 3 times (quality ≥ 50, all three must match, finger must not already belong to someone else).
* **Punch** — the home screen is always listening: finger → 1:N match → `POST /attendance/punch`; the
  server decides check-in / check-out / already-checked-in / completed. *Enter Employee ID* does a 1:1
  verify instead.
* **Offline** — punches are queued with their idempotency key and a **server-anchored monotonic
  timestamp** (`TrustedClock`: server time + `elapsedRealtime` delta — immune to wall-clock changes).
  After a reboot while offline the anchor is void; such punches are sent as `DEVICE_CLOCK` and the server
  accepts them but flags them for HR review. Sync runs after every heartbeat, on network return
  (WorkManager) and every 15 min; replays are harmless.
* **Heartbeat** — every `heartbeat-interval-seconds` (server config, clamped to 30–300 s) with app version,
  scanner status and queue size; the response carries server time, config and any pending enrolment.
