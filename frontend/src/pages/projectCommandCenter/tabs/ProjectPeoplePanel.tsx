import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus, Users } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import ResourceSelect, { type ResourceSelection } from "@/components/workforce/ResourceSelect";

interface Person {
  userId: number; name: string; role: "PROJECT_MANAGER" | "ASSISTANT_MANAGER" | "MEMBER"; pickedOwn: boolean;
  tasks: { id: number; name: string; status: string }[];
}

const ROLES: [Person["role"], string][] = [
  ["PROJECT_MANAGER", "Project Manager"], ["ASSISTANT_MANAGER", "Assistant Manager"], ["MEMBER", "Team member"],
];

/**
 * Everyone on the project in one list: the managers the admin set plus anyone holding a task (office-assigned,
 * auto-assigned or picked up by themselves). The admin changes a role, adds a person or removes one here.
 */
export default function ProjectPeoplePanel({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | "add" | null>(null);
  const [open, setOpen] = useState(true);
  const [newSel, setNewSel] = useState<ResourceSelection | null>(null);
  const [newRole, setNewRole] = useState<Person["role"]>("MEMBER");

  const load = useCallback(() => {
    api.get<Person[]>(`/projects/${projectId}/people`)
      .then((r) => setPeople(r.data)).catch(() => setPeople([])).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const save = async (userId: number, role: Person["role"], key: number | "add") => {
    setBusy(key);
    try {
      const r = await api.put<Person[]>(`/projects/${projectId}/people`, { userId, role });
      setPeople(r.data);
      onChanged?.();
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update the team");
      return false;
    } finally { setBusy(null); }
  };

  const add = async () => {
    if (!newSel) { toast.error("Pick an employee"); return; }
    if (newSel.resourceType !== "EMPLOYEE") { toast.error("Only employees can be added to the project team"); return; }
    if (await save(newSel.resourceId, newRole, "add")) { toast.success(`${newSel.name || "Employee"} added`); setNewSel(null); }
  };

  const remove = async (p: Person) => {
    const n = p.tasks.length;
    if (!confirm(`Remove ${p.name} from this project?${n ? ` They will be taken off ${n} task(s).` : ""}`)) return;
    setBusy(p.userId);
    try {
      const r = await api.delete<Person[]>(`/projects/${projectId}/people/${p.userId}`);
      setPeople(r.data);
      toast.success(`${p.name} removed`);
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not remove");
    } finally { setBusy(null); }
  };

  const sel = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700";
  return (
    <div className="border-b border-slate-100">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <Users className="h-4 w-4 text-emerald-700" />
        <span className="text-sm font-bold text-slate-900">Project team</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{people.length}</span>
        <span className="ml-auto text-xs text-slate-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            : people.length === 0 ? <p className="text-xs text-slate-400">Nobody on this project yet. Add the first person below.</p>
            : people.map((p) => (
              <div key={p.userId} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="truncate text-[11px] text-slate-500" title={p.tasks.map((t) => t.name).join(", ")}>
                    {p.tasks.length ? `${p.tasks.length} task${p.tasks.length > 1 ? "s" : ""}: ${p.tasks.map((t) => t.name).join(", ")}` : "No tasks yet"}
                    {p.pickedOwn ? " · picked by themself" : ""}
                  </p>
                </div>
                <select className={sel} value={p.role} disabled={busy === p.userId}
                  onChange={(e) => save(p.userId, e.target.value as Person["role"], p.userId)}>
                  {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Button type="button" size="sm" variant="outline" disabled={busy === p.userId} onClick={() => remove(p)}
                  className="h-8 w-8 rounded-lg p-0 text-rose-600" title="Remove from project">
                  {busy === p.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="min-w-[200px] flex-1"><ResourceSelect value={newSel} onChange={setNewSel} placeholder="Add a person…" /></div>
            <select className={sel} value={newRole} onChange={(e) => setNewRole(e.target.value as Person["role"])}>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Button type="button" size="sm" disabled={busy === "add" || !newSel} onClick={add} className="h-8 rounded-lg bg-emerald-800 text-white hover:bg-emerald-900">
              {busy === "add" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />} Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
