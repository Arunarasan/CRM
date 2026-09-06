import { useMemo, useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import TaskCard from "@/components/tasks/TaskCard";
import TaskEditor from "@/components/tasks/TaskEditor";
import TaskLanes from "@/components/tasks/TaskLanes";
import { leadStatusToLane, type TaskCardModel, type TaskFormValues } from "@/components/tasks/taskShared";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { TASK_TYPES, formatDateTime, type UserSummary } from "../constants";
import { ListSkeleton, useLeadList } from "./shared";

const isOverdue = (iso?: string | null, completed?: boolean) =>
  !!iso && !completed && new Date(iso).getTime() < Date.now();

const pad = (n: number) => String(n).padStart(2, "0");
/** Add one day to a `yyyy-mm-ddThh:mm:ss` reminder, preserving the time (local, no TZ drift). */
const addOneDay = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
};

/** Split a `yyyy-mm-ddThh:mm:ss` reminder into the date + time the editor expects. */
const splitReminder = (iso?: string | null) => ({
  date: iso ? iso.slice(0, 10) : new Date().toISOString().slice(0, 10),
  time: iso ? iso.slice(11, 16) : "09:00",
});

export default function TasksTab({ leadId, users }: { leadId: string; users: UserSummary[] }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getTasks(leadId), [leadId]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null); // the raw task being edited; null = create

  // Map the raw LeadReminder rows into the shared card model. Incomplete first, then by due date.
  const cards: { raw: any; model: TaskCardModel }[] = useMemo(() => {
    const rows = [...items].sort((a, b) => {
      const ac = a.status === "Completed" ? 1 : 0;
      const bc = b.status === "Completed" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return (a.reminderTime || "").localeCompare(b.reminderTime || "");
    });
    return rows.map((t) => {
      const completed = t.status === "Completed" || t.isCompleted;
      return {
        raw: t,
        model: {
          id: t.id,
          title: t.title || t.taskType || t.description || "Task",
          taskType: t.taskType,
          priority: t.priority,
          status: t.status,
          lane: leadStatusToLane(t.status, completed),
          dueLabel: t.reminderTime ? formatDateTime(t.reminderTime) : null,
          overdue: isOverdue(t.reminderTime, completed),
          assignees: t.assignedTo?.name ? [t.assignedTo.name] : [],
          completed,
        },
      };
    });
  }, [items]);

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (raw: any) => { setEditing(raw); setEditorOpen(true); };

  const toggle = (raw: any) => {
    const next = raw.status === "Completed" ? "Pending" : "Completed";
    leadApi.updateTaskStatus(leadId, raw.id, next)
      .then(reload)
      .catch(() => toast.error("Could not update the task"));
  };

  // Quick reschedule: push the due date out by one day, keeping every other field.
  const snooze = (raw: any) => {
    const payload: any = {
      title: raw.title || raw.taskType,
      taskType: raw.taskType,
      priority: raw.priority,
      description: raw.description,
      reminderTime: addOneDay(raw.reminderTime),
      status: raw.status,
    };
    if (raw.assignedTo?.id) payload.assignedTo = { id: raw.assignedTo.id };
    leadApi.updateTask(leadId, raw.id, payload)
      .then(() => { toast.success("Pushed out by a day"); reload(); })
      .catch(() => toast.error("Could not reschedule the task"));
  };

  const buildPayload = (v: TaskFormValues) => {
    const payload: any = {
      title: v.title || v.taskType,
      taskType: v.taskType,
      priority: v.priority,
      description: v.description,
      reminderTime: `${v.reminderDate}T${v.reminderTime || "09:00"}:00`,
    };
    if (v.assignedToId) payload.assignedTo = { id: Number(v.assignedToId) };
    return payload;
  };

  const save = async (v: TaskFormValues) => {
    if (editing) {
      await leadApi.updateTask(leadId, editing.id, { ...buildPayload(v), status: v.status });
      toast.success("Task updated");
    } else {
      await leadApi.addTask(leadId, buildPayload(v));
      toast.success("Task added");
    }
    reload();
  };

  const remove = async () => {
    if (!editing) return;
    await leadApi.deleteTask(leadId, editing.id);
    toast.success("Task deleted");
    reload();
  };

  const editorInitial = editing
    ? {
        title: editing.title || "",
        taskType: editing.taskType || "Call Customer",
        priority: editing.priority || "Medium",
        reminderDate: splitReminder(editing.reminderTime).date,
        reminderTime: splitReminder(editing.reminderTime).time,
        assignedToId: editing.assignedTo?.id ? String(editing.assignedTo.id) : "",
        status: editing.status || "Pending",
        description: editing.description || "",
      }
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks &amp; Reminders</CardTitle>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : cards.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks" description="Assign calls, site visits, measurements, design and quotation tasks for this lead." />
        ) : (
          <TaskLanes
            items={cards}
            laneOf={(c) => c.model.lane}
            keyOf={(c) => c.model.id}
            renderCard={({ raw, model }) => (
              <TaskCard
                task={model}
                onToggleComplete={() => toggle(raw)}
                onEdit={() => openEdit(raw)}
                onSnooze={() => snooze(raw)}
              />
            )}
          />
        )}
      </CardContent>

      <TaskEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        editing={!!editing}
        users={users}
        taskTypes={TASK_TYPES}
        assigneePlaceholder="Lead's sales executive (default)"
        onSave={save}
        onDelete={remove}
      />
    </Card>
  );
}
