export interface GeoFix { lat: number; lng: number; accuracy: number }

/**
 * Samples GPS via watchPosition and returns the MOST ACCURATE fix seen within the window.
 *
 * Why not getCurrentPosition: its first (and often only) fix is frequently a coarse network/cell/Wi‑Fi
 * estimate (accuracy in the hundreds of metres). The GPS radio then converges over several seconds, so
 * watching and keeping the reading with the smallest accuracy radius yields a far tighter location —
 * the single biggest lever on geofence reliability.
 *
 * Accuracy tactics baked in:
 *  - `minWaitMs`: never accept the very first reading, even if it *claims* to be under target — an
 *    early Wi‑Fi fix can optimistically report a small radius. Keep collecting for a beat so a real
 *    GPS lock (which lands a moment later and is usually tighter) can win.
 *  - `targetAccuracyM`: once a reading at/under this arrives (after minWait), stop early.
 *  - `maxWaitMs`: hard stop — return the best seen so far.
 *
 * Resolves null when geolocation is unavailable or permission is denied with no fix.
 */
export function getBestPosition(opts?: {
  targetAccuracyM?: number;
  minWaitMs?: number;
  maxWaitMs?: number;
  onProgress?: (best: GeoFix) => void;
}): Promise<GeoFix | null> {
  const targetAccuracy = opts?.targetAccuracyM ?? 18;
  const minWait = opts?.minWaitMs ?? 2500;
  const maxWait = opts?.maxWaitMs ?? 15000;

  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return resolve(null);

    let best: GeoFix | null = null;
    let watchId: number | null = null;
    let hardTimer: number | null = null;
    let settled = false;
    const startedAt = Date.now();

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (hardTimer != null) window.clearTimeout(hardTimer);
      resolve(best);
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const fix: GeoFix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          if (!best || fix.accuracy < best.accuracy) {
            best = fix;
            opts?.onProgress?.(fix);
          }
          // Only stop early once we've watched for a beat AND have a genuinely tight fix.
          if (Date.now() - startedAt >= minWait && best.accuracy <= targetAccuracy) finish();
        },
        () => { if (!best) finish(); }, // permission/position error: return whatever we have (maybe null)
        { enableHighAccuracy: true, timeout: maxWait, maximumAge: 0 },
      );
      hardTimer = window.setTimeout(finish, maxWait);
    } catch {
      resolve(null);
    }
  });
}

export interface SiteAddress { address?: string; city?: string; district?: string; state?: string; pincode?: string }

/**
 * Street address for a GPS spot, from OpenStreetMap's free geocoder (same service the map picker uses).
 * Best-effort: resolves {} when offline or nothing is known for the spot, so callers never block on it.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<SiteAddress> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return {};
    const a = (await res.json())?.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const area = a.neighbourhood || a.suburb || a.village || a.hamlet || a.quarter;
    const city = a.city || a.town || a.municipality || a.village || a.county;
    return {
      address: [street, area !== city ? area : null].filter(Boolean).join(', ') || undefined,
      city: city || undefined,
      district: a.state_district || a.county || undefined,
      state: a.state || undefined,
      pincode: a.postcode ? String(a.postcode).replace(/\s/g, '') : undefined,
    };
  } catch {
    return {};
  }
}

/** Why the phone gave no fix — turns a null from getBestPosition into a message the employee can act on. */
export async function locationErrorMessage(): Promise<string> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'This phone can’t share its location.';
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (p?.state === 'denied') return 'Location is blocked. Turn on location (GPS) and allow it for this app, then try again.';
  } catch { /* permissions API missing — fall through */ }
  return 'Couldn’t get your location. Turn on GPS, step outside if you can, and try again.';
}
