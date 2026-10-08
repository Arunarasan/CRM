/**
 * Attendance phone binding — the phone's own key.
 *
 * On first use the browser generates an ECDSA P-256 key pair with a NON-EXTRACTABLE private half and
 * keeps it (plus a random device id) in IndexedDB. Only the public half ever leaves the phone, so the
 * binding can't be copied to another device. Every clock action signs a one-time server nonce with
 * it; the server checks the signature against the bound public key.
 *
 * Signing contract (matches DeviceBindingService): ECDSA/SHA-256 over the UTF-8 bytes of the nonce
 * string exactly as issued; the raw 64-byte r||s signature is sent base64url-encoded.
 *
 * Caveat: clearing site data / reinstalling the browser deletes the key → the phone looks new and
 * needs a phone-change request. On iPhone, Safari wipes site storage after ~7 days of non-use unless
 * the portal is added to the Home Screen, and the Home Screen app has storage SEPARATE from Safari —
 * so iPhone users should install first and register from the installed app.
 */

const DB_NAME = 'arudra-device';
const STORE = 'keys';
const RECORD = 'attendance';

interface StoredDevice {
  deviceUuid: string;
  keyPair: CryptoKeyPair;
  createdAt: string;
}

export interface LocalDevice {
  deviceUuid: string;
  publicKey: string; // SPKI, base64
}

export function deviceKeySupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true
    && !!window.crypto?.subtle && typeof indexedDB !== 'undefined';
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1); // iPadOS desktop UA
}

/** Running as an installed Home Screen / standalone app (not a browser tab). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (navigator as any).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

// --- IndexedDB ------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readStored(): Promise<StoredDevice | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(RECORD);
      req.onsuccess = () => resolve((req.result as StoredDevice) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function writeStored(value: StoredDevice): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, RECORD);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// --- encoding -------------------------------------------------------------

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function toB64Url(buf: ArrayBuffer): string {
  return toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newUuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

// --- public API -------------------------------------------------------------

let cached: StoredDevice | null = null;

async function loadStored(): Promise<StoredDevice | null> {
  if (cached) return cached;
  try {
    cached = await readStored();
  } catch {
    cached = null;
  }
  return cached;
}

async function toLocal(d: StoredDevice): Promise<LocalDevice> {
  const spki = await crypto.subtle.exportKey('spki', d.keyPair.publicKey);
  return { deviceUuid: d.deviceUuid, publicKey: toB64(spki) };
}

/** This phone's key, if one was created before (never creates). */
export async function getLocalDevice(): Promise<LocalDevice | null> {
  if (!deviceKeySupported()) return null;
  const d = await loadStored();
  return d ? toLocal(d) : null;
}

/** This phone's key, creating (and persisting) it on first use. */
export async function getOrCreateLocalDevice(): Promise<LocalDevice> {
  if (!deviceKeySupported()) throw new Error('This browser can’t register a phone. Open the portal over https:// in Chrome or Safari.');
  let d = await loadStored();
  if (!d) {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // private key can never be exported
      ['sign', 'verify'],
    );
    d = { deviceUuid: newUuid(), keyPair, createdAt: new Date().toISOString() };
    await writeStored(d);
    cached = d;
    // Ask the browser not to evict our storage under pressure (best-effort; ignored where unsupported).
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
  }
  return toLocal(d);
}

/** Signs a server nonce with this phone's private key → base64url raw r||s signature. */
export async function signNonce(nonce: string): Promise<string> {
  const d = await loadStored();
  if (!d) throw new Error('This phone has no attendance key yet.');
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, d.keyPair.privateKey, new TextEncoder().encode(nonce));
  return toB64Url(sig);
}

/** Friendly "Android · Chrome"-style label for this phone. */
export function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Android/.test(ua) ? 'Android' : isIOS() ? (/iPad/.test(ua) ? 'iPad' : 'iPhone')
    : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : 'Device';
  const browser = /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /EdgA|Edg\//.test(ua) ? 'Edge'
    : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${isStandalone() ? 'App' : browser}`;
}
