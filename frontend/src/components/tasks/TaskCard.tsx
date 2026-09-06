import type { ReactNode } from "react";
import { Pencil, Clock, User2, CheckCircle2 } from "lucide-react";
import { PRIORITY_STYLES, LANE_STYLES, type TaskCardModel } from "./taskShared";

interface TaskCardProps {
  task: TaskCardModel;
  /** Show a round complete toggle on the left when provided. */
  onToggleComplete?: () => void;
  /** Open the editor. Also fires on a click of the card body. */
  onEdit?: () => void;
  /** Push the due date out by one day. When set, a small "+1d" button shows by the due date. */
  onSnooze?: () => void;
  /** Extra buttons (e.g. Assign on the project screen) rendered in the footer. */
  actions?: ReactNode;
  /** Hide the assignee line in the meta row (e.g. when the footer manages assignees). */
  hideAssignees?: boolean;
  className?: string;
}

/**
 * One premium-theme task card, shared by the lead and project task screens.
 * Presentational only — all data comes in via a normalized TaskCardModel and all
 * mutations are delegated to the callbacks, so each screen keeps its own wiring.
 */
export default function TaskCard({ task, onToggleComplete, onEdit, onSnooze, actions, hideAssignees, className }: TaskCardProps) {
  const lane = LANE_STYLES[task.lane];
  const done = task.completed;

  return (
    <div
      className={`group relative rounded-xl border border-l-4 ${lane.accent} bg-card shadow-sm transition-shadow hover:shadow-md ${done ? "opacity-70" : ""} ${className ?? ""}`}
    >
      <div className="flex items-start gap-3 p-3">
        {onToggleComplete && (
          <button
            type="button"
            onClick={onToggleComplete}
            aria-label={done ? "Mark as not done" : "Mark as done"}
            className={`mt-0.5 shrink-0 rounded-full transition-colors ${done ? "text-emerald-500" : "text-slate-300 hover:text-emerald-500"}`}
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>
        )}

        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-semibold text-foreground ${done ? "line-through" : ""}`}>
              {task.title}
            </span>
            {task.taskType && (
              <span className="rounded-full border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {task.taskType}
              </span>
            )}
            {task.priority && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_STYLES[task.priority] || "bg-muted text-muted-foreground"}`}>
                {task.priority}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {task.dueLabel && (
              <span className={`inline-flex items-center gap-1 ${task.overdue && !done ? "font-semibold text-red-600" : ""}`}>
                <Clock className="h-3 w-3" /> {task.dueLabel}
              </span>
            )}
            {!hideAssignees && (
              <span className="inline-flex items-center gap-1">
                <User2 className="h-3 w-3" />
                {task.assignees.length > 0 ? task.assignees.join(", ") : "Unassigned"}
              </span>
            )}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${lane.badge}`}>{lane.label}</span>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onSnooze && !done && task.dueLabel && (
            <button
              type="button"
              onClick={onSnooze}
              title="Push due date out by one day"
              className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            >
              +1d
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit task"
              className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">{actions}</div>}
    </div>
  );
}
