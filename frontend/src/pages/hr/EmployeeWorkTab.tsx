/**
 * Work tab of the admin employee profile: everything the employee is assigned or has finished,
 * split into Leads / Projects / Orders. Assigned (still open) work always shows; the day filter
 * applies to finished work only.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { CheckCircle2, ChevronRight, Clock, Loader2, Search, Target, FolderKanban, Package, Inbox } from "lucide-react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";

type WorkRow = {
  key: string; name: string; source?: string | null; link?: string | null; status: string;
  assignedAt?: string | null; dueDate?: string | null; completedAt?: string | null;
  hours?: number | null; overdue?: boolean; stage?: string | null; progress?: number | null;
};
type Group = { assigned: WorkRow[]; done: WorkRow[] };
type WorkData = {
  leads: Group; projects: Group; orders: Group;
  totals: { assigned: number; overdue: number; done: number; hours: number };
};

const GROUPS = [
  { id: "leads", label: "Leads", icon: Target },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "orders", label: "Orders", icon: Package },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

const PRESETS = [
  { id: "7", label: "7 days", days: 7 },
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: 0 },
  { id: "custom", label: "Custom", days: 0 },
] as const;

const fmtD = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
};
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700", DELIVERED: "bg-emerald-100 text-emerald-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700", PROCESS: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-slate-100 text-slate-600", ORDER: "bg-slate-100 text-slate-600",
  ACCEPTED: "bg-sky-100 text-sky-700", PAUSED: "bg-amber-100 text-amber-700",
  WAITING_MATERIAL: "bg-amber-100 text-amber-700", WAITING_APPROVAL: "bg-amber-100 text-amber-700",
  REWORK: "bg-red-100 text-red-700",
};

export default function EmployeeWorkTab({ employeeId, children }: { employeeId: number; children?: ReactNode }) {
  const [view, setView] = useState<"work" | "submitted">("work");
  const [group, setGroup] = useState<GroupId>("leads");
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("30");
  const [from, setFrom] = useState(ymd(subDays(new Date(), 30)));
  const [to, setTo] = useState(ymd(new Date()));
  const [q, setQ] = useState("");
  const [data, setData] = useState<WorkData | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (preset === "all") return {};
    if (preset === "custom") return { from: from || undefined, to: to || undefined };
    const days = PRESETS.find((p) => p.id === preset)!.days;
    return { from: ymd(subDays(new Date(), days)), to: ymd(new Date()) };
  }, [preset, from, to]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get(`/hr/employees/${employeeId}/work`, { params: range })
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const match = (r: WorkRow) => {
    const s = q.trim().toLowerCase();
    return !s || `${r.name} ${r.source ?? ""} ${r.status}`.toLowerCase().includes(s);
  };
  const g = data?.[group];
  const assigned = (g?.assigned ?? []).filter(match);
  const done = (g?.done ?? []).filter(match);

  return (
    <div className="space-y-5">
      {children && (
        <div className="inline-flex rounded-lg border bg-white p-0.5 text-sm font-semibold">
          {([["work", "Assigned & done"], ["submitted", "Submitted by them"]] as const).map(([id, l]) => (
            <button key={id} type="button" onClick={() => setView(id)}
              className={`rounded-md px-3 py-1.5 ${view === id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{l}</button>
          ))}
        </div>
      )}

      {view === "submitted" ? children : (
        <>
          {/* totals */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-slate-100 md:grid-cols-4">
            {[
              ["Assigned (open)", data?.totals.assigned ?? 0],
              ["Overdue", data?.totals.overdue ?? 0],
              ["Done in range", data?.totals.done ?? 0],
              ["Hours in range", `${Number(data?.totals.hours ?? 0).toFixed(1)}h`],
            ].map(([l, v]) => (
              <div key={String(l)} className="bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{l}</p>
                <p className="text-xl font-bold text-slate-900">{v}</p>
              </div>
            ))}
          </div>

          {/* filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3">
            <span className="text-xs font-semibold text-slate-500">Completed in</span>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPreset(p.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${preset === p.id ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-50"}`}>{p.label}</button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input type="date" className="h-8 w-36 text-xs" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                <span className="text-xs text-slate-400">to</span>
                <Input type="date" className="h-8 w-36 text-xs" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
            <div className="relative ml-auto w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
              <Input className="h-8 pl-8 text-sm" placeholder="Search work…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {/* Leads | Projects | Orders */}
          <div className="flex gap-1 border-b">
            {GROUPS.map(({ id, label: l, icon: Icon }) => {
              const gr = data?.[id];
              const n = (gr?.assigned.length ?? 0) + (gr?.done.length ?? 0);
              return (
                <button key={id} type="button" onClick={() => setGroup(id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-semibold ${group === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                  <Icon className="h-4 w-4" />{l}
                  <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{n}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
          ) : (
            <>
              <WorkList title="Assigned / in progress" icon={<Clock className="h-4 w-4 text-amber-600" />} rows={assigned}
                empty="Nothing open right now." showDue />
              <WorkList title="Completed" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} rows={done}
                empty={preset === "all" ? "Nothing completed yet." : "Nothing completed in this period."} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function WorkList({ title, icon, rows, empty, showDue }: { title: string; icon: ReactNode; rows: WorkRow[]; empty: string; showDue?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        {icon}<h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="ml-auto text-sm text-slate-500">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 p-8 text-sm text-slate-500"><Inbox className="h-5 w-5 text-slate-300" />{empty}</div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const body = (
              <div className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{r.name}</div>
                  <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
                    {r.source && <span>{r.source}</span>}
                    {r.stage && <span>· {r.stage}</span>}
                    <span>· Assigned {fmtD(r.assignedAt)}</span>
                    {showDue && r.dueDate && <span className={r.overdue ? "font-semibold text-red-600" : ""}>· Due {fmtD(r.dueDate)}{r.overdue ? " (overdue)" : ""}</span>}
                    {!showDue && r.completedAt && <span>· Done {fmtD(r.completedAt)}</span>}
                    {r.hours != null && Number(r.hours) > 0 && <span>· {Number(r.hours).toFixed(1)}h</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {showDue && r.progress != null && r.progress > 0 && <span className="text-xs font-semibold text-slate-600">{r.progress}%</span>}
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>{label(r.status)}</span>
                  {r.link && <ChevronRight className="h-4 w-4 text-slate-400" />}
                </div>
              </div>
            );
            return <li key={r.key}>{r.link ? <Link to={r.link}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
