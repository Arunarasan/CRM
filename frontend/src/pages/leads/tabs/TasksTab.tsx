import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { leadApi } from "../leadApi";
import { PRIORITIES, PRIORITY_STYLES, TASK_TYPES, formatDateTime, type UserSummary } from "../constants";
import { SelectField, TextAreaField, TextField, selectClass } from "../fields";
import { ListSkeleton, useLeadList } from "./shared";

const EMPTY = {
  title: "",
  taskType: "Call Customer",
  priority: "Medium",
  reminderDate: new Date().toISOString().slice(0, 10),
  reminderTime: "09:00",
  description: "",
  assignedToId: "",
};

export default function TasksTab({ leadId, users }: { leadId: string; users: UserSummary[] }) {
  const { items, loading, reload } = useLeadList<any>(() => leadApi.getTasks(leadId), [leadId]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: any = {
      title: form.title || form.taskType,
      taskType: form.taskType,
      priority: form.priority,
      description: form.description,
      reminderTime: `${form.reminderDate}T${form.reminderTime || "09:00"}:00`,
    };
    if (form.assignedToId) payload.assignedTo = { id: Number(form.assignedToId) };
    leadApi.addTask(leadId, payload)
      .then(() => { setOpen(false); setForm({ ...EMPTY }); reload(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  const toggle = (task: any) => {
    const next = task.status === "Completed" ? "Pending" : "Completed";
    leadApi.updateTaskStatus(leadId, task.id, next).then(reload).catch(console.error);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks & Reminders</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Task</Button>
      </CardHeader>
      <CardContent>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks" description="Assign calls, site visits, measurements, design and quotation tasks for this lead." />
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <div key={t.id} className={`border rounded-lg p-3 flex items-start gap-3 ${t.status === "Completed" ? "opacity-60" : "bg-muted/30"}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-1 accent-primary cursor-pointer"
                  checked={t.status === "Completed"}
                  onChange={() => toggle(t)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${t.status === "Completed" ? "line-through" : ""}`}>
                      {t.title || t.taskType || t.description}
                    </span>
                    {t.taskType && <span className="text-[10px] px-1.5 py-0.5 bg-background border rounded-full">{t.taskType}</span>}
                    {t.priority && (
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_STYLES[t.priority] || ""}`}>{t.priority}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Due {formatDateTime(t.reminderTime)}
                    {t.assignedTo?.name ? ` · assigned to ${t.assignedTo.name}` : ""}
                    {t.status ? ` · ${t.status}` : ""}
                  </div>
                  {t.description && <p className="text-xs mt-1 text-muted-foreground">{t.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <TextField label="Title" value={form.title} onChange={set("title")} placeholder="Defaults to the task type" />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Task Type" value={form.taskType} onChange={set("taskType")} options={TASK_TYPES} allowEmpty={false} />
              <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} allowEmpty={false} />
              <TextField label="Due Date" type="date" required value={form.reminderDate} onChange={set("reminderDate")} />
              <TextField label="Due Time" type="time" value={form.reminderTime} onChange={set("reminderTime")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assign To</label>
              <select className={selectClass} value={form.assignedToId} onChange={(e) => set("assignedToId")(e.target.value)}>
                <option value="">Lead's sales executive (default)</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <TextAreaField label="Description" value={form.description} onChange={set("description")} />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Task"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
