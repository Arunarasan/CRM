import { WorkEvent, EVENT_LABELS } from '@/types/projectWork';
import { CARD, Thumbs, fmtWhen } from './workUi';

/** Every recorded change on a project's work board, newest first — shared by the project page and the task. */
export default function WorkHistoryList({ events }: { events: WorkEvent[] | null }) {
  if (!events) return <p className="p-4 text-center text-[13px] text-[#9A9E96]">Loading…</p>;
  if (!events.length) return <p className={`${CARD} p-4 text-[13px] text-[#8A8F86]`}>Nothing recorded yet.</p>;
  return (
    <ol className={`${CARD} divide-y divide-[#F1ECE2]`}>
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-[#22271F]">
              <span className="font-semibold">{e.itemName || e.category || 'Project'}</span>
              {e.stepType && e.stepType !== 'INSTALL' && <span className="text-[#6B7169]"> · {e.stepLabel}</span>}
              {' — '}{EVENT_LABELS[e.action] || e.action}{e.percent != null ? ` (${e.percent}%)` : ''}
            </p>
            {e.note && <p className="text-[12.5px] text-[#5E655D]">{e.note}</p>}
            <p className="text-[11px] text-[#9A9E96]">{e.actorName} · {fmtWhen(e.createdAt)}</p>
          </div>
          {e.photoUrl && <Thumbs urls={[e.photoUrl]} size="h-12 w-12" />}
        </li>
      ))}
    </ol>
  );
}
