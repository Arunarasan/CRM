import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Coffee, Play, Loader2 } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { TimeStatus } from '@/types/employeePortal';
import { inr } from './_shared';

/**
 * Self-service time-clock. Shows live running hours/earnings while checked in (ticks locally,
 * re-syncs with the server on each action) and exposes Clock In / Break / Clock Out. Earnings and
 * hourly rate come from the server — the client only displays them.
 */
export default function ClockWidget({ onChange }: { onChange?: () => void }) {
  const [status, setStatus] = useState<TimeStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [, forceTick] = useState(0);
  const tickRef = useRef<number | null>(null);

  const load = useCallback(() => {
    employeePortalApi.timeStatus().then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Local 1s tick so the running clock feels live between server syncs.
  useEffect(() => {
    if (status?.clockedIn && !status.onBreak) {
      tickRef.current = window.setInterval(() => forceTick((n) => n + 1), 1000);
      return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    }
  }, [status?.clockedIn, status?.onBreak]);

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setError(''); setBusy(label);
    try { await fn(); load(); onChange?.(); }
    catch (e: any) { setError(e?.message || 'Action failed'); }
    finally { setBusy(null); }
  };

  const clockedIn = status?.clockedIn ?? false;
  const onBreak = status?.onBreak ?? false;
  const done = !!status?.checkOutTime;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {done ? "Today's shift" : onBreak ? 'On break' : clockedIn ? 'Clocked in' : 'Not clocked in'}
          </p>
          <p className="text-2xl font-bold leading-tight">{inr(status?.todayEarnings)}</p>
          <p className="text-[11px] text-muted-foreground">
            {status ? `${status.todayHours}h today` : '—'}
            {status && status.todayOvertime > 0 ? ` · ${status.todayOvertime}h OT` : ''}
            {status?.hourlyRate != null ? ` · ${inr(status.hourlyRate)}/hr` : ''}
          </p>
        </div>
        <span className={`h-3 w-3 rounded-full ${onBreak ? 'bg-amber-400' : clockedIn ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
      </div>

      {error && <p className="mt-2 rounded-md bg-destructive/15 p-2 text-xs text-destructive">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {!clockedIn && !done && (
          <button onClick={() => act('in', () => employeePortalApi.clockIn())} disabled={!!busy}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
            {busy === 'in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Clock In
          </button>
        )}
        {clockedIn && !onBreak && (
          <button onClick={() => act('break', () => employeePortalApi.startBreak())} disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 active:scale-[0.99] disabled:opacity-60">
            {busy === 'break' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coffee className="h-4 w-4" />} Break
          </button>
        )}
        {clockedIn && onBreak && (
          <button onClick={() => act('resume', () => employeePortalApi.endBreak())} disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 active:scale-[0.99] disabled:opacity-60">
            {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} End Break
          </button>
        )}
        {clockedIn && (
          <button onClick={() => act('out', () => employeePortalApi.clockOut())} disabled={!!busy}
            className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 py-2.5 text-sm font-semibold text-white active:scale-[0.99] disabled:opacity-60">
            {busy === 'out' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Clock Out
          </button>
        )}
        {done && (
          <div className="col-span-2 rounded-lg bg-muted/50 py-2.5 text-center text-sm font-medium text-muted-foreground">
            Shift complete · {status?.checkInTime}–{status?.checkOutTime}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-center">
        <div><p className="text-sm font-bold">{inr(status?.weekEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This week</p></div>
        <div><p className="text-sm font-bold">{inr(status?.monthEarnings)}</p><p className="text-[10px] uppercase text-muted-foreground">This month</p></div>
      </div>
    </div>
  );
}
