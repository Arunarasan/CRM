import { useCallback, useEffect, useState } from 'react';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { TimeLogSummary } from '@/types/employeeTask';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Compact per-task work timer (spec §21): START → PAUSE → RESUME → STOP, writing task_time_logs.
 * Accrued minutes come from the server; on stop the session becomes a DRAFT record the employee can
 * later submit for payroll approval. Disabled once the task is locked or the viewer isn't a member.
 */
export default function TimeTracker({ taskId, disabled }: { taskId: number; disabled?: boolean }) {
  const [log, setLog] = useState<TimeLogSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadOpen = useCallback(() => {
    // Re-hydrate an in-flight timer for this task from today's timesheet.
    employeeTaskApi.timesheet(today(), today())
      .then((ts) => setLog(ts.logs.find((l) => l.taskId === taskId && !l.completedAt) ?? null))
      .catch(() => {});
  }, [taskId]);

  useEffect(() => { loadOpen(); }, [loadOpen]);

  const run = (fn: () => Promise<TimeLogSummary>) => {
    setBusy(true); setError('');
    fn().then(setLog).catch((e: any) => setError(e?.message || 'Timer error')).finally(() => setBusy(false));
  };

  const running = log && !log.completedAt && log.running;
  const paused = log && !log.completedAt && !log.running;
  const mins = log?.workingTimeMinutes ?? 0;
  const label = `${Math.floor(mins / 60)}h ${mins % 60}m`;

  if (disabled) return null;

  const btn = 'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-50';
  return (
    <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[#1A211E]"><Clock className="h-4 w-4 text-[#0A573B]" /> Work timer</h3>
        <span className="text-[15px] font-bold tabular-nums text-[#0A573B]">{label}</span>
      </div>
      {error && <p className="mb-2 text-[11px] text-[#B94B45]">{error}</p>}
      <div className="flex gap-2">
        {!running && !paused && (
          <button disabled={busy} onClick={() => run(() => employeeTaskApi.timeStart(taskId))}
            className={`${btn} bg-[#0A573B]`}>
            <Play className="h-4 w-4" /> Start
          </button>
        )}
        {running && (
          <>
            <button disabled={busy} onClick={() => run(() => employeeTaskApi.timePause(taskId))}
              className={`${btn} bg-[#BC8748]`}>
              <Pause className="h-4 w-4" /> Pause
            </button>
            <button disabled={busy} onClick={() => run(() => employeeTaskApi.timeStop(taskId))}
              className={`${btn} bg-[#4B524E]`}>
              <Square className="h-4 w-4" /> Stop
            </button>
          </>
        )}
        {paused && (
          <>
            <button disabled={busy} onClick={() => run(() => employeeTaskApi.timeResume(taskId))}
              className={`${btn} bg-[#0A573B]`}>
              <Play className="h-4 w-4" /> Resume
            </button>
            <button disabled={busy} onClick={() => run(() => employeeTaskApi.timeStop(taskId))}
              className={`${btn} bg-[#4B524E]`}>
              <Square className="h-4 w-4" /> Stop
            </button>
          </>
        )}
      </div>
      {paused && <p className="mt-2 text-[11px] font-medium text-[#9B6B32]">Paused — resume when you're back on it.</p>}
    </div>
  );
}
