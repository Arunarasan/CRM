import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { AttendanceEntry } from '@/types/employeePortal';
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
    </div>
  );
}
