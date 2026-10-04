import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud, Loader2, Trash2, ListPlus, AlertTriangle, CheckCircle2, Ban, ChevronDown, ChevronUp,
  Phone, CalendarClock, User, StickyNote, X, RefreshCw, ExternalLink, FileAudio,
} from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { resolveFileUrl } from "@/lib/uploadFile";
import {
  callRecordingApi, errMsg, fmtCallTime, fmtDuration, type CallRecording, type CallStatus,
} from "@/api/callRecordingApi";
import CallLeadPanel, { displayPhone } from "./CallLeadPanel";

const MAX_BYTES = 25 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|m4a|aac|amr|3gp|3ga|awb|wav|ogg|oga|opus|webm|wma|flac|mp4)$/i;

type Filter = "NEW" | "TASK_CREATED" | "DONE" | "ALL";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "NEW", label: "To do" },
  { id: "TASK_CREATED", label: "Task created" },
  { id: "DONE", label: "Done" },
  { id: "ALL", label: "All" },
];

type QueueItem = { key: string; file: File; progress: number; error?: string };

/** Length of an audio file as the browser sees it (undefined for formats it can't read, e.g. .amr). */
function measureDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    let done = false;
    const finish = (v?: number) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration) : undefined);
    a.onerror = () => finish(undefined);
    setTimeout(() => finish(undefined), 5000);
    a.src = url;
  });
}

const toLocalInput = (iso?: string | null) => (iso ? iso.slice(0, 16) : "");
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

/**
 * Tasks & Workforce → Call Recordings. Drop in many call recordings at once; each becomes a row with
 * the number / call time / length read from the file (all editable). Pick rows and raise a "Call
 * follow-up" task for an employee, or close a call straight away as a lead / not a lead.
 */
