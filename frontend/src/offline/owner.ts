/** Who is logged in (JWT subject). Offline data is tagged with this so one person's queue is never sent as another. */
export function currentOwner(): string | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = JSON.parse(json)?.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
