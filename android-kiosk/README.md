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
| SecuGen Hamster Pro 20 / IV | `SecuGenAdapter` | Uses the vendor SDK (see below); needs a real-phone test |

Add a brand: write `XxxAdapter implements SensorAdapter`, list it in `SensorRegistry.create()`, and add
its USB vendor id to `res/xml/usb_device_filter.xml`.

Use ONE scanner model per site: fingerprints captured on different brands match poorly.
RD-Service-only (L1, Aadhaar) scanners such as Mantra MFS110 L1 cannot be used: they return only
encrypted data.

## SecuGen SDK (already wired in)

`SecuGenAdapter` uses SecuGen's "FDx SDK Pro for Android" (v4.22), following its demo app. The vendor
files are licensed, so they are NOT in git (see `.gitignore`); copy them in before building on a new machine:

1. `FDxSDKProFDAndroid.jar` and `AlCamera.jar` -> `app/libs/`
2. the `arm64-v8a` and `armeabi-v7a` folders of `.so` files -> `app/src/main/jniLibs/`

Both come from the zip SecuGen emails you (`FDx_SDK_Pro_FD_Android_Studio_v4.22.zip`).
The adapter returns the raw 8-bit image; the server makes the template. After first use on real
scans, check/tune the thresholds in `FingerprintPolicy`.

Fingerprint data is never stored on the phone; it goes straight to the page.
