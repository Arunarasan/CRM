/**
 * Attendance verification admin.
 *  - Office locations: the geofences a GEO clock-in is measured against (name, lat/lng, radius).
 *  - Pending approvals: clock-ins that failed their auto-check (outside the fence / unverified),
 *    recorded but held for HR to approve or reject (soft enforcement).
 */
import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Crosshair, Loader2, ShieldAlert, Check, X, ExternalLink, Fingerprint } from 'lucide-react';
import { attendanceApi, AttendanceLocation, PendingAttendance, MethodRequest } from '@/api/attendanceApi';
import { getBestPosition } from '@/lib/geo';
import LocationMapPicker from '@/components/LocationMapPicker';
import { toast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';

/**
 * The attendance-verification admin body, mounted both as the Workforce → Attendance page and as
 * the Tasks → Attendance tab.
 */
export function AttendanceAdmin() {
  return (
    <div className="space-y-6">
      <MethodRequests />
      <PendingApprovals />
      <OfficeLocations />
    </div>
  );
}

/* --------------------------- Biometric method requests --------------------------- */

function MethodRequests() {
  const [rows, setRows] = useState<MethodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    attendanceApi.listMethodRequests().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resolve = async (row: MethodRequest, approve: boolean) => {
    setBusy(row.employeeId);
    try {
      approve ? await attendanceApi.approveMethodRequest(row.employeeId) : await attendanceApi.rejectMethodRequest(row.employeeId);
      toast.success(approve ? 'Biometric attendance enabled' : 'Request rejected');
      setRows((prev) => prev.filter((r) => r.employeeId !== row.employeeId));
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  // Nothing pending → hide the section entirely to keep the screen clean.
  if (!loading && rows.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <Fingerprint className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Biometric attendance requests</h2>
        {rows.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{rows.length}</span>
        )}
      </header>
      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.employeeId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{r.employeeName}</span>
                  {r.employeeCode && <span className="text-xs text-muted-foreground">({r.employeeCode})</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Wants to switch from <b>{r.currentMethod ?? 'GEO'}</b> to biometric ({r.requestedMethod}).
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="forest" size="sm" disabled={busy === r.employeeId} onClick={() => resolve(r, true)}>
                  {busy === r.employeeId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                </Button>
                <Button variant="outline" size="sm" disabled={busy === r.employeeId} onClick={() => resolve(r, false)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HrAttendancePage() {
  return <AttendanceAdmin />;
}

/* -------------------------------- Pending approvals -------------------------------- */

function PendingApprovals() {
  const [rows, setRows] = useState<PendingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    attendanceApi.listPending().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const resolve = async (row: PendingAttendance, approve: boolean) => {
    setBusy(row.sessionId);
    try {
      approve ? await attendanceApi.approve(row.sessionId) : await attendanceApi.reject(row.sessionId);
      toast.success(approve ? 'Attendance approved' : 'Attendance rejected');
      setRows((prev) => prev.filter((r) => r.sessionId !== row.sessionId));
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center gap-2 border-b px-5 py-4">
        <ShieldAlert className="h-5 w-5 text-amber-500" />
        <h2 className="text-base font-semibold">Clock-ins needing approval</h2>
        {rows.length > 0 && (
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{rows.length}</span>
        )}
      </header>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing to review — all clock-ins verified. 🎉</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.sessionId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{r.employeeName}</span>
                  {r.employeeCode && <span className="text-xs text-muted-foreground">({r.employeeCode})</span>}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.verificationMethod ?? '—'}</span>
                </div>
                <p className="mt-1 text-sm text-amber-700">{r.flagReason}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{r.date} · {r.checkInTime?.slice(0, 5)}</span>
                  {r.distanceMeters != null && (
                    <span>{r.distanceMeters} m from {r.officeLocation ?? 'office'}{r.accuracyMeters != null ? ` · ±${r.accuracyMeters} m GPS` : ''}</span>
                  )}
                  {r.lat != null && r.lng != null && (
                    <a className="inline-flex items-center gap-1 text-primary hover:underline"
                       href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> View on map
                    </a>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="forest" size="sm" disabled={busy === r.sessionId} onClick={() => resolve(r, true)}>
                  {busy === r.sessionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
                </Button>
                <Button variant="outline" size="sm" disabled={busy === r.sessionId} onClick={() => resolve(r, false)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------- Office locations -------------------------------- */

const EMPTY: AttendanceLocation = { name: '', latitude: 0, longitude: 0, radiusMeters: 150, address: '', active: true };

function OfficeLocations() {
  const [rows, setRows] = useState<AttendanceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AttendanceLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    attendanceApi.listLocations().then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const useMyLocation = async () => {
    if (!('geolocation' in navigator)) return toast.error('Geolocation not available on this device.');
    setLocating(true);
    // Sample GPS to converge on a precise centre — a coarse first fix makes a badly-placed fence.
    const fix = await getBestPosition({ targetAccuracyM: 20, maxWaitMs: 10_000 });
    setLocating(false);
    if (!fix) return toast.error('Could not get your location.');
    setDraft((d) => ({ ...(d ?? EMPTY), latitude: +fix.lat.toFixed(6), longitude: +fix.lng.toFixed(6) }));
    toast.success(`Filled in your coordinates (±${Math.round(fix.accuracy)} m). Stand at the office centre for best results.`);
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error('Give the location a name.');
    if (!draft.latitude || !draft.longitude) return toast.error('Set the latitude and longitude.');
    setSaving(true);
    try {
      await attendanceApi.saveLocation(draft);
      toast.success('Location saved');
      setDraft(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AttendanceLocation) => {
    if (!row.id || !confirm(`Delete "${row.name}"?`)) return;
    try {
      await attendanceApi.deleteLocation(row.id);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Location deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  const set = <K extends keyof AttendanceLocation>(k: K, v: AttendanceLocation[K]) =>
    setDraft((d) => ({ ...(d ?? EMPTY), [k]: v }));

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Office locations</h2>
        </div>
        {!draft && <Button size="sm" onClick={() => setDraft({ ...EMPTY })}><Plus className="h-4 w-4" /> Add location</Button>}
      </header>

      <p className="px-5 pt-3 text-xs text-muted-foreground">
        Geo-fenced clock-ins must be within a location's radius. With no active location, geo clock-ins aren't enforced.
      </p>

      {draft && (
        <div className="mx-5 mt-3 rounded-xl border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={INPUT} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Head Office" />
            </Field>
            <Field label="Radius (metres)">
              <input className={INPUT} type="number" min={20} value={draft.radiusMeters}
                     onChange={(e) => set('radiusMeters', Number(e.target.value))} />
            </Field>
            <Field label="Latitude">
              <input className={INPUT} type="number" step="0.000001" value={draft.latitude || ''}
                     onChange={(e) => set('latitude', Number(e.target.value))} placeholder="12.971600" />
            </Field>
            <Field label="Longitude">
              <input className={INPUT} type="number" step="0.000001" value={draft.longitude || ''}
                     onChange={(e) => set('longitude', Number(e.target.value))} placeholder="77.594600" />
            </Field>
            <Field label="Address (optional)" full>
              <input className={INPUT} value={draft.address ?? ''} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>

          {/* Interactive map — the accurate way to place/verify the office centre. */}
          <div className="mt-3">
            <LocationMapPicker
              lat={draft.latitude}
              lng={draft.longitude}
              radiusMeters={draft.radiusMeters}
              onChange={(la, lo) => setDraft((d) => ({ ...(d ?? EMPTY), latitude: la, longitude: lo }))}
            />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={draft.active} onChange={(e) => set('active', e.target.checked)} />
            Active
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Use my current location
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save location
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No office locations yet.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {!r.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Inactive</span>}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  <span>{r.latitude}, {r.longitude} · {r.radiusMeters} m radius</span>
                  {r.address && <span className="truncate">{r.address}</span>}
                  <a className="inline-flex items-center gap-1 text-primary hover:underline"
                     href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" /> Map
                  </a>
                </p>
              </div>
              <button onClick={() => remove(r)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="h-2" />
    </section>
  );
}

const INPUT = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
