# Fingerprint kiosk app (Android): what it must do

The CRM already supports fingerprint check-in on the kiosk (server matching, HR enrolment, kiosk
screens). The one missing piece is a small **Android app** on the kiosk phone, because a web page
cannot talk to a USB fingerprint sensor. This document is the contract between that app and the CRM
pages. Build it after the sensor passes the Phase 0 tests (`FINGERPRINT_SENSOR_PHASE0.md`).

## What the app is

A thin shell: an Android app with one full-screen **WebView** that opens
`https://jbdecorcdm.com/crm/kiosk`, plus code that talks to the sensor through the sensor maker's
Android SDK. HR also opens the normal CRM inside the same WebView to enrol fingers (the Enrol button
works only where this app provides the sensor).

## Things the app must do

1. **USB OTG:** detect the sensor when plugged in, ask Android for USB permission, and remember it.
2. **WebView:** enable JavaScript and DOM storage (the kiosk keeps its pairing token in localStorage),
   allow camera access for the page (the kiosk takes an evidence selfie), keep the screen on, and
   stay in the foreground (kiosk or lock-task mode if wanted).
3. **JavaScript bridge** exposed as `window.AndroidFingerprint` (see below).
4. Never store fingerprint data on the phone. Pass it straight to the page and forget it.

## The bridge (matches `frontend/src/lib/fingerprintBridge.ts`)

Methods the app adds to the page (`addJavascriptInterface(..., "AndroidFingerprint")`):

| Method | Meaning |
|---|---|
| `isReady(): boolean` | Sensor plugged in and USB permission granted |
| `capture(requestId: String)` | Start one capture and return immediately |
| `cancel()` | Stop the capture in progress (user pressed Cancel) |

When the finger has been read (or the capture failed), the app calls into the page **on the main
thread**:

```js
window.onFingerprintCapture(requestId, jsonString)
```

with one of:

```json
{"ok":true,"format":"RAW","width":300,"height":400,"dpi":500,"data":"<base64>"}
{"ok":false,"error":"Press the finger flat and try again."}
```

- `format` is `RAW` (8-bit grayscale, row by row, exactly `width * height` bytes), `PNG`, `JPEG`, or
  `ISO` (an ISO/IEC 19794-2 template, the fallback when the SDK cannot give an image).
- `dpi` is the sensor's resolution (500 for the sensors on the shortlist).
- `error` is shown to the person at the kiosk, so keep it short and plain.
- Reply once per `requestId`. If `cancel()` is called, send nothing or an `ok:false`.
- Capture should time out inside the app after about 20 seconds (the page also times out).

## Quick test without the sensor

Open the kiosk page in a desktop browser and paste this in the console to pretend there is a sensor
(it returns a fingerprint image you host at `window.__fp`):

```js
window.__fp = '/crm/some-fingerprint.png';
window.AndroidFingerprint = { isReady: () => true, cancel: () => {}, capture: (id) => {
  fetch(window.__fp).then(r => r.blob()).then(b => { const fr = new FileReader();
    fr.onload = () => window.onFingerprintCapture(id, JSON.stringify({ok:true, format:'PNG', dpi:500, data:String(fr.result).split(',')[1]}));
    fr.readAsDataURL(b); }); } };
```

## Server settings you will tune after real scans

`FingerprintPolicy` (scores from SourceAFIS, higher is closer): `ACCEPT_MIN = 50` (punch is recorded
but waits for HR), `CONFIDENT_MIN = 70` (trusted). `FingerprintService.MIN_TEMPLATE_BYTES = 150`
rejects blank or faint scans. These are starting values: calibrate them with real fingers from the
chosen sensor (same finger vs different people) before relying on them.
