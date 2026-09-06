import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import {
  PRIORITY_OPTIONS,
  LEAD_TASK_STATUSES,
  type TaskFormValues,
} from "./taskShared";

const selectClass =
  "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const todayISO = () => new Date().toISOString().slice(0, 10);

const EMPTY: TaskFormValues = {
  title: "",
  taskType: "Call Customer",
  priority: "Medium",
  reminderDate: todayISO(),
  reminderTime: "09:00",
  assignedToId: "",
  status: "Pending",
  description: "",
};

interface TaskEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill for edit mode; omit/null for a fresh "Add task". */
  initial?: Partial<TaskFormValues> | null;
  /** When true, shows the Delete button and titles the dialog "Edit task". */
  editing?: boolean;
  users: { id: string | number; name: string }[];
  taskTypes: string[];
  statuses?: string[];
  /** Priority choices (lead tasks: Low/Medium/High/Urgent; project tasks: LOW/MEDIUM/HIGH). */
  priorityOptions?: string[];
  /** Show the status field (usually hidden on create). */
  showStatus?: boolean;
  /** Show the task-type dropdown (lead tasks yes, project tasks no). */
  showType?: boolean;
  /** Show the due-time field (lead reminders yes, date-only project tasks no). */
  showTime?: boolean;
  /** Show the assignee picker (leads use it; projects assign via their own resource picker). */
  showAssignee?: boolean;
  /** Default-owner hint shown as the empty option of the assignee picker. */
  assigneePlaceholder?: string;
  /** Persist. Resolve to close the dialog; throw to keep it open. */
  onSave: (values: TaskFormValues) => Promise<void> | void;
  /** Delete this task. Only used when `editing`. */
  onDelete?: () => Promise<void> | void;
}

/**
 * The one editor both task screens open — create or edit a task with full control:
 * title, type, priority, reschedule (date + time), reassign, status and description,
 * plus delete. Owns form + busy state; the parent supplies onSave / onDelete.
 */
export default function TaskEditor({
  open,
  onOpenChange,
  initial,
  editing = false,
  users,
  taskTypes,
  statuses = LEAD_TASK_STATUSES,
  priorityOptions = PRIORITY_OPTIONS,
  showStatus = editing,
  showType = true,
  showTime = true,
  showAssignee = true,
  assigneePlaceholder = "Default owner",
  onSave,
  onDelete,
}: TaskEditorProps) {
  const [form, setForm] = useState<TaskFormValues>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-seed the form each time the dialog opens so stale edits never leak between tasks.
  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...(initial ?? {}) });
  }, [open, initial]);

  const set = (key: keyof TaskFormValues) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reminderDate) { toast.error("Pick a due date"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not save the task");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!window.confirm("Delete this task? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not delete the task");
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;
  const userOptions = users.map((u) => ({ value: String(u.id), label: u.name }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "Add task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title</label>
            <input
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="Defaults to the task type"
              className={selectClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {showType && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type</label>
                <select className={selectClass} value={form.taskType} onChange={(e) => set("taskType")(e.target.value)}>
                  {taskTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <select className={selectClass} value={form.priority} onChange={(e) => set("priority")(e.target.value)}>
                {priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Due date</label>
              <input type="date" value={form.reminderDate} onChange={(e) => set("reminderDate")(e.target.value)} className={selectClass} />
            </div>
            {showTime && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due time</label>
                <input type="time" value={form.reminderTime} onChange={(e) => set("reminderTime")(e.target.value)} className={selectClass} />
              </div>
            )}
          </div>

          {showAssignee && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assign to</label>
              <SearchableSelect
                value={form.assignedToId}
                onChange={set("assignedToId")}
                options={userOptions}
                placeholder={assigneePlaceholder}
                clearLabel={assigneePlaceholder}
              />
            </div>
          )}

          {showStatus && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <select className={selectClass} value={form.status} onChange={(e) => set("status")(e.target.value)}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {editing && onDelete ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>{saving ? "Saving…" : editing ? "Save" : "Add task"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
