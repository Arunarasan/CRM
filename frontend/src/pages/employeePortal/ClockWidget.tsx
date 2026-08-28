import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Coffee, Play, Loader2, TrendingUp, ArrowRight } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { TimeStatus } from '@/types/employeePortal';
import { inr } from './_shared';

/**
 * Self-service time-clock — the money-forward hero of the employee home screen.
 *
 * Leads with today's live earnings and a big HH:MM:SS worked-time timer that ticks every second
 * while the employee is clocked in and not on break. Earnings, hourly rate and the daily target
 * come from the server — the client only projects the running portion forward from the last sync
 * (re-syncing on every clock action) so the numbers "boost the mind" without drifting from payroll.
 */
export default function ClockWidget({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<TimeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);
  // Wall-clock instant of the last server sync — the running timer/earnings project forward from here.
  const syncAtRef = useRef<number>(Date.now());

  const load = useCallback(() => {
    employeePortalApi.timeStatus().then((s) => { syncAtRef.current = Date.now(); setStatus(s); }).catch(() => setStatus(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clockedIn = status?.clockedIn ?? false;
  const onBreak = status?.onBreak ?? false;
  const running = clockedIn && !onBreak;

  // Local 1s tick so the running clock + earnings feel live between server syncs.
  useEffect(() => {
    if (running) {
      tickRef.current = window.setInterval(() => forceTick((n) => n + 1), 1000);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [running]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setError(''); setBusy(label);
    try { await fn(); load(); onChange?.(); }
    catch (e: any) { setError(e?.message || 'Action failed'); }
    finally { setBusy(null); }
  };

  const sessions = status?.sessions ?? [];
  const sessionCount = status?.sessionsToday ?? 0;

  // Seconds worked so far today = server total (all sessions) + time elapsed since the last sync
  // while running. todayHours already sums closed + open sessions up to the sync instant.
  const elapsed = running ? Math.max(0, Math.floor((Date.now() - syncAtRef.current) / 1000)) : 0;
  const liveSeconds = Math.round((status?.todayHours ?? 0) * 3600) + elapsed;
  const rate = status?.hourlyRate ?? 0;
  const liveEarnings = (status?.todayEarnings ?? 0) + (running ? (elapsed / 3600) * rate : 0);

  const target = status?.dailyTargetEarnings ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((liveEarnings / target) * 100)) : 0;
  const remaining = Math.max(0, target - liveEarnings);

  return (
    <div className="overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white shadow-md">
      {/* Money hero */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100/90">You've earned today</p>
            <p className="mt-0.5 text-4xl font-extrabold leading-none tabular-nums drop-shadow-sm">{inr(liveEarnings)}</p>
          </div>
          <span className={`mt-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            onBreak ? 'bg-amber-400/25 text-amber-50' : clockedIn ? 'bg-white/20 text-white' : 'bg-white/15 text-emerald-50'
          }`}>
            <span className={`h-2 w-2 rounded-full ${onBreak ? 'bg-amber-300' : clockedIn ? 'animate-pulse bg-emerald-200' : 'bg-emerald-100/70'}`} />
            {onBreak ? 'On break' : clockedIn ? 'Working' : sessionCount > 0 ? 'Clocked out' : 'Not started'}
          </span>
        </div>

        {/* Big live worked-time timer */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">{fmtHMS(liveSeconds)}</span>
          <span className="text-xs text-emerald-100/80">worked{status && status.todayOvertime > 0 ? ` · ${status.todayOvertime}h OT` : ''}</span>
        </div>

        {/* Progress toward the day's target — the motivational bar */}
        {target > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-50/90">
              <TrendingUp className="h-3 w-3" />
              {remaining > 0
                ? <>Earn <b className="text-white">{inr(remaining)}</b> more to hit today's <b className="text-white">{inr(target)}</b> target</>
                : <>🎉 You smashed today's <b className="text-white">{inr(target)}</b> target!</>}
            </p>
          </div>
        )}

        {/* Login / Logout times */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100/80">Log in time</p>
            <p className="text-sm font-bold tabular-nums">{fmtClock(status?.checkInTime)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-emerald-100/80">Log out time</p>
            <p className="text-sm font-bold tabular-nums">{clockedIn ? '—' : fmtClock(status?.checkOutTime)}</p>
          </div>
        </div>

        {error && <p className="mt-2 rounded-md bg-black/25 p-2 text-xs text-amber-100">{error}</p>}

        {/* Actions */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {!clockedIn && (
            <button onClick={() => act('in', () => employeePortalApi.clockIn())} disabled={!!busy}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 shadow-sm active:scale-[0.99] disabled:opacity-60">
              {busy === 'in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} {sessionCount > 0 ? 'Clock In Again' : 'Clock In'}
            </button>
          )}
          {clockedIn && !onBreak && (
            <button onClick={() => act('break', () => employeePortalApi.startBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-amber-950 active:scale-[0.99] disabled:opacity-60">
              {busy === 'break' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />} Take Break
            </button>
          )}
          {clockedIn && onBreak && (
            <button onClick={() => act('resume', () => employeePortalApi.endBreak())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-emerald-700 active:scale-[0.99] disabled:opacity-60">
              {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} End Break
            </button>
          )}
          {clockedIn && (
            <button onClick={() => act('out', () => employeePortalApi.clockOut())} disabled={!!busy}
              className="flex items-center justify-center gap-2 rounded-xl bg-black/30 py-3 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-60">
              {busy === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock Out
            </button>
          )}
        </div>
      </div>

      {/* Earnings footer + today's sessions — on a light panel for readability */}
      <div className="rounded-t-2xl bg-card p-3 text-foreground">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-sm font-bold tabular-nums">{inr(status?.weekEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This week</p></div>
          <div><p className="text-sm font-bold tabular-nums">{inr(status?.monthEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This month</p></div>
          <div><p className="text-sm font-bold tabular-nums">{rate ? `${inr(rate)}` : '—'}</p><p className="text-[10px] uppercase text-muted-foreground">Per hour</p></div>
        </div>

        {sessions.length > 0 && (
          <div className="mt-3 border-t pt-2">
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Today's sessions ({sessionCount})
            </p>
            <div className="space-y-1">
              {sessions.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5 font-medium tabular-nums">
                    {fmtClock(s.checkInTime)}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {s.running
                      ? <span className={s.onBreak ? 'text-amber-600' : 'text-emerald-600'}>{s.onBreak ? 'on break' : 'now'}</span>
                      : fmtClock(s.checkOutTime)}
                  </span>
                  {s.breakMinutes > 0 && <span className="text-[11px] text-muted-foreground">{s.breakMinutes}m break</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Total seconds → HH:MM:SS (zero-padded). */
function fmtHMS(total: number): string {
  const s = Math.max(0, total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Server time string ("HH:mm:ss") → "HH:mm" for display; null → em-dash. */
function fmtClock(t: string | null | undefined): string {
  if (!t) return '—';
  return t.length >= 5 ? t.slice(0, 5) : t;
}
