import { useNavigate } from 'react-router-dom';
import { Play, Pause, CheckCircle2, MapPin, Hand } from 'lucide-react';
import { TaskCard as TaskCardType } from '@/types/employeeTask';
import SwipeActions, { SwipeAction } from './SwipeActions';

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: 'bg-red-500', MEDIUM: 'bg-amber-500', LOW: 'bg-emerald-500',
};

const DUE_STATE_STYLE: Record<string, string> = {
  OVERDUE: 'bg-red-100 text-red-700',
  DUE_SOON: 'bg-amber-100 text-amber-800',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700',
  PAUSED: 'bg-amber-100 text-amber-800',
  WAITING_MATERIAL: 'bg-orange-100 text-orange-800',
  WAITING_APPROVAL: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  REWORK: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export default function TaskCard({
  task, onStart, onPause, onComplete, onPick,
}: {
  task: TaskCardType;
  onStart: (id: number) => void;
  onPause: (id: number) => void;
  onComplete: (id: number) => void;
  onPick?: (id: number) => void; // pool mode — renders a prominent Pick & Start button
}) {
  const navigate = useNavigate();
  const mine = task.myAssignmentStatus;

  const actions: SwipeAction[] = [];
  if (mine === 'ASSIGNED' || mine === 'ACCEPTED') {
    actions.push({ label: 'Start', icon: <Play className="h-4 w-4" />, className: 'bg-emerald-600', onClick: () => onStart(task.id) });
  } else if (mine === 'IN_PROGRESS') {
    actions.push({ label: 'Pause', icon: <Pause className="h-4 w-4" />, className: 'bg-amber-600', onClick: () => onPause(task.id) });
    actions.push({ label: 'Complete', icon: <CheckCircle2 className="h-4 w-4" />, className: 'bg-emerald-600', onClick: () => onComplete(task.id) });
  } else if (mine === 'PAUSED') {
    actions.push({ label: 'Resume', icon: <Play className="h-4 w-4" />, className: 'bg-emerald-600', onClick: () => onStart(task.id) });
  }

  return (
    <SwipeActions actions={actions} onTap={() => navigate(`/employee/tasks/${task.id}`)}>
      <div className="flex items-stretch gap-0 border-b bg-card px-3 py-3 active:bg-accent/40">
        <div className={`mr-3 w-1.5 shrink-0 rounded-full ${PRIORITY_COLOR[task.priority] ?? 'bg-slate-300'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{task.taskName}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[task.status] ?? 'bg-slate-100 text-slate-700'}`}>
              {task.status.replace('_', ' ')}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{task.project?.name}</p>
          {(task.room || task.itemName) && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {[task.floor, task.room, task.itemName].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
              {task.dueState && task.dueState !== 'ON_TRACK' && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${DUE_STATE_STYLE[task.dueState] ?? ''}`}>
                  {task.dueState === 'OVERDUE' ? 'Overdue' : 'Due soon'}
                </span>
              )}
            </span>
            {task.progressPercent != null && (
              <span className="text-[11px] font-medium text-primary">{task.progressPercent}%</span>
            )}
          </div>
          {task.progressPercent != null && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${task.progressPercent}%` }} />
            </div>
          )}
          {onPick && (
            <button
              onClick={(e) => { e.stopPropagation(); onPick(task.id); }}
              disabled={task.canPick === false}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-50"
            >
              <Hand className="h-4 w-4" /> {task.canPick === false ? 'At capacity' : 'Pick & Start'}
            </button>
          )}
        </div>
      </div>
    </SwipeActions>
  );
}
