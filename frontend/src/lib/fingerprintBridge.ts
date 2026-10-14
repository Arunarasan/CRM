import type { FingerCapture } from '@/api/attendanceApi';

/**
 * The link between the CRM web page and the fingerprint sensor.
 *
 * A web page cannot talk to a USB fingerprint sensor, so the kiosk phone runs a small Android app
 * (a WebView around this site) that owns the sensor through the maker's SDK and exposes it to the
 * page. This file is the page's half of that contract; the app implements the other half:
 *
 *   window.AndroidFingerprint.isReady(): boolean             sensor plugged in and permission granted
 *   window.AndroidFingerprint.capture(requestId: string)     start one capture (returns at once)
 *   window.AndroidFingerprint.cancel()                       abandon the capture in progress
 *
 * When the finger has been scanned (or it failed) the app calls
 *
 *   window.onFingerprintCapture(requestId, json)
 *
 * with json = {"ok":true,"format":"RAW"|"PNG"|"JPEG"|"ISO","width":W,"height":H,"dpi":500,"data":"<base64>"}
 * or {"ok":false,"error":"<message for the person at the kiosk>"}.
 *
 * Format RAW is 8-bit grayscale, row by row, width x height bytes. An ISO 19794-2 template is accepted
 * as a fallback when the sensor's SDK cannot give an image (matching is less accurate with it).
 * Outside the app there is no `AndroidFingerprint`, so fingerprint features are simply unavailable.
 */

interface AndroidFingerprintApi {
  isReady(): boolean;
  capture(requestId: string): void;
  cancel(): void;
}

declare global {
  interface Window {
    AndroidFingerprint?: AndroidFingerprintApi;
    onFingerprintCapture?: (requestId: string, json: string) => void;
  }
}

export function fingerprintSensorAvailable(): boolean {
  try { return !!window.AndroidFingerprint && window.AndroidFingerprint.isReady(); } catch { return false; }
}

/** True inside the kiosk app, even if the sensor is not plugged in right now. */
export function insideKioskApp(): boolean {
  return typeof window !== 'undefined' && !!window.AndroidFingerprint;
}

let counter = 0;
const waiting = new Map<string, { resolve: (c: FingerCapture) => void; reject: (e: Error) => void; timer: number }>();

function install() {
  if (window.onFingerprintCapture) return;
  window.onFingerprintCapture = (requestId, json) => {
    const w = waiting.get(requestId);
    if (!w) return;
    waiting.delete(requestId);
    window.clearTimeout(w.timer);
    try {
      const r = JSON.parse(json);
      if (r.ok && r.data) w.resolve({ format: r.format, width: r.width, height: r.height, dpi: r.dpi, data: r.data });
      else w.reject(new Error(r.error || 'The fingerprint could not be read. Try again.'));
    } catch {
      w.reject(new Error('The fingerprint sensor sent an unreadable reply.'));
    }
  };
}

/** Waits for one finger on the sensor. Rejects with a readable message on timeout, error or no sensor. */
export function captureFingerprint(timeoutMs = 20000): Promise<FingerCapture> {
  if (!window.AndroidFingerprint) {
    return Promise.reject(new Error('No fingerprint sensor here. Use the kiosk app with the sensor connected.'));
  }
  if (!fingerprintSensorAvailable()) {
    return Promise.reject(new Error('The fingerprint sensor is not connected. Plug it in and allow access.'));
  }
  install();
  const id = `fp${Date.now()}_${++counter}`;
  return new Promise<FingerCapture>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      waiting.delete(id);
      try { window.AndroidFingerprint?.cancel(); } catch { /* ignore */ }
      reject(new Error('No finger was placed on the sensor. Try again.'));
    }, timeoutMs);
    waiting.set(id, { resolve, reject, timer });
    try { window.AndroidFingerprint!.capture(id); }
    catch { waiting.delete(id); window.clearTimeout(timer); reject(new Error('Could not start the fingerprint sensor.')); }
  });
}

export function cancelFingerprint() {
  try { window.AndroidFingerprint?.cancel(); } catch { /* ignore */ }
}

/**
 * Test aid for HR without the app: turns image files (PNG/JPEG fingerprint images, for example saved
 * by the sensor maker's demo app) into captures, so enrolment can be tried on a computer.
 */
export function readFingerprintFiles(files: FileList | File[]): Promise<FingerCapture[]> {
  return Promise.all(Array.from(files).map((f) => new Promise<FingerCapture>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const url = String(reader.result);
      const data = url.slice(url.indexOf(',') + 1);
      resolve({ format: f.type === 'image/jpeg' ? 'JPEG' : 'PNG', dpi: 500, data });
    };
    reader.readAsDataURL(f);
  })));
}
