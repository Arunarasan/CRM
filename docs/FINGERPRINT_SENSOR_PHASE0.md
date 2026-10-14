# Fingerprint sensor for the office kiosk: Phase 0 (choose the sensor, prove it works)

Goal: add **fingerprint** as a second way to check in/out on the office kiosk phone, using an external
USB fingerprint sensor, next to the existing face check (see the kiosk feature, commit `8a3a5f2`).

Phase 0 decides **which sensor to buy** and proves, **before any app is built**, that we can get a
usable fingerprint out of it on an Android phone. Nothing here changes the CRM code.

## 1. The one thing that decides everything

To identify *who* touched the sensor (1:N: "which of our employees is this?") we must get from the
sensor either:

- **A raw fingerprint image** (grayscale, 500 dpi): the best case. The server matches with SourceAFIS.
- **Or an ISO/IEC 19794-2 minutiae template**: workable, a bit less accurate.

We **cannot** use sensors that only work through the **Aadhaar RD Service**. That service returns an
encrypted block meant for UIDAI authentication; the CRM can't read or match it.

## 2. What the research found (and what it could not confirm)

| Item | Finding | Confidence |
|---|---|---|
| **SourceAFIS (server-side matcher)** | Apache 2.0, Java 11+ (we run 17), Android API 24+. Latest on Maven Central is **3.18.1**. Accepts a raw grayscale buffer, PNG/JPEG, or ISO/ANSI templates. No built-in 1:N search: we loop over the stored templates. Threshold 40 ≈ 0.01% false-match for one comparison, "a good starting point". | Confirmed on the official page |
| **SecuGen Hamster Pro 20 / Hamster IV** | Free "FDx SDK Pro for Android" (request form), USB OTG supported, Android 3.1+, produces **ISO 19794-2** templates. 500 ppi, about 300x400 px. | Confirmed on SecuGen's page |
| SecuGen Android: **raw image?** | The Android SDK page lists capture, template and 1:1 matching but does **not** state raw-image access (the Windows/Linux SDKs do). | **Unconfirmed, ask SecuGen** |
| **Startek FM220U** | Listings mention an Android API with image capture and WSQ, but real-world Android guides route it through an **L1 RD Service app**. | Unconfirmed, ask Startek |
| **Mantra MFS100** | STQC certified, works on Android. Its Android SDK details could not be found publicly. | Unconfirmed, ask Mantra |
| WebUSB (no app) | Vendor sensors use their own protocols, so a web page alone can't read them. We need a small Android app. | Design decision |

Sources: [SourceAFIS for Java](https://sourceafis.machinezoo.com/java),
[SecuGen SDK page](https://secugen.com/products/sdk/),
[SecuGen Hamster Pro 20](https://secugen.com/?p=1489),
[Neurotechnology: Startek FM220U](https://neurotechnology.com/fingerprint-scanner-startek-fm220u.html),
[Signzy FM220U guide](https://docs.signzy.com/contract360/startek-fm220u-l1-device),
[MFS100 Android FAQ](https://www.scribd.com/document/434164410/MFS100-FAQ-and-Support-Android).

## 3. Recommendation

1. **Shortlist: SecuGen Hamster Pro 20** (first choice). It has a free Android SDK, USB OTG support and
   ISO templates, and is widely sold in India. It is the only one where the vendor's own page
   confirms Android + OTG + templates.
2. Backup: **Mantra MFS100** or **Startek FM220U**, but only if the vendor confirms in writing that the
   Android SDK returns a raw image or ISO template (not RD Service only).
3. **Do not buy yet.** First get the vendor's answers below (they cost nothing), then buy **one**
   sensor and run the tests in section 5. Only buy more after it passes.

## 4. Questions to send the vendor (copy and paste)

> We want to use your fingerprint scanner (model: ______) connected by USB OTG to an Android phone,
> inside our own Android app, to identify staff for attendance (1:N matching on our own server).
> Please confirm in writing:
> 1. Does your **Android SDK** give us the **raw fingerprint image** (grayscale, 500 dpi)? In what
>    format (raw bytes, BMP, WSQ)?
> 2. If not, does it give an **ISO/IEC 19794-2 template** we can use on our server?
> 3. Is it usable **without the Aadhaar RD Service**? We are not doing Aadhaar authentication.
> 4. Is the SDK **free**? Any per-device licence, registration key or yearly fee?
> 5. Minimum Android version, and does it work on Android 13/14 with the USB permission prompt?
> 6. Can we ship the SDK inside our own app (APK we install ourselves)?
> 7. Does the scanner have **live-finger (fake finger) detection**?
> 8. Please send a sample app or demo project.

**Pass:** answers 1 or 2 are "yes", 3 is "yes", 6 is "yes". Anything else, pick another sensor.

## 5. Acceptance tests with the real sensor (run on the actual kiosk phone)

Use the vendor's **demo app** first; no code of ours is needed for tests A to C.

| # | Test | Pass when |
|---|---|---|
| A | Phone supports **USB OTG** (plug the sensor in, the vendor demo detects it) | Demo captures a finger |
| B | Capture one finger **5 times**, save the images/templates | 5 files obtained; images are about 500 dpi grayscale, not blank |
| C | Capture at least **10 different people**, 2 fingers each, 2 scans per finger. Include a dry, a wet and a rough (workshop) finger | Image quality is usable by eye in at least 9 of 10 people |
| D | Send us the saved files. We run SourceAFIS on them: same finger vs same finger, and different people | Same-finger scores clearly above different-finger scores (we can pick a threshold with a gap) |
| E | Time one capture, from touch to data | Under 2 seconds |
| F | Leave the sensor plugged in for a full day, re-plug it | The permission prompt and detection still work |

**Go / no-go:** go to Phase 1 only if A, B, D and E pass and C has at most one person with a poor image.

## 6. What happens after Phase 0 passes

- **Matching threshold:** SourceAFIS gives a score per comparison. With 1:N the chance of a false
  match grows with the number of employees, so we will calibrate with your real test files (test D)
  rather than use 40 blindly.
- **Templates:** store SourceAFIS 3.18.1 templates plus an `engine_version` column. SourceAFIS
  templates are tied to a library version; the plan is to pin the version and re-enrol if we upgrade.
- **Privacy:** get written consent from each employee, store only templates (never the images), delete
  on exit. Fingerprints are sensitive personal data under India's DPDP Act 2023.
- Then Phase 1 (Android kiosk app), Phase 2 (server), and so on, as in the plan.

## 7. Notes from this machine

- An Android SDK is already installed here (platforms 29 to 31, `platform-tools`), so Phase 1 can be
  built and installed on a phone over USB with `adb`.
- `adb` is not on the PATH. It is in `%LOCALAPPDATA%\Android\Sdk\platform-tools`.
