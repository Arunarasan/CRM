/**
 * Browser-side WebAuthn helpers for attendance device-biometric verification.
 *
 * The server sends/receives all binary fields as base64url strings; the WebAuthn browser API works
 * in ArrayBuffers. These helpers bridge the two and drive navigator.credentials.create / .get.
 */

export function webauthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

/**
 * WebAuthn requires a secure context: HTTPS, or http://localhost. Served over plain HTTP from a
 * domain or an IP address, the browser refuses every ceremony.
 */
export function secureContextOk(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/** Turns a raw WebAuthn DOMException into guidance an employee can act on. */
export function describeWebauthnError(e: any): string {
  if (!secureContextOk()) {
    return 'Biometric needs a secure (HTTPS) connection. Open the portal at its https:// address (not an IP) and try again.';
  }
  const name = e?.name || '';
  switch (name) {
    case 'NotAllowedError':
      return 'The biometric prompt was dismissed or timed out. Try again and complete the fingerprint / face scan.';
    case 'InvalidStateError':
      return 'This device is already registered for your account.';
    case 'SecurityError':
      return 'This site’s address does not match its security domain, so biometric was blocked. Contact your admin.';
    case 'NotSupportedError':
      return 'This device or browser does not support biometric sign-in.';
    case 'AbortError':
      return 'The biometric prompt was cancelled.';
    default:
      return e?.message || 'Could not complete the biometric step.';
  }
}

/** True if this device has a built-in (platform) authenticator — fingerprint / face / Windows Hello. */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return webauthnSupported() && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

function b64urlToBuf(s: string): ArrayBuffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type CredDescriptor = { type: string; id: string };

/**
 * Runs registration (navigator.credentials.create) from the server's options and returns the
 * attestation fields (base64url) to send back to /webauthn/register/verify.
 */
export async function register(options: any): Promise<{ attestationObject: string; clientDataJSON: string }> {
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: b64urlToBuf(options.challenge),
    user: { ...options.user, id: b64urlToBuf(options.user.id) },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: CredDescriptor) => ({
      type: c.type, id: b64urlToBuf(c.id),
    })),
  };
  const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Registration was cancelled.');
  const resp = cred.response as AuthenticatorAttestationResponse;
  return {
    attestationObject: bufToB64url(resp.attestationObject),
    clientDataJSON: bufToB64url(resp.clientDataJSON),
  };
}

/**
 * Runs assertion (navigator.credentials.get) from the server's options and returns the assertion
 * fields (base64url) to send with the clock-in payload. Returns null if the user cancels / fails.
 */
export async function assert(options: any): Promise<{
  credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string; userHandle: string | null;
} | null> {
  try {
    const publicKey: PublicKeyCredentialRequestOptions = {
      ...options,
      challenge: b64urlToBuf(options.challenge),
      allowCredentials: (options.allowCredentials ?? []).map((c: CredDescriptor) => ({
        type: c.type, id: b64urlToBuf(c.id),
      })),
    };
    const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
    if (!cred) return null;
    const resp = cred.response as AuthenticatorAssertionResponse;
    return {
      credentialId: bufToB64url(cred.rawId),
      authenticatorData: bufToB64url(resp.authenticatorData),
      clientDataJSON: bufToB64url(resp.clientDataJSON),
      signature: bufToB64url(resp.signature),
      userHandle: resp.userHandle ? bufToB64url(resp.userHandle) : null,
    };
  } catch {
    return null;
  }
}
