import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Plus, Trash2, Loader2, CheckCircle2, Flag, PackageCheck, Users, Info,
} from "lucide-react";
import api from "@/lib/api";
import { projectApi, HandoverBoard, HandoverTask } from "@/api/projectApi";
import { smartAssignmentApi } from "@/api/smartAssignmentApi";
import ResourceSelect, { ResourceSelection } from "@/components/workforce/ResourceSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  PENDING: "bg-slate-100 text-slate-500",
};

/**
 * Customer-handover flow. Create stage tasks (Material, Stitching, Making, Works, Installation, or
 * custom), assign team members, set each task's completion %. The bar is the average of those tasks;
 * at 100% the "Handover to Customer" button marks the project completed and stamps the handover date.
 * Installation is auto-seeded and required.
 */
export default function HandoverTab({ project, onChanged }: { project: any; onChanged?: () => void }) {
  const canWrite = true; // the project team drives the handover flow
  const projectId = project?.id as number;

  const [board, setBoard] = useState<HandoverBoard | null>(null);
  const [assignees, setAssignees] = useState<Record<number, string[]>>({});
  const [drafts, setDrafts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    projectApi.getHandover(projectId)
      .then((b) => {
        setBoard(b);
        setDrafts(Object.fromEntries(b.tasks.map((t) => [t.id, t.progress])));
        // Pull the team for each task (employee assignments).
        b.tasks.forEach((t) => {
          api.get(`/tasks/${t.id}/assignments`).then((res) => {
            const names = (res.data || []).map((a: any) => a.employeeName).filter(Boolean);
            setAssignees((prev) => ({ ...prev, [t.id]: names }));
          }).catch(() => {});
        });
      })
      .catch(() => toast.error("Could not load the handover board"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  const commitProgress = (taskId: number, value: number) => {
    setBoard((b) => b && { ...b, tasks: b.tasks.map((t) => t.id === taskId ? { ...t, progress: value } : t) });
    api.put(`/tasks/${taskId}/progress`, { progress: value })
      .then(() => load())
      .catch(() => toast.error("Could not save progress"));
  };

  const handover = async () => {
    if (!board?.canHandover) return;
    if (!confirm("Hand this project over to the customer? It will be marked completed.")) return;
    setBusy(true);
    try {
      await projectApi.handoverProject(projectId, notes || undefined);
      toast.success("Project handed over to the customer 🎉");
      onChanged?.();
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Handover failed");
    } finally {
      setBusy(false);
    }
  };

  const removeTask = (t: HandoverTask) => {
    if (t.required) return;
    if (!confirm(`Delete task "${t.taskName}"?`)) return;
    api.delete(`/tasks/${t.id}`).then(load).catch(() => toast.error("Could not delete task"));
  };

  const grouped = useMemo(() => {
    const map = new Map<string, HandoverTask[]>();
    (board?.tasks || []).forEach((t) => {
      const k = t.stage || "Other";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return [...map.entries()];
  }, [board]);

  if (loading && !board) {
    return <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!board) return null;

  const done = board.tasks.filter((t) => t.progress >= 100).length;
  const handedOver = !!board.handoverDate;

  return (
    <div className="space-y-4">
      {/* Progress + handover */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><PackageCheck className="h-5 w-5 text-emerald-600" /> Handover</h3>
          {handedOver ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Handed over {format(new Date(board.handoverDate!), "dd MMM yyyy")}
            </span>
          ) : (
            <Button disabled={!board.canHandover || busy} onClick={handover}
              className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Handover to Customer
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${board.progressPercent >= 100 ? "bg-emerald-500" : "bg-emerald-600"}`}
              style={{ width: `${board.progressPercent}%` }} />
          </div>
          <span className="text-lg font-black text-slate-800 w-14 text-right">{board.progressPercent}%</span>
        </div>
        <div className="mt-1 text-xs text-slate-400">{done} of {board.taskCount} tasks complete</div>
        {!handedOver && !board.canHandover && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 p-2.5 text-[11px] text-sky-800">
            <Info className="h-4 w-4 shrink-0 text-sky-500 mt-0.5" />
            Every task must reach 100% before you can hand over. Set each task's completed level below.
          </div>
        )}
        {!handedOver && (
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Handover note (optional) — e.g. what was handed over, who received it" />
        )}
      </section>

      {/* Add stage task */}
      {canWrite && !handedOver && <AddTask projectId={projectId} stages={board.stages} onAdded={load} />}

      {/* Tasks grouped by stage */}
      <div className="space-y-3">
        {grouped.map(([stage, tasks]) => (
          <section key={stage} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="mb-3 flex items-center gap-2">
              <Flag className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-700">{stage}</h4>
              {stage === "Installation" && <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">Required</span>}
            </div>
            <div className="space-y-3">
              {tasks.map((t) => {
                const draft = drafts[t.id] ?? t.progress;
                return (
                  <div key={t.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{t.taskName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${STATUS_TONE[t.status || "PENDING"] || STATUS_TONE.PENDING}`}>{(t.status || "PENDING").replace(/_/g, " ")}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {(assignees[t.id] || []).length === 0
                            ? <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> No team yet</span>
                            : (assignees[t.id] || []).map((n, i) => (
                              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"><Users className="h-3 w-3" /> {n}</span>
                            ))}
                        </div>
                      </div>
                      {!t.required && !handedOver && (
                        <button type="button" title="Delete task" className="text-slate-300 hover:text-red-500 shrink-0" onClick={() => removeTask(t)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Completion level */}
                    <div className="mt-3 flex items-center gap-3">
                      <input type="range" min={0} max={100} step={5} value={draft} disabled={handedOver}
                        onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: Number(e.target.value) }))}
                        onPointerUp={(e) => commitProgress(t.id, Number((e.target as HTMLInputElement).value))}
                        onKeyUp={(e) => commitProgress(t.id, Number((e.target as HTMLInputElement).value))}
                        className="flex-1 accent-emerald-600" />
                      <span className="w-12 text-right text-sm font-bold text-slate-700">{draft}%</span>
                      {!handedOver && draft < 100 && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { setDrafts((d) => ({ ...d, [t.id]: 100 })); commitProgress(t.id, 100); }}>Done</Button>
                      )}
                    </div>

                    {/* Add team member */}
                    {canWrite && !handedOver && (
                      <div className="mt-2">
                        <ResourceSelect placeholder="Add team member…"
                          onChange={(sel: ResourceSelection | null) => {
                            if (!sel) return;
                            smartAssignmentApi.assign(t.id, [{ resourceType: sel.resourceType, resourceId: sel.resourceId }], "MANUAL")
                              .then(() => api.get(`/tasks/${t.id}/assignments`))
                              .then((res) => setAssignees((prev) => ({ ...prev, [t.id]: (res?.data || []).map((a: any) => a.employeeName).filter(Boolean) })))
                              .then(() => toast.success("Team member added"))
                              .catch(() => toast.error("Could not assign"));
                          }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Inline "create a stage task" row with recommended stages + custom. */
function AddTask({ projectId, stages, onAdded }: { projectId: number; stages: string[]; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [stage, setStage] = useState(stages[0] || "Material");
  const [custom, setCustom] = useState("");
  const [resource, setResource] = useState<ResourceSelection | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const finalStage = stage === "__custom" ? custom.trim() : stage;
    if (!name.trim()) { toast.error("Enter a task name"); return; }
    if (!finalStage) { toast.error("Pick or type a stage"); return; }
    setSaving(true);
    try {
      const res = await api.post("/tasks", {
        taskName: name.trim(), stage: finalStage, progress: 0, status: "PENDING", priority: "MEDIUM",
        project: { id: projectId },
      });
      const newId = res.data?.id;
      if (newId && resource) {
        await smartAssignmentApi.assign(newId, [{ resourceType: resource.resourceType, resourceId: resource.resourceId }], "MANUAL").catch(() => {});
      }
      setName(""); setCustom(""); setResource(null);
      toast.success("Task added");
      onAdded();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not add task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-2 text-sm font-bold text-slate-700 flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-600" /> Add a task</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <Input className="sm:col-span-4" value={name} onChange={(e) => setName(e.target.value)} placeholder="Task name (e.g. Cut fabric)" />
        <select value={stage} onChange={(e) => setStage(e.target.value)}
          className="sm:col-span-3 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
          <option value="__custom">Custom…</option>
        </select>
        {stage === "__custom"
          ? <Input className="sm:col-span-3" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Stage name" />
          : <div className="sm:col-span-3"><ResourceSelect value={resource} onChange={setResource} placeholder="Assign (optional)…" /></div>}
        <Button className="sm:col-span-2" onClick={add} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
        </Button>
      </div>
      {stage === "__custom" && (
        <div className="mt-2"><ResourceSelect value={resource} onChange={setResource} placeholder="Assign (optional)…" /></div>
      )}
    </section>
  );
}
