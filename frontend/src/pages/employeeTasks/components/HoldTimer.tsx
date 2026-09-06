import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

/**
 * Live countdown for a held data-entry task in the employee portal: ticks down to the moment it is
 * auto-released back to the board if the assignee hasn't started it. In the last two minutes it
 * becomes a clear alert with a one-tap "Extend time" — for a worker who's still filling the form
 * and needs longer. Shared by the task list card and the task detail page.
 */
export default function HoldTimer({
  expiresAt, onExtend,
}: {
  expiresAt: string;
  onExtend?: () => void | Promise<unknown>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const msLeft = new Date(expiresAt).getTime() - now;
  const expired = msLeft <= 0;
  const totalSec = Math.max(0, Math.floor(msLeft / 1000));
  const label = `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, '0')}`;
  const urgent = expired || msLeft <= 120_000; // last 2 minutes

  const extend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onExtend || extending) return;
    setExtending(true);
    try { await onExtend(); } finally { setExtending(false); }
  };

  // Calm state: a small pill.
  if (!urgent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF3E2] px-2 py-0.5 text-[11px] font-semibold text-[#9A6B10]">
        <Timer className="h-3 w-3" /> {label} to start
      </span>
    );
  }
  // Last two minutes (or lapsed): a clear alert, with Extend if the viewer can grant more time.
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#F3C7C2] bg-[#FBE9E7] px-2.5 py-2">
      <Timer className="h-4 w-4 shrink-0 text-[#B94B45]" />
      <span className="flex-1 text-[12px] font-semibold leading-tight text-[#B94B45]">
        {expired ? 'Releasing to the board…' : `Time almost up — ${label} left. Still working?`}
      </span>
      {onExtend && !expired && (
        <button onClick={extend} disabled={extending}
          className="shrink-0 rounded-lg bg-[#0A573B] px-2.5 py-1 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50">
          {extending ? 'Extending…' : 'Extend time'}
        </button>
      )}
    </div>
  );
}
