import { useEffect, useState } from 'react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { Timesheet as TimesheetData, TimesheetPeriod } from '@/types/employeePortal';
import { PortalHeader, EmptyState, inr } from './_shared';
import { useT, dateLocale } from '@/i18n';

const PERIODS: { labelKey: string; value: TimesheetPeriod }[] = [
  { labelKey: 'pw.ts.today', value: 'DAILY' },
  { labelKey: 'pw.ts.thisWeek', value: 'WEEKLY' },
  { labelKey: 'pw.ts.thisMonth', value: 'MONTHLY' },
  { labelKey: 'pw.ts.lastMonth', value: 'LAST_MONTH' },
  { labelKey: 'pw.ts.custom', value: 'CUSTOM' },
];

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const fmtDate = (s: string, loc: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDay = (s: string, loc: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' });
const n = (v: number | null | undefined) => (v == null ? 0 : Number(v));

export default function Timesheet() {
  const { t, lang } = useT();
  const loc = dateLocale(lang);
  const today = iso(new Date());
  const [period, setPeriod] = useState<TimesheetPeriod>('WEEKLY');
  const [from, setFrom] = useState(iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeInvalid = period === 'CUSTOM' && (!from || !to || from > to);

  useEffect(() => {
    if (rangeInvalid) { setData(null); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    employeePortalApi
      .timesheet(period, period === 'CUSTOM' ? { from, to } : undefined)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => {
        if (!alive) return;
        setData(null);
        setError(e?.response?.data?.message ?? t('pw.ts.loadFailed'));
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period, from, to, rangeInvalid]);

  const hasRate = data?.hourlyRate != null;

  return (
    <div className="flex flex-col">
      <PortalHeader title={t('pw.ts.title')} />

      {/* Period picker */}
      <div className="flex flex-wrap gap-2 p-3">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${period === p.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {period === 'CUSTOM' && (
        <div className="mx-3 mb-3 rounded-xl border bg-card p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t('pw.from')}
              <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              {t('pw.to')}
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>
          </div>
          {rangeInvalid && <p className="mt-2 text-xs text-destructive">{t('pw.ts.rangeInvalid')}</p>}
        </div>
      )}

      {error && <p className="mx-3 mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {/* Headline earnings */}
      <div className="mx-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('pw.ts.earned')}</p>
            <p className={`text-2xl font-bold leading-tight text-emerald-600 ${loading ? 'opacity-50' : ''}`}>{inr(data?.totalEarnings)}</p>
            {data && <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(data.from, loc)} → {fmtDate(data.to, loc)}</p>}
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <p><span className="font-semibold text-foreground">{data?.daysWorked ?? '–'}</span> {t('pw.ts.daysWorked')}</p>
            <p>{t('pw.ts.avgPerDay', { amount: inr(data?.avgDailyEarnings) })}</p>
            <p>{t('pw.ts.avgHours', { h: data?.avgDailyHours ?? '–' })}</p>
          </div>
        </div>

        {/* Calculation breakdown */}
        {data && (
          <div className="mt-3 space-y-1.5 border-t pt-3 text-xs">
            <Row label={t('pw.ts.regular', { h: data.regularHours })} value={inr(data.regularEarnings)}
              hint={hasRate ? `${t('pw.ts.regularHint', { rate: inr(data.hourlyRate) })}${n(data.weekendHours) > 0 ? t('pw.ts.weekendNote') : ''}` : undefined} />
            <Row label={t('pw.ts.overtime', { h: data.totalOvertime })} value={inr(data.overtimeEarnings)}
              hint={hasRate ? t('pw.ts.overtimeHint', { rate: inr(data.overtimeRate), std: data.standardDailyHours }) : undefined} />
            {n(data.weekendHours) > 0 && (
              <Row label={t('pw.ts.inclWeekend', { h: data.weekendHours })} value={inr(data.weekendEarnings)}
                hint={hasRate ? t('pw.ts.regularHint', { rate: inr(data.weekendRate) }) : undefined} muted />
            )}
            <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
              <span>{t('pw.ts.totalHours', { h: data.totalHours })}</span>
              <span className="text-emerald-600">{inr(data.totalEarnings)}</span>
            </div>
          </div>
        )}

        {data && !hasRate && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            {t('pw.ts.noRate')}
          </p>
        )}
        {data && n(data.pendingHours) > 0 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            {t('pw.ts.pendingNote', { h: data.pendingHours, amount: inr(data.pendingEarningsEstimate) })}
          </p>
        )}
      </div>

      {/* Day-by-day */}
      <div className="mx-3 my-3 overflow-hidden rounded-xl border bg-card shadow-sm">
        {!data || data.lines.length === 0 ? (
          <EmptyState message={loading ? t('pw.loading') : t('pw.ts.noTime')} />
        ) : (
          <div className="divide-y">
            {data.lines.map((l) => (
              <div key={l.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {fmtDay(l.date, loc)}
                    {l.weekend && <span className="ml-1.5 rounded bg-sky-50 px-1 py-0.5 text-[10px] font-medium text-sky-700">{t('pw.ts.weekend')}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.checkIn?.slice(0, 5) ?? '—'}{l.checkOut ? `–${l.checkOut.slice(0, 5)}` : ''}
                    {l.sessions > 1 ? t('pw.ts.sessions', { n: l.sessions }) : ''}
                    {l.breakMinutes > 0 ? t('pw.ts.breakMin', { m: l.breakMinutes }) : ''}
                  </p>
                  {n(l.pendingHours) > 0 && <p className="text-[11px] text-amber-700">{t('pw.ts.pendingDay', { h: l.pendingHours })}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">{inr(l.earnings)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.hours}h{l.overtime > 0 ? t('pw.ts.otShort', { h: l.overtime }) : ''}
                  </p>
                  {l.overtime > 0 && hasRate && (
                    <p className="text-[10px] text-muted-foreground">{inr(l.regularEarnings)} + {inr(l.overtimeEarnings)} OT</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, hint, muted }: { label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${muted ? 'pl-3 text-muted-foreground' : ''}`}>
      <div className="min-w-0">
        <p>{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}
