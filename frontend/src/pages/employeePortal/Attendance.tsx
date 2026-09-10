import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Loader2, Plus } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { AttendanceEntry, AttendanceCorrection } from '@/types/employeePortal';
import { PortalHeader, StatusPill } from './_shared';
import ClockWidget from './ClockWidget';

const DAY_TONE: Record<string, string> = {
  PRESENT: 'bg-emerald-500 text-white',
  HALF_DAY: 'bg-amber-400 text-white',
  LEAVE: 'bg-emerald-500 text-white',
  ABSENT: 'bg-red-500 text-white',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Attendance() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  useEffect(() => {
    employeePortalApi.attendance({ from: iso(monthStart), to: iso(monthEnd) }).then(setEntries).catch(() => setEntries([]));
  }, [monthStart, monthEnd]);

  const byDate = useMemo(() => {
    const m: Record<string, AttendanceEntry> = {};
    entries.forEach((e) => { m[e.date] = e; });
    return m;
  }, [entries]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, HALF_DAY: 0, LEAVE: 0, ABSENT: 0 } as Record<string, number>;
    entries.forEach((e) => { if (c[e.status] != null) c[e.status]++; });
    return c;
  }, [entries]);

  const firstWeekday = monthStart.getDay(); // 0 Sun
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)),
  ];

  const monthLabel = cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const reload = () => employeePortalApi.attendance({ from: iso(monthStart), to: iso(monthEnd) }).then(setEntries).catch(() => {});

  return (
    <div className="flex flex-col">
      <PortalHeader title="Attendance" />

      <div className="p-3 pb-0"><ClockWidget onChange={reload} /></div>

      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><ChevronLeft className="h-5 w-5" /></button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-full active:bg-accent"><ChevronRight className="h-5 w-5" /></button>
      </div>

      <div className="mx-3 grid grid-cols-4 gap-2 pb-3">
        {(['PRESENT', 'HALF_DAY', 'LEAVE', 'ABSENT'] as const).map((s) => (
          <div key={s} className="rounded-lg border bg-card p-2 text-center shadow-sm">
            <p className="text-lg font-bold leading-none">{counts[s]}</p>
            <p className="mt-1 text-[10px] uppercase text-muted-foreground">{s.replace('_', ' ')}</p>
          </div>
        ))}
      </div>

      <div className="mx-3 rounded-xl border bg-card p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[10px] font-medium text-muted-foreground">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const e = byDate[iso(d)];
            const tone = e ? DAY_TONE[e.status] ?? 'bg-slate-200' : '';
            return (
              <div key={i} className={`flex aspect-square items-center justify-center rounded-md text-xs font-medium ${tone || 'text-foreground'}`}>
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      <h3 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase text-muted-foreground">History</h3>
      <div className="mx-3 mb-6 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No records this month.</p>
        ) : (
          [...entries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{e.date}</p>
                <p className="text-xs text-muted-foreground">
                  {e.checkInTime ? `In ${e.checkInTime}` : '—'}{e.checkOutTime ? ` · Out ${e.checkOutTime}` : ''}
                </p>
              </div>
              <StatusPill status={e.status} />
            </div>
          ))
        )}
      </div>

      <CorrectionRequests />
    </div>
  );
}

/**
 * Ask an admin to fix a day's clock times — a late/early clock-in, a missed clock-out, or a whole day
 * worked without punching. Approved corrections update the record and the paid hours.
 */
function CorrectionRequests() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AttendanceCorrection[]>([]);
  const [form, setForm] = useState({ date: '', checkIn: '', checkOut: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () => employeePortalApi.myCorrections().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setMsg(''); setErr('');
    if (!form.date) { setErr('Pick the date to correct.'); return; }
    if (!form.checkIn && !form.checkOut) { setErr('Enter a corrected clock-in and/or clock-out time.'); return; }
    setBusy(true);
    try {
      await employeePortalApi.requestCorrection({
        date: form.date,
        checkIn: form.checkIn || undefined,
        checkOut: form.checkOut || undefined,
        reason: form.reason || undefined,
      });
      setMsg('Request sent for admin approval.');
      setForm({ date: '', checkIn: '', checkOut: '', reason: '' });
      setOpen(false);
      load();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  const tone: Record<string, string> = {
    PENDING: 'text-amber-600', APPROVED: 'text-emerald-600', REJECTED: 'text-red-600',
  };
  const input = 'mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm';

  return (
    <div className="mx-3 mb-8">
      <div className="flex items-center justify-between px-1 pb-1">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> Time corrections
        </h3>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Plus className="h-3.5 w-3.5" /> Request
          </button>
        )}
      </div>

      {open && (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] text-muted-foreground">
            Came in but clocked in late, forgot to clock out, or worked a day without punching? Ask an admin to fix it.
          </p>
          <label className="block text-xs font-medium text-muted-foreground">Date
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">Clock-in
              <input type="time" value={form.checkIn} onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))} className={input} />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">Clock-out
              <input type="time" value={form.checkOut} onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))} className={input} />
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">Reason
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. forgot to clock out" className={input} />
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="mt-1 flex gap-2">
            <button onClick={() => { setOpen(false); setErr(''); }} className="flex-1 rounded-lg border py-2 text-sm font-semibold">Cancel</button>
            <button onClick={submit} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send request
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mb-2 px-1 text-xs text-emerald-600">{msg}</p>}

      {rows.length > 0 && (
        <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.date}</p>
                <p className="text-xs text-muted-foreground">
                  {r.requestedCheckIn ? `In ${r.requestedCheckIn.slice(0, 5)}` : ''}
                  {r.requestedCheckOut ? `${r.requestedCheckIn ? ' · ' : ''}Out ${r.requestedCheckOut.slice(0, 5)}` : ''}
                  {r.reason ? ` — ${r.reason}` : ''}
                </p>
                {r.status === 'REJECTED' && r.reviewRemarks && (
                  <p className="text-[11px] text-red-600">Reason: {r.reviewRemarks}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-semibold ${tone[r.status] ?? 'text-muted-foreground'}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
