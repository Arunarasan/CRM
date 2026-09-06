import { useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle2, MapPin, Hand, Users, ChevronRight } from 'lucide-react';
import { TaskCard as TaskCardType } from '@/types/employeeTask';
import { humanizeDue, dueToneClass, priorityMeta, statusMeta } from '../taskUtils';
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
  onPick?: (id: number) => void; // pool mode — renders a prominent "Start Task" (pick) button
  onExtend?: (id: number) => void | Promise<unknown>; // extend the data-entry hold window
}) {
  const navigate = useNavigate();
  const mine = task.myAssignmentStatus;
  const open = () => navigate(`/employee/tasks/${task.id}`);
  const prio = priorityMeta(task.priority);
  const status = statusMeta(task.status);
  const due = humanizeDue(task.dueDate, task.status);
  const shared = (task.assignedEmployees?.length ?? 0) > 1;
  const place = [task.floor, task.room, task.itemName].filter(Boolean).join(' · ');

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
  const solid = 'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold active:scale-[0.99] disabled:opacity-50';

  // The one obvious next action, rendered as a real button (not hidden behind a swipe).
  const primary = (() => {
    if (onPick) {
      return (
        <button onClick={(e) => { stop(e); onPick(task.id); }} disabled={task.canPick === false}
          className={`${solid} w-full bg-[#0A573B] text-white`}>
          <Hand className="h-4 w-4" /> {task.canPick === false ? 'At capacity' : 'Start Task'}
        </button>
      );
    }
    if (mine === 'ASSIGNED' || mine === 'ACCEPTED') {
      return (
        <button onClick={(e) => { stop(e); onStart(task.id); }} className={`${solid} w-full bg-[#0A573B] text-white`}>
          <Play className="h-4 w-4" /> Start Task
        </button>
      );
    }
    if (mine === 'IN_PROGRESS') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={(e) => { stop(e); open(); }} className={`${solid} border border-[#0A573B]/25 bg-[#E7F2EC] text-[#0A573B]`}>
            <Play className="h-4 w-4" /> Continue
          </button>
          <button onClick={(e) => { stop(e); onComplete(task.id); }} className={`${solid} bg-[#0A573B] text-white`}>
            <CheckCircle2 className="h-4 w-4" /> Complete
          </button>
        </div>
      );
    }
    if (mine === 'PAUSED') {
      return (
        <button onClick={(e) => { stop(e); onStart(task.id); }} className={`${solid} w-full bg-[#0A573B] text-white`}>
          <Play className="h-4 w-4" /> Resume
        </button>
      );
    }
    if (task.status === 'COMPLETED') {
      return (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-[#28704F]">
          <CheckCircle2 className="h-4 w-4" /> Completed
        </div>
      );
    }
    return (
      <button onClick={(e) => { stop(e); open(); }} className={`${solid} w-full border border-[#DDE2DE] bg-white text-[#0A573B]`}>
        View Task <ChevronRight className="h-4 w-4" />
      </button>
    );
  })();

  return (
    <SwipeActions actions={swipe} onTap={open}>
      <div className="flex gap-3 border-b border-[#EEEDE9] bg-white px-3.5 py-3.5 active:bg-[#F5F7F5]">
        <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${prio.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-[#111817]">{task.taskName}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>{status.label}</span>
          </div>

          {task.project?.name && <p className="mt-0.5 truncate text-[13px] text-[#5B625E]">{task.project.name}</p>}
          {place && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-[#7A817C]">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {place}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <span className={`font-medium ${dueToneClass(due.tone)}`}>{due.text}</span>
            {prio.urgent && <span className="text-[#B94B45]">· {prio.label}</span>}
            {shared && (
              <span className="ml-auto flex items-center gap-1 text-[#7A817C]">
                <Users className="h-3.5 w-3.5" /> {task.assignedEmployees!.length}
              </span>
            )}
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

          <div className="mt-3">{primary}</div>
        </div>
      </div>
    </SwipeActions>
  );
}
