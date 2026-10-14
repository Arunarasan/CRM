/**
 * HR side of the office kiosk, beyond setup: the punch log with selfies and face-match scores, and a
 * who-is-enrolled overview. The small SelfieThumb / FaceBadge pieces are also used by the pending
 * approvals list so HR sees the same evidence wherever a kiosk punch needs a decision.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanFace, Loader2, UserRound, ShieldAlert, CheckCircle2, Clock3, Tablet } from 'lucide-react';
import { attendanceApi, PendingAttendance } from '@/api/attendanceApi';
import { resolveFileUrl } from '@/lib/uploadFile';
import { BaseInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SearchableSelect from '@/components/ui/searchable-select';

const INPUT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/** A selfie that opens in the app's image viewer on click (the viewer catches links to uploaded images). */
export function SelfieThumb({ url, label }: { url?: string | null; label: string }) {
  if (!url) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" title={`${label}: no photo`}>
        <UserRound className="h-6 w-6" />
      </span>
    );
  }
  const href = resolveFileUrl(url);
  return (
    <a href={href} target="_blank" rel="noreferrer" title={`${label} selfie`} className="shrink-0">
      <img src={href} alt={`${label} selfie`} loading="lazy" className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" />
    </a>
  );
}

/** Face-match score: 0 is identical; up to 0.42 is a strong match, above that the punch was held for review. */
export function FaceBadge({ distance }: { distance?: number | null }) {
  if (distance == null) return null;
  const strong = distance <= 0.42;
  return (
    <span title="Face-match distance: lower is closer"
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${strong ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
      <ScanFace className="h-3 w-3" /> {strong ? 'Strong' : 'Weak'} match {distance.toFixed(2)}
    </span>
  );
}

function statusChip(r: PendingAttendance) {
  if (r.approvalStatus === 'REJECTED') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Rejected</span>;
  if (r.approvalStatus === 'APPROVED') return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Approved</span>;
  if (r.approvalStatus === 'PENDING') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"><ShieldAlert className="h-3 w-3" /> Waiting for approval</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Verified</span>;
}

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Which half of a session came from the kiosk, with its selfie, match score and liveness. */
function Half({ title, time, kiosk, selfie, distance, liveness }: {
  title: string; time?: string | null; kiosk: boolean; selfie?: string | null; distance?: number | null; liveness?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {kiosk ? <SelfieThumb url={selfie} label={title} /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[10px] text-muted-foreground">no kiosk</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-base font-semibold tabular-nums">{time ? time.slice(0, 5) : <span className="text-sm font-normal text-muted-foreground">still in</span>}</p>
        {kiosk && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <FaceBadge distance={distance} />
            {liveness && <span className="text-[11px] text-muted-foreground">{liveness === 'BLINK' ? 'blinked' : 'turned head'}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export function KioskLog() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 6 * 86400000)));
  const [to, setTo] = useState(iso(today));
  const [employeeId, setEmployeeId] = useState('');
  const [emps, setEmps] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [rows, setRows] = useState<PendingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [weakOnly, setWeakOnly] = useState(false);

  useEffect(() => {
    attendanceApi.listEmployees()
      .then((list) => setEmps(list.map((e) => ({ value: String(e.id), label: `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || `#${e.id}`, hint: e.employeeCode }))))
      .catch(() => setEmps([]));
  }, []);

  const load = () => {
    setLoading(true);
    attendanceApi.kioskLog({ from, to, employeeId: employeeId ? Number(employeeId) : undefined, limit: 300 })
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(load, [from, to, employeeId]);

  const shown = weakOnly
    ? rows.filter((r) => (r.faceDistanceIn ?? 0) > 0.42 || (r.faceDistanceOut ?? 0) > 0.42)
    : rows;

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <Tablet className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Kiosk punches</h2>
          <span className="text-xs text-muted-foreground">{shown.length} session{shown.length === 1 ? '' : 's'}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="h-4 w-4" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} />
          Weak matches only
        </label>
      </header>

      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-4 sm:px-5">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">From</span>
          <BaseInput type="date" className={INPUT} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">To</span>
          <BaseInput type="date" className={INPUT} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Employee</span>
          <SearchableSelect value={employeeId} onChange={setEmployeeId} options={[{ value: '', label: 'Everyone' }, ...emps]} placeholder="Everyone" />
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No kiosk punches in this period.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((r) => (
            <li key={r.sessionId} className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{r.employeeName}</span>
                {r.employeeCode && <span className="text-xs text-muted-foreground">({r.employeeCode})</span>}
                <span className="text-xs text-muted-foreground">{r.date}</span>
                {r.kioskName && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Tablet className="h-3 w-3" />{r.kioskName}</span>}
                <span className="ml-auto">{statusChip(r)}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Half title="Check in" time={r.checkInTime} kiosk={r.checkInSource === 'KIOSK'} selfie={r.selfieInUrl} distance={r.faceDistanceIn} liveness={r.livenessIn} />
                <Half title="Check out" time={r.checkOutTime} kiosk={r.checkOutSource === 'KIOSK'} selfie={r.selfieOutUrl} distance={r.faceDistanceOut} liveness={r.livenessOut} />
              </div>
              {r.flagReason && <p className="text-sm text-amber-700">{r.flagReason}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t px-4 py-2 sm:px-5">
        <Button variant="ghost" size="sm" onClick={load}><Clock3 className="h-4 w-4" /> Refresh</Button>
      </div>
    </section>
  );
}

/** Who can check in on the kiosk: enrolled employees, and who still needs enrolling. */
export function FaceEnrolmentOverview() {
  const [emps, setEmps] = useState<{ id: number; firstName: string; lastName: string; employeeCode: string }[]>([]);
  const [enrolled, setEnrolled] = useState<Record<number, { samples: number; enrolledAt: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [missingOnly, setMissingOnly] = useState(true);

  useEffect(() => {
    Promise.all([attendanceApi.listEmployees().catch(() => []), attendanceApi.faceSummary().catch(() => ({}))])
      .then(([list, summary]) => { setEmps(list); setEnrolled(summary as typeof enrolled); })
      .finally(() => setLoading(false));
  }, []);

  const done = emps.filter((e) => enrolled[e.id]).length;
  const list = (missingOnly ? emps.filter((e) => !enrolled[e.id]) : emps)
    .slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <ScanFace className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Face enrolment</h2>
          {!loading && <span className="text-xs text-muted-foreground">{done} of {emps.length} enrolled</span>}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="h-4 w-4" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Not enrolled only
        </label>
      </header>
      {loading ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : list.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">{missingOnly ? 'Everyone is enrolled.' : 'No employees.'}</p>
      ) : (
        <ul className="max-h-96 divide-y overflow-y-auto">
          {list.map((e) => {
            const en = enrolled[e.id];
            return (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{`${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || `#${e.id}`}</p>
                  <p className="text-xs text-muted-foreground">{e.employeeCode}</p>
                </div>
                {en
                  ? <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Enrolled · {en.samples}</span>
                  : <Link to={`/hr/employees/${e.id}`} className="shrink-0 text-xs font-medium text-primary hover:underline">Enrol face →</Link>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t px-4 py-2 text-xs text-muted-foreground sm:px-5">Enrol a face from the employee's profile (Face for kiosk check-in).</p>
    </section>
  );
}
