import { useEffect, useState } from 'react';
import { CalendarDays, Fingerprint, Loader2 } from 'lucide-react';
import { attendanceDeviceApi, fmtClock, fmtMinutes, statusMeta, ATTENDANCE_STATUS, type History, type HistoryDay } from '@/api/attendanceDeviceApi';
import { PeriodPicker, MONTHS } from '@/pages/workforce/hrUi';

/**
 * Employee → Attendance: month summary + calendar (Mon-first). Each day shows its status letter;
 * selecting a day shows its times. Late days use the present letter in amber.
 */
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEGEND = ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE', 'WEEK_OFF'] as const;

export default function EmployeeAttendanceCalendar({ employeeId }: { employeeId: number }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<HistoryDay | null>(null);

  useEffect(() => {
    setLoading(true);
    setPicked(null);
    attendanceDeviceApi.history(employeeId, year, month).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [employeeId, year, month]);

  const s = data?.summary;
  const lead = data ? (new Date(`${data.days[0].date}T00:00:00`).getDay() + 6) % 7 : 0; // Monday-first offset
  const t = new Date();
  const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-800"><CalendarDays className="h-4 w-4 text-primary" /> {MONTHS[month - 1]} {year}</h3>
          <p className="text-xs text-slate-500">{data?.shift ? `${data.shift.name} · ${fmtClock(data.shift.startTime)}–${fmtClock(data.shift.endTime)}` : 'No shift assigned'}</p>
        </div>
        <PeriodPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      <div className="grid grid-cols-3 gap-px border-b bg-slate-100 sm:grid-cols-7">
        {[
          ['Working days', s?.workingDays],
          ['Present', s?.present],
          ['Absent', s?.absent],
          ['Leave', s?.leave],
          ['Half day', s?.halfDay],
          ['Late', s?.late],
          ['Overtime', s ? fmtMinutes(s.overtimeMinutes) : undefined],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white p-3 text-center">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value ?? '—'}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !data ? (
        <div className="p-10 text-center text-sm text-slate-500">Could not load attendance.</div>
      ) : (
        <div className="p-4">
          <div className="mx-auto grid max-w-2xl grid-cols-7 gap-1.5 text-center">
            {WEEK.map((d) => <div key={d} className="pb-1 text-[11px] font-semibold uppercase text-slate-400">{d}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={`pad${i}`} />)}
            {data.days.map((d) => {
              const m = statusMeta(d.status);
              const future = d.date > todayIso;
              const sel = picked?.date === d.date;
              return (
                <button key={d.date} type="button" onClick={() => setPicked(d)} disabled={future}
                  title={`${d.date}: ${m.label}`}
                  className={`relative flex h-12 flex-col sm:h-14 items-center justify-center rounded-lg border text-xs transition ${future ? 'border-slate-100 bg-white text-slate-300' : m.cell} ${sel ? 'ring-2 ring-primary' : ''} ${d.date === todayIso ? 'font-bold' : ''}`}>
                  <span className="absolute left-1 top-0.5 text-[10px] opacity-60">{Number(d.date.slice(8))}</span>
                  <span className="text-sm font-semibold">{future ? '' : m.short}</span>
                  {d.biometricVerified && <Fingerprint className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 opacity-60" />}
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-3 flex max-w-2xl flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {LEGEND.map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`inline-grid h-4 w-5 place-items-center rounded border text-[9px] font-bold ${ATTENDANCE_STATUS[k].cell}`}>{ATTENDANCE_STATUS[k].short}</span>
                {ATTENDANCE_STATUS[k].label}
              </span>
            ))}
          </div>

          {picked && (
            <div className="mx-auto mt-4 max-w-2xl rounded-xl border bg-slate-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <b>{new Date(`${picked.date}T00:00:00`).toDateString()}</b>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta(picked.status).pill}`}>{statusMeta(picked.status).label}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 tabular-nums text-slate-700 sm:grid-cols-5">
                <span>In <b>{fmtClock(picked.checkIn)}</b></span>
                <span>Out <b>{fmtClock(picked.checkOut)}</b></span>
                <span>Worked <b>{fmtMinutes(picked.workingMinutes)}</b></span>
                <span>Late <b>{picked.lateMinutes ? `${picked.lateMinutes}m` : '—'}</b></span>
                <span>OT <b>{picked.overtimeMinutes ? fmtMinutes(picked.overtimeMinutes) : '—'}</b></span>
              </div>
              {(picked.method || picked.remarks) && (
                <p className="mt-1 text-xs text-slate-500">{[picked.method?.replace(/_/g, ' ').toLowerCase(), picked.remarks].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
