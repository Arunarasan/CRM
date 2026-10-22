import type { FingerCapture } from '@/api/attendanceApi';

/**
 * Fingerprint capture from a SecuGen scanner plugged into this computer (HR desk enrolment).
 *
 * A browser cannot reach a USB scanner itself. SecuGen's free "WebAPI" (SgiBioSrv) runs as a Windows
 * service on the PC and answers https://localhost:8443/SGIFPCapture with one scan:
 *   {ErrorCode, ImageWidth, ImageHeight, ImageDPI, ImageQuality, BMPBase64, TemplateBase64, ...}
 * The BMP goes to the server, which builds the template itself (the same way as kiosk scans).
 *
 * Its certificate is self-signed: open https://localhost:8443 once in this browser and accept it,
 * otherwise every request fails as "cannot reach".
 */

export const SECUGEN_WEBAPI_URL = 'https://localhost:8443';

const ERRORS: Record<number, string> = {
  3: 'The SecuGen WebAPI rejected the request. Update SecuGen WebAPI and try again.',
  51: 'The SecuGen driver files could not be loaded. Reinstall the SecuGen driver.',
  52: 'The scanner could not be started. Unplug it, plug it back in and try again.',
  53: 'The scanner was not found. Check the USB cable.',
  54: 'No finger was placed on the scanner. Try again.',
  55: 'The scanner was not found. Plug it into this PC and try again.',
  56: 'The SecuGen driver is not installed. Install the driver for your scanner model.',
  57: 'The scan was unclear. Press the finger flat on the scanner and try again.',
  59: 'The scanner is busy in another program. Close the SecuGen demo or other apps using it.',
  61: 'This scanner model is not supported by the installed SecuGen WebAPI.',
  63: 'The SecuGen service has not started yet. Wait a moment and try again.',
};

let current: AbortController | null = null;

/** One scan from the SecuGen scanner on this PC. Rejects with a message HR can act on. */
export async function captureSecugen(timeoutMs = 15000): Promise<FingerCapture> {
  cancelSecugen();
  const ctrl = new AbortController();
  current = ctrl;
  // A little longer than the scanner's own timeout so its "no finger" answer arrives first.
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs + 5000);
  const body = new URLSearchParams({ Timeout: String(timeoutMs), Quality: '50', licstr: '', templateFormat: 'ISO' });
  let res: Response;
  try {
    res = await fetch(`${SECUGEN_WEBAPI_URL}/SGIFPCapture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    if (ctrl.signal.aborted) throw new Error(current === ctrl ? 'No finger was placed on the scanner. Try again.' : 'Scan cancelled.');
    throw new Error(`Cannot reach the SecuGen WebAPI on this PC. Install SecuGen WebAPI, plug the scanner in, then open ${SECUGEN_WEBAPI_URL} once in this browser and allow it.`);
  } finally {
    window.clearTimeout(timer);
    if (current === ctrl) current = null;
  }

  let r: any;
  try { r = await res.json(); } catch { throw new Error('The SecuGen WebAPI sent an unreadable reply.'); }
  const code = Number(r?.ErrorCode ?? -1);
  if (code !== 0) throw new Error(ERRORS[code] || `The SecuGen scanner reported error ${code}. Try again.`);
  if (r.BMPBase64) {
    return { format: 'BMP', width: r.ImageWidth, height: r.ImageHeight, dpi: r.ImageDPI || 500, data: r.BMPBase64 };
  }
  if (r.TemplateBase64) return { format: 'ISO', data: r.TemplateBase64 };
  throw new Error('The SecuGen scanner returned no image. Try again.');
}

export function cancelSecugen() {
  const c = current;
  current = null;
  c?.abort();
}
