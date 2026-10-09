import { useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle2, MapPin, Users, Package, Tag, CalendarDays } from 'lucide-react';
import { TaskCard as TaskCardType } from '@/types/employeeTask';
import { humanizeDue, shortDue, statusMeta } from '../taskUtils';
import SwipeActions, { SwipeAction } from './SwipeActions';
import HoldTimer from './HoldTimer';

/**
 * One scannable task row for the field employee. Answers, at a glance: what · where ·
 * when it's due · current state · the one obvious next action. Everything technical
 * (ids, timestamps, raw enum values) is deliberately kept out — it lives in the detail view.
 * Tap the card body to open it; the primary button fires the next step without leaving the list.
 */
export default function TaskCard({
  task, onStart, onPause, onComplete, onPick, onExtend,
}: {
  task: TaskCardType;
  onStart: (id: number) => void;
  onPause: (id: number) => void;
  onComplete: (id: number) => void;
  onPick?: (id: number) => void; // pool mode — no on-card action; picking happens on the detail page
  onExtend?: (id: number) => void | Promise<unknown>; // extend the data-entry hold window
}) {
  const navigate = useNavigate();
  const mine = task.myAssignmentStatus;
  const open = () => navigate(`/employee/tasks/${task.id}`);
  const status = statusMeta(task.status);
  const due = humanizeDue(task.dueDate, task.status);
  const shared = (task.assignedEmployees?.length ?? 0) > 1;
  const place = task.location || [task.floor, task.room, task.itemName].filter(Boolean).join(' · ');

  // Quick swipe-left shortcuts mirror the on-card buttons (identical handlers, unchanged behaviour).
  const swipe: SwipeAction[] = [];
  if (mine === 'ASSIGNED' || mine === 'ACCEPTED') {
    swipe.push({ label: 'Start', icon: <Play className="h-4 w-4" />, className: 'bg-[#0A573B]', onClick: () => onStart(task.id) });
  } else if (mine === 'IN_PROGRESS') {
    swipe.push({ label: 'Pause', icon: <Pause className="h-4 w-4" />, className: 'bg-[#B27A12]', onClick: () => onPause(task.id) });
    swipe.push({ label: 'Complete', icon: <CheckCircle2 className="h-4 w-4" />, className: 'bg-[#0A573B]', onClick: () => onComplete(task.id) });
  } else if (mine === 'PAUSED') {
    swipe.push({ label: 'Resume', icon: <Play className="h-4 w-4" />, className: 'bg-[#0A573B]', onClick: () => onStart(task.id) });
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  // Compact pill buttons — sized to their label and right-aligned, so the list stays dense.
  const solid = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold active:scale-[0.97] disabled:opacity-50';

  // The one obvious next action, rendered as a real button (not hidden behind a swipe).
  const primary = (() => {
    if (mine === 'ASSIGNED' || mine === 'ACCEPTED') {
      return (
        <button onClick={(e) => { stop(e); onStart(task.id); }} className={`${solid} bg-[#0A573B] text-white`}>
          <Play className="h-4 w-4" /> Start Task
        </button>
      );
    }
    if (mine === 'IN_PROGRESS') {
      return (
        <div className="flex gap-2">
          <button onClick={(e) => { stop(e); onComplete(task.id); }} className={`${solid} bg-[#0A573B] text-white`}>
            <CheckCircle2 className="h-4 w-4" /> Complete
          </button>
          <button onClick={(e) => { stop(e); open(); }} className={`${solid} border border-[#0A573B]/25 bg-[#E7F2EC] text-[#0A573B]`}>
            <Play className="h-4 w-4" /> Continue
          </button>
        </div>
      );
    }
    if (mine === 'PAUSED') {
      return (
        <button onClick={(e) => { stop(e); onStart(task.id); }} className={`${solid} bg-[#0A573B] text-white`}>
          <Play className="h-4 w-4" /> Resume
        </button>
      );
    }
    return null; // completed / view-only — the status pill and a tap say enough
  })();

  const overdue = due.tone === 'overdue' && task.status !== 'COMPLETED';
  const soon = due.tone === 'soon' || mine === 'IN_PROGRESS' || task.status === 'COMPLETED';
  // Left edge + calendar tone: red overdue, green today / in hand, grey later.
  const accent = overdue ? 'border-l-[#D64541]' : soon ? 'border-l-[#0A7A4B]' : 'border-l-[#B9BFBB]';
  const dueCls = overdue ? 'text-[#C9302C]' : soon ? 'text-[#0A6B42]' : 'text-[#5B625E]';
  const pill = overdue ? 'bg-[#FDEBEA] text-[#C9302C]'
    : (soon ? 'bg-[#E7F4EC] text-[#0A6B42]' : 'bg-[#F0F1EF] text-[#5B625E]');
  const pillDot = overdue ? 'bg-[#D64541]' : soon ? 'bg-[#1E9E5E]' : 'bg-[#8A918C]';

  // What the customer asked for — first category / product, falling back to the work item.
  const first = (v?: string | null) => (v || '').split(',').map((x) => x.trim()).filter(Boolean)[0];
  const product = first(task.requirementCategory) || task.itemName || null;
  const variant = first(task.requirementProduct) || task.room || null;
  const title = task.customer || task.taskName;

  return (
    <SwipeActions actions={swipe} onTap={open}>
      <div className={`rounded-2xl border border-l-4 border-[#ECEAE5] ${accent} bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.05)] active:bg-[#F7F8F6]`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold leading-snug text-[#111817]">{title}</p>
            {task.customer && <p className="truncate text-[11px] font-medium text-[#8A918C]">{task.taskName}</p>}
          </div>
          <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${pillDot}`} /> {status.label}
          </span>
        </div>

        {place && (
          <p className="mt-1.5 flex items-center gap-2 truncate text-[13px] text-[#6B726E]">
            <MapPin className="h-4 w-4 shrink-0 text-[#7A817C]" /> {place}
          </p>
        )}

        {(product || variant) && (
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[13px] text-[#2F3632]">
            {product && (
              <span className="flex min-w-0 items-center gap-2 truncate">
                <Package className="h-4 w-4 shrink-0 text-[#2563A8]" /> <span className="truncate">{product}</span>
              </span>
            )}
            {product && variant && <span className="h-4 w-px shrink-0 bg-[#DDE2DE]" />}
            {variant && (
              <span className="flex min-w-0 items-center gap-2 truncate">
                <Tag className="h-4 w-4 shrink-0 text-[#C58A1B]" /> <span className="truncate">{variant}</span>
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          {!onPick && primary}
          {shared && (
            <span className="flex items-center gap-1 text-[11px] text-[#7A817C]">
              <Users className="h-3.5 w-3.5" /> {task.assignedEmployees!.length}
            </span>
          )}
          <span className={`ml-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold ${dueCls}`}>
            <CalendarDays className="h-3.5 w-3.5" /> {shortDue(task.dueDate, task.status)}
          </span>
        </div>

        {task.holdExpiresAt && (
          <div className="mt-2">
            <HoldTimer expiresAt={task.holdExpiresAt}
              onExtend={onExtend ? () => onExtend(task.id) : undefined} />
          </div>
        )}

        {task.progressPercent != null && task.progressPercent > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDEFEC]">
              <div className="h-full rounded-full bg-[#0A573B]" style={{ width: `${task.progressPercent}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-[#0A573B]">{task.progressPercent}%</span>
          </div>
        )}
      </div>
    </SwipeActions>
  );
}
