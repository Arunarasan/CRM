import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, UserCog, ChevronDown, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { MyProject, OtherProject, PickableTask } from '@/types/employeePortal';
import { PortalHeader, StatusPill, EmptyState } from './_shared';

export default function Projects() {
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [others, setOthers] = useState<OtherProject[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [openTasks, setOpenTasks] = useState<Record<number, PickableTask[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<number | null>(null);
  const [picking, setPicking] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadMine = () => employeePortalApi.projects().then(setProjects).catch(() => setProjects([]));
  const loadOthers = () => employeePortalApi.otherProjects().then(setOthers).catch(() => setOthers([]));
  useEffect(() => { loadMine(); loadOthers(); }, []);

  const toggle = (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!openTasks[id]) {
      setLoadingTasks(id);
      employeePortalApi.projectOpenTasks(id)
        .then((t) => setOpenTasks((p) => ({ ...p, [id]: t })))
        .catch(() => setOpenTasks((p) => ({ ...p, [id]: [] })))
        .finally(() => setLoadingTasks(null));
    }
  };

  const pickUp = async (projectId: number, task: PickableTask) => {
    setPicking(task.id);
    try {
      await employeePortalApi.pickUpTask(task.id);
      setOpenTasks((p) => ({ ...p, [projectId]: (p[projectId] || []).filter((t) => t.id !== task.id) }));
      await Promise.all([loadMine(), loadOthers()]);
    } catch {
      // Someone likely took it first — refresh the list.
      await loadOthers();
      setOpenTasks((p) => { const c = { ...p }; delete c[projectId]; return c; });
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="flex flex-col">
      <PortalHeader title="Projects" />
      <div className="flex flex-col gap-5 p-3">
        {/* MY PROJECTS */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">My Projects</h2>
          {projects.length === 0 ? (
            <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="You're not assigned to any projects yet." /></div>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p) => (
                <button key={p.id} onClick={() => navigate(`/employee/tasks?search=${encodeURIComponent(p.projectName)}`)}
                  className="rounded-xl border bg-card p-4 text-left shadow-sm active:bg-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{p.projectName}</h3>
                    <StatusPill status={p.status} />
                  </div>
                  {p.location && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {p.location}</p>
                  )}
                  {p.projectManager && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><UserCog className="h-3 w-3" /> PM: {p.projectManager}</p>
                  )}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Project progress</span><span>{p.progress ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress ?? 0}%` }} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    My tasks: <span className="font-medium text-foreground">{p.myCompletedCount}/{p.myTaskCount}</span> done
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* OTHER PROJECTS — browse and pick up open work */}
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Projects · pick up open tasks</h2>
          {others.length === 0 ? (
            <div className="rounded-xl border bg-card shadow-sm"><EmptyState message="No open tasks available on other projects right now." /></div>
          ) : (
            <div className="flex flex-col gap-3">
              {others.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <button onClick={() => toggle(p.id)} className="flex w-full items-start justify-between gap-2 p-4 text-left active:bg-accent/40">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{p.projectName}</h3>
                      {p.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {p.location}</p>
                      )}
                      <p className="mt-1 text-xs font-medium text-primary">{p.openTaskCount} task{p.openTaskCount === 1 ? '' : 's'} to pick up</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded === p.id ? 'rotate-180' : ''}`} />
                  </button>

                  {expanded === p.id && (
                    <div className="border-t bg-muted/20 p-3">
                      {loadingTasks === p.id ? (
                        <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading tasks…</p>
                      ) : (openTasks[p.id] || []).length === 0 ? (
                        <p className="py-2 text-xs text-muted-foreground">No open tasks left here.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {(openTasks[p.id] || []).map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{t.taskName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {[t.floor, t.room, t.itemName].filter(Boolean).join(' · ') || '—'}
                                  {t.dueDate ? ` · due ${t.dueDate}` : ''}
                                </p>
                              </div>
                              <button onClick={() => pickUp(p.id, t)} disabled={picking === t.id}
                                className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-60">
                                {picking === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Pick up
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3" /> Picked-up tasks appear in your Tasks list.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
