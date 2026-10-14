/**
 * HR → Attendance → Setup: register the office kiosk phones (shared face-attendance devices).
 * HR adds a kiosk, gets a one-time pairing code, and types it on the phone at /kiosk. Re-pairing
 * replaces the phone (the old one stops working immediately).
 */
import { useEffect, useState } from 'react';
import { Tablet, Plus, Loader2, Copy, RefreshCw, Trash2, Power, ExternalLink } from 'lucide-react';
import { attendanceApi, AttendanceKioskRow, AttendanceLocation, KioskVerifyMode } from '@/api/attendanceApi';
import { Button } from '@/components/ui/button';
import { BaseInput } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

const INPUT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const errText = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

/** Where the kiosk phone should open — the CRM base path is /crm/ in production. */
const kioskUrl = () => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/kiosk`;

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

export function KioskSetup() {
  const [rows, setRows] = useState<AttendanceKioskRow[]>([]);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  // Pairing codes are only returned by create / re-pair, so keep them in view until dismissed.
  const [codes, setCodes] = useState<Record<number, { code: string; expires: string | null }>>({});

  const load = () => {
    setLoading(true);
    attendanceApi.listKiosks().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    attendanceApi.listLocations().then(setLocations).catch(() => setLocations([]));
  }, []);
  // Keep the online dot fresh while the card is open.
  useEffect(() => {
    const t = window.setInterval(() => attendanceApi.listKiosks().then(setRows).catch(() => {}), 30000);
    return () => window.clearInterval(t);
  }, []);

  const remember = (k: AttendanceKioskRow) => {
    if (k.pairingCode) setCodes((c) => ({ ...c, [k.id]: { code: k.pairingCode!, expires: k.pairingExpiresAt } }));
  };

  const add = async () => {
    if (!name.trim()) return toast.error('Give the kiosk a name, e.g. Front desk.');
    setSaving(true);
    try {
      const k = await attendanceApi.createKiosk({ name: name.trim(), officeLocationId: locationId ? Number(locationId) : null });
      remember(k);
      setName(''); setLocationId(''); setAdding(false);
      toast.success('Kiosk added — type the code on the phone');
      load();
    } catch (e: any) { toast.error(errText(e, 'Could not add kiosk')); } finally { setSaving(false); }
  };

  const act = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try { await fn(); toast.success(ok); load(); } catch (e: any) { toast.error(errText(e, 'Action failed')); } finally { setBusy(null); }
  };

  const repair = (k: AttendanceKioskRow) => {
    if (k.paired && !window.confirm(`Re-pair "${k.name}"? The phone using it now will stop working until the new code is entered.`)) return;
    act(k.id, async () => remember(await attendanceApi.repairKiosk(k.id)), 'New pairing code ready');
  };

  const remove = (k: AttendanceKioskRow) => {
    if (!window.confirm(`Remove kiosk "${k.name}"? The phone will stop working.`)) return;
    act(k.id, () => attendanceApi.deleteKiosk(k.id), 'Kiosk removed');
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => {});

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Tablet className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Office kiosk (face / fingerprint)</h2>
        </div>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add kiosk</Button>}
      </header>

      <div className="space-y-3 p-4 sm:p-5">
        <p className="text-xs text-muted-foreground">
          One shared phone or tablet at the office where staff check in and out. Add it here, then open{' '}
          <a href={kioskUrl()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary underline">
            {kioskUrl()} <ExternalLink className="h-3 w-3" />
          </a>{' '}
          on that phone and type the pairing code.
        </p>

        {adding && (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Kiosk name</span>
              <BaseInput className={INPUT} value={name} maxLength={150} placeholder="e.g. Front desk" autoFocus
                onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Office location</span>
              <select className={INPUT} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">— none —</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
              <Button size="sm" onClick={add} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create</Button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && rows.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No kiosk registered yet.</p>
        )}

        {rows.map((k) => {
          const c = codes[k.id];
          const showCode = c && !k.paired; // once paired the code is spent
          return (
            <div key={k.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${k.online ? 'bg-emerald-500' : k.paired ? 'bg-amber-400' : 'bg-slate-300'}`} />
                    {k.name}
                    {!k.active && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">OFF</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {k.officeLocationName ?? 'No office location'} ·{' '}
                    {k.paired
                      ? (k.online ? 'Online' : `Last seen ${ago(k.lastSeenAt)}`)
                      : k.waitingForPairing ? 'Waiting to be paired' : 'Not paired — pairing code expired'}
                  </p>
                  {k.paired && k.deviceInfo && <p className="truncate text-[11px] text-muted-foreground" title={k.deviceInfo}>{k.deviceInfo}</p>}
                </div>
                <div className="flex gap-1.5">
                  <select aria-label="What this kiosk accepts" value={k.verifyMode} disabled={busy === k.id}
                    onChange={(e) => act(k.id, () => attendanceApi.updateKiosk(k.id, { name: k.name, officeLocationId: k.officeLocationId, active: k.active, verifyMode: e.target.value as KioskVerifyMode }), 'Kiosk updated')}
                    className="h-8 rounded-md border border-input bg-card px-2 text-xs">
                    <option value="FACE">Face only</option>
                    <option value="FINGER">Fingerprint only</option>
                    <option value="EITHER">Face or fingerprint</option>
                  </select>
                  <Button size="sm" variant="outline" disabled={busy === k.id} onClick={() => repair(k)}>
                    <RefreshCw className="h-3.5 w-3.5" /> {k.paired ? 'Re-pair' : 'New code'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === k.id}
                    onClick={() => act(k.id, () => attendanceApi.updateKiosk(k.id, { name: k.name, officeLocationId: k.officeLocationId, active: !k.active }),
                      k.active ? 'Kiosk switched off' : 'Kiosk switched on')}>
                    <Power className="h-3.5 w-3.5" /> {k.active ? 'Turn off' : 'Turn on'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={busy === k.id} onClick={() => remove(k)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {showCode && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-2.5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pairing code</p>
                    <p className="font-mono text-2xl font-bold tracking-widest">{c.code}</p>
                    {c.expires && <p className="text-[11px] text-muted-foreground">Valid until {new Date(c.expires).toLocaleString()}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(c.code)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                </div>
              )}
              {!k.paired && !showCode && k.waitingForPairing && (
                <p className="mt-2 text-xs text-muted-foreground">A code was issued earlier. Press “New code” to see a fresh one.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
