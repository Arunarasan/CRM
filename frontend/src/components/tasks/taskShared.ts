// Shared, presentation-neutral task model + style helpers used by BOTH the lead-tasks
// tab and the project-tasks tab, so a redesign lives in one place. Each screen maps its
// own backend shape (LeadReminder / PM Task) into a TaskCardModel before rendering.

/** Normalized lane every task is bucketed into, regardless of its source status vocabulary. */
export type TaskLane = "todo" | "in_progress" | "needs_approval" | "done";

export const TASK_LANES: { id: TaskLane; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "needs_approval", label: "Needs approval" },
  { id: "done", label: "Done" },
];

/** Left-accent + label colors per lane (premium theme friendly). */
export const LANE_STYLES: Record<TaskLane, { accent: string; badge: string; dot: string; label: string }> = {
  todo: { accent: "border-l-slate-300", badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400", label: "To do" },
  in_progress: { accent: "border-l-cyan-400", badge: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500", label: "In progress" },
  needs_approval: { accent: "border-l-amber-400", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "Needs approval" },
  done: { accent: "border-l-emerald-400", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Done" },
};

export const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-emerald-100 text-emerald-700",
  Low: "bg-slate-100 text-slate-600",
};

export const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];

/** LeadReminder statuses. Project tasks pass their own lane directly, so this stays lead-centric. */
export const LEAD_TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];

/** Map a raw LeadReminder status → lane. */
export function leadStatusToLane(status?: string | null, completed?: boolean): TaskLane {
  if (completed || status === "Completed") return "done";
  if (status === "In Progress") return "in_progress";
  return "todo";
}

/** Map a project task-board bucket (UNASSIGNED/ASSIGNED/IN_PROGRESS/NEEDS_APPROVAL/COMPLETED) → lane. */
export function bucketToLane(bucket?: string | null): TaskLane {
  switch (bucket) {
    case "COMPLETED": return "done";
    case "NEEDS_APPROVAL": return "needs_approval";
    case "IN_PROGRESS": return "in_progress";
    default: return "todo"; // UNASSIGNED, ASSIGNED
  }
}

/** The card view-model both screens render. */
export interface TaskCardModel {
  id: string | number;
  title: string;
  taskType?: string | null;
  priority?: string | null;
  status?: string | null;
  lane: TaskLane;
  dueLabel?: string | null;
  overdue?: boolean;
  assignees: string[];
  completed: boolean;
}

/** Form values the shared TaskEditor collects. */
export interface TaskFormValues {
  title: string;
  taskType: string;
  priority: string;
  reminderDate: string; // yyyy-mm-dd
  reminderTime: string; // HH:mm
  assignedToId: string;
  status: string;
  description: string;
}
