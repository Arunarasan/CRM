import { useEffect, useState } from 'react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Timesheet as TimesheetData } from '@/types/employeePortal';
import { PortalHeader, EmptyState, inr } from './_shared';

const PERIODS: { label: string; value: 'DAILY' | 'WEEKLY' | 'MONTHLY' }[] = [
  { label: 'Today', value: 'DAILY' },
  { label: 'This Week', value: 'WEEKLY' },
  { label: 'This Month', value: 'MONTHLY' },
];

export default function Timesheet() {
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [data, setData] = useState<TimesheetData | null>(null);

  useEffect(() => { employeePortalApi.timesheet(period).then(setData).catch(() => setData(null)); }, [period]);

  return (
    <div className="flex flex-col">
      <PortalHeader title="Timesheet" />

      <div className="flex gap-2 p-3">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium ${period === p.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Totals */}
      <div className="mx-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold leading-none">{data?.totalHours ?? '–'}</p>
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">Hours</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold leading-none">{data?.totalOvertime ?? '–'}</p>
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">OT hrs</p>
        </div>
        <div className="rounded-xl border bg-card p-3 text-center shadow-sm">
          <p className="text-lg font-bold leading-none text-emerald-600">{inr(data?.totalEarnings)}</p>
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">Earned</p>
        </div>
      </div>

      {data?.hourlyRate != null && (
        <p className="px-4 pt-2 text-[11px] text-muted-foreground">Rate {inr(data.hourlyRate)}/hr · {data.from} → {data.to}</p>
      )}

      <div className="mx-3 my-3 overflow-hidden rounded-xl border bg-card shadow-sm">
        {!data || data.lines.length === 0 ? (
          <EmptyState message="No time recorded for this period." />
        ) : (
          <div className="divide-y">
            {data.lines.map((l) => (
              <div key={l.date} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{l.date}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.checkIn ?? '—'}{l.checkOut ? `–${l.checkOut}` : ''}
                    {l.breakMinutes > 0 ? ` · ${l.breakMinutes}m break` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{inr(l.earnings)}</p>
                  <p className="text-[11px] text-muted-foreground">{l.hours}h{l.overtime > 0 ? ` · ${l.overtime} OT` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