export default function CallRecordingsTab({ onOpenTask, onTasksChanged }: {
  onOpenTask?: (taskId: number) => void;
  onTasksChanged?: () => void;
}) {
  const [rows, setRows] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("NEW");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [taskFor, setTaskFor] = useState<number[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    callRecordingApi.list().then(setRows).catch((e) => toast.error(errMsg(e, "Could not load call recordings.")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const replace = (c: CallRecording) => setRows((rs) => rs.map((r) => (r.id === c.id ? c : r)));

  const counts = useMemo(() => {
    const c: Record<string, number> = { NEW: 0, TASK_CREATED: 0, DONE: 0, ALL: rows.length };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);
  const visible = rows.filter((r) => filter === "ALL" || r.status === filter);
  const selectable = visible.filter((r) => r.status === "NEW");
  const selectedIds = [...selected].filter((id) => rows.some((r) => r.id === id && r.status === "NEW"));

  // ------------------------------------------------------------ upload (3 at a time)
  const addFiles = async (files: FileList | File[]) => {
    const list = [...files];
    const items: QueueItem[] = [];
    for (const f of list) {
      const key = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`;
      if (!f.type.startsWith("audio/") && !AUDIO_EXT.test(f.name)) {
        items.push({ key, file: f, progress: 0, error: "Not an audio file" });
      } else if (f.size > MAX_BYTES) {
        items.push({ key, file: f, progress: 0, error: "Bigger than 25 MB" });
      } else {
        items.push({ key, file: f, progress: 0 });
      }
    }
    setQueue((q) => [...q, ...items]);
    setFilter("NEW");
    const todo = items.filter((i) => !i.error);
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const item = todo[next++];
        try {
          const durationSec = await measureDuration(item.file);
          const rec = await callRecordingApi.upload(item.file, { lastModified: item.file.lastModified, durationSec },
            (pct) => setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, progress: pct } : x))));
          setRows((rs) => [rec, ...rs]);
          setQueue((q) => q.filter((x) => x.key !== item.key));
        } catch (e) {
          setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, error: errMsg(e, "Upload failed") } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  const retry = (item: QueueItem) => {
    setQueue((q) => q.filter((x) => x.key !== item.key));
    addFiles([item.file]);
  };

  // ------------------------------------------------------------ row actions
  const save = async (r: CallRecording, patch: Partial<CallRecording>) => {
    try {
      replace(await callRecordingApi.update(r.id, patch));
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      load();
    }
  };
  const discard = async (r: CallRecording) => {
    if (!window.confirm(`Remove ${r.fileName}?`)) return;
    try {
      await callRecordingApi.discard(r.id);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/60 hover:bg-muted/30"}`}
      >
        <UploadCloud className="h-8 w-8 text-primary" />
        <p className="text-sm font-semibold">Drop call recordings here, or click to choose</p>
        <p className="text-xs text-muted-foreground">Many files at once · .mp3 .m4a .amr .wav .3gp … · up to 25 MB each. Number and call time are read from the file name.</p>
        <input ref={fileRef} type="file" accept="audio/*,.amr,.3gp,.awb,.m4a" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          {queue.map((q) => (
            <div key={q.key} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
              <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{q.file.name}</span>
              {q.error ? (
                <>
                  <span className="shrink-0 text-xs text-destructive">{q.error}</span>
                  {q.error !== "Not an audio file" && q.error !== "Bigger than 25 MB" && (
                    <button onClick={() => retry(q)} className="shrink-0 text-xs font-medium text-primary hover:underline">Retry</button>
                  )}
                  <button onClick={() => setQueue((x) => x.filter((i) => i.key !== q.key))} aria-label="Dismiss" className="shrink-0 text-muted-foreground"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <div className="flex w-32 shrink-0 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${q.progress}%` }} />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{q.progress < 100 ? `${q.progress}%` : <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters + bulk action */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${filter === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>
              {f.label} <span className="opacity-70">{counts[f.id] || 0}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" disabled={selectedIds.length === 0} onClick={() => setTaskFor(selectedIds)}>
            <ListPlus className="mr-1.5 h-4 w-4" /> Create {selectedIds.length || ""} task{selectedIds.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>

      {selectable.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" /> Select all to-do calls
        </label>
      )}

      {/* Rows */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          {loading ? "Loading…" : filter === "NEW" ? "No calls waiting. Upload recordings above." : "Nothing here yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <CallRow key={r.id} r={r} selected={selected.has(r.id)} onToggle={() => toggle(r.id)}
              onSave={(p) => save(r, p)} onDiscard={() => discard(r)} onCreateTask={() => setTaskFor([r.id])}
              onChanged={(c) => { replace(c); onTasksChanged?.(); }} onOpenTask={onOpenTask} />
          ))}
        </div>
      )}

      <CreateTaskDialog
        ids={taskFor}
        onClose={() => setTaskFor(null)}
        onCreated={(updated) => {
          setRows((rs) => rs.map((r) => updated.find((u) => u.id === r.id) || r));
          setSelected(new Set());
          setTaskFor(null);
          onTasksChanged?.();
          toast.success(`${updated.length} task${updated.length === 1 ? "" : "s"} created`);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function CallRow({ r, selected, onToggle, onSave, onDiscard, onCreateTask, onChanged, onOpenTask }: {
  r: CallRecording;
  selected: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<CallRecording>) => void;
  onDiscard: () => void;
  onCreateTask: () => void;
  onChanged: (c: CallRecording) => void;
  onOpenTask?: (taskId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const editable = !r.outcome;
  const [phone, setPhone] = useState(displayPhone(r.phoneNumber));
  const [when, setWhen] = useState(toLocalInput(r.calledAt));
  const [name, setName] = useState(r.contactName || "");
  const [note, setNote] = useState(r.note || "");
  useEffect(() => {
    setPhone(displayPhone(r.phoneNumber)); setWhen(toLocalInput(r.calledAt));
    setName(r.contactName || ""); setNote(r.note || "");
  }, [r.phoneNumber, r.calledAt, r.contactName, r.note]);

  const commit = (key: "phoneNumber" | "calledAt" | "contactName" | "note", value: string, current: string) => {
    if (value.trim() === current.trim()) return;
    onSave({ [key]: value.trim() || null } as Partial<CallRecording>);
  };

  const field = "h-9 w-full min-w-0 rounded-md border bg-background px-2.5 text-sm disabled:bg-muted/40 disabled:text-muted-foreground";
  const missing = "border-amber-300 bg-amber-50/60";

  return (
    <div className={`rounded-xl border bg-card p-3 shadow-sm ${selected ? "ring-2 ring-primary/40" : ""}`}>
      <div className="flex items-start gap-3">
        {r.status === "NEW" ? (
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select call" className="mt-2.5 h-4 w-4 shrink-0 accent-primary" />
        ) : <span className="w-4 shrink-0" />}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <AudioPlayer src={resolveFileUrl(r.fileUrl)} fileName={r.fileName} className="min-w-[220px] flex-1" />
            <span className="text-xs tabular-nums text-muted-foreground">{fmtDuration(r.durationSec)}</span>
            <StatusChip r={r} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative">
              <Phone className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={phone} disabled={!editable} onChange={(e) => setPhone(e.target.value)}
                onBlur={() => commit("phoneNumber", phone, displayPhone(r.phoneNumber))}
                placeholder="Enter phone number" inputMode="tel" className={`${field} pl-8 ${!r.phoneNumber ? missing : ""}`} />
            </label>
            <label className="relative">
              <CalendarClock className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="datetime-local" value={when} disabled={!editable} onChange={(e) => setWhen(e.target.value)}
                onBlur={() => commit("calledAt", when, toLocalInput(r.calledAt))}
                className={`${field} pl-8 ${!r.calledAt ? missing : ""}`} />
            </label>
            <label className="relative">
              <User className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)}
                onBlur={() => commit("contactName", name, r.contactName || "")}
                placeholder="Caller name (optional)" className={`${field} pl-8`} />
            </label>
            <label className="relative">
              <StickyNote className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)}
                onBlur={() => commit("note", note, r.note || "")}
                placeholder="Note for the employee" className={`${field} pl-8`} />
            </label>
          </div>

          {r.matchedLead && !r.outcome && (
            <p className="flex items-center gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Existing lead on this number: <b>{r.matchedLead.leadNumber} · {r.matchedLead.name}</b>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {r.status === "NEW" && (
              <Button size="sm" onClick={onCreateTask}><ListPlus className="mr-1.5 h-4 w-4" /> Create task</Button>
            )}
            {r.taskId && (
              <button onClick={() => onOpenTask?.(r.taskId!)}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                <ExternalLink className="h-3.5 w-3.5" />
                Task · {r.assigneeName || "Unassigned"}{r.dueDate ? ` · due ${new Date(r.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}
              </button>
            )}
            {!r.outcome && (
              <button onClick={() => setExpanded((x) => !x)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {r.taskId ? "Close the call yourself" : "Create lead now"}
              </button>
            )}
            {r.status === "NEW" && (
              <button onClick={onDiscard} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>

          {(expanded || r.outcome) && (
            <div className="max-w-md">
              <CallLeadPanel call={r} onChanged={(c) => { onChanged(c); setExpanded(false); }} canOpenLead showPlayer={false} />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Uploaded {r.createdAt ? fmtCallTime(r.createdAt) : ""}{r.uploadedBy ? ` by ${r.uploadedBy}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ r }: { r: CallRecording }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold";
  if (r.outcome === "LEAD_CREATED" || r.outcome === "ADDED_TO_LEAD") {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}><CheckCircle2 className="h-3 w-3" />{r.lead?.leadNumber || "Lead"}</span>;
  }
  if (r.outcome === "NOT_A_LEAD") return <span className={`${base} border-slate-200 bg-slate-50 text-slate-600`}><Ban className="h-3 w-3" />Not a lead</span>;
  const map: Record<CallStatus, [string, string]> = {
    NEW: ["To do", "border-amber-200 bg-amber-50 text-amber-700"],
    TASK_CREATED: ["Task created", "border-sky-200 bg-sky-50 text-sky-700"],
    DONE: ["Done", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    DISCARDED: ["Removed", "border-slate-200 bg-slate-50 text-slate-600"],
  };
  const [label, cls] = map[r.status];
  return <span className={`${base} ${cls}`}>{label}</span>;
}

function CreateTaskDialog({ ids, onClose, onCreated }: {
  ids: number[] | null;
  onClose: () => void;
  onCreated: (rows: CallRecording[]) => void;
}) {
  const [who, setWho] = useState<ResourceSelection | null>(null);
  const [due, setDue] = useState(tomorrow());
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (ids) { setDue(tomorrow()); setPriority("MEDIUM"); } }, [ids]);

  const submit = async () => {
    if (!ids || !who) { toast.error("Choose who should follow up."); return; }
    setSaving(true);
    try {
      onCreated(await callRecordingApi.createTasks({ ids, resourceType: who.resourceType, resourceId: who.resourceId, dueDate: due, priority }));
    } catch (e) {
      toast.error(errMsg(e, "Could not create the tasks."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!ids} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ids && ids.length > 1 ? `Create ${ids.length} call follow-up tasks` : "Create call follow-up task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The employee gets the recording, the number to call back, and the lead form inside the task.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assign to</label>
            <ResourceSelect value={who} onChange={setWho} placeholder="Pick an employee…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Due date</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2.5 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2.5 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !who}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Create {ids && ids.length > 1 ? `${ids.length} tasks` : "task"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
