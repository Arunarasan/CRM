# Arudra Kiosk (Android)

Full-screen WebView that opens the CRM kiosk page (`/crm/kiosk`) and provides the USB fingerprint
scanner to it as `window.AndroidFingerprint`. Contract: `../docs/FINGERPRINT_KIOSK_APP.md`.

## Build

```
cd android-kiosk
./gradlew assembleDebug            # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleDebug -PkioskUrl=https://other-host/crm/kiosk   # different page
```

Needs JDK 17 and the Android SDK (`local.properties` with `sdk.dir=C:/.../Android/Sdk`, not committed).

## Install on the kiosk phone

Copy the APK to the phone and open it (allow "install unknown apps"), or `adb install -r app-debug.apk`.
Plug the scanner in with a USB-OTG cable and allow USB access when Android asks.

## Scanner support = adapters

`sensor/SensorAdapter` is the only thing that knows a brand. Each adapter returns the same capture
(RAW / PNG / JPEG / ISO) and the CRM page does not care which scanner it came from.

| Brand | Adapter | State |
|---|---|---|
| SecuGen Hamster Pro 20 / IV | `SecuGenAdapter` | **Needs the vendor SDK** (see below) |

Add a brand: write `XxxAdapter implements SensorAdapter`, list it in `SensorRegistry.create()`, and add
its USB vendor id to `res/xml/usb_device_filter.xml`.

Use ONE scanner model per site: fingerprints captured on different brands match poorly.
RD-Service-only (L1, Aadhaar) scanners such as Mantra MFS110 L1 cannot be used: they return only
encrypted data.

## Finishing the SecuGen adapter

1. Request the free "FDx SDK Pro for Android" from SecuGen; ask whether it returns the raw image or only a template.
2. Put its `.jar` in `app/libs/` and its `.so` folders in `app/src/main/jniLibs/`.
3. Fill in `open / capture / close` in `SecuGenAdapter` (steps are in its header comment).
4. Enrol 3-4 staff, then tune the thresholds in `FingerprintPolicy` from real scores.

Fingerprint data is never stored on the phone; it goes straight to the page.
