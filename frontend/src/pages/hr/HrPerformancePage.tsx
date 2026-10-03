import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Gauge } from "lucide-react";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import { gradeStyle } from "./PerformanceScoreCard";
import { CardStat, FilterChips, PersonChip, SearchField, StatTile } from "@/pages/workforce/hrUi";

/**
 * Auto-calculated performance scorecards for every employee. Extracted from the old
 * Human Resources "Performance" tab when HR + Workforce merged into one module.
 */
type Sort = "score" | "low" | "name";

export default function HrPerformancePage() {
  const navigate = useNavigate();
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("score");

  useEffect(() => {
    api.get(`/hr/performance/scores`).then(res => setScores(res.data || [])).catch(() => setScores([])).finally(() => setLoading(false));
  }, []);

  const scored = scores.filter(s => s.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;
  const top = [...scored].sort((a, b) => b.score - a.score)[0];
  const dist = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  scored.forEach(s => { if (dist[s.grade] != null) dist[s.grade]++; });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = scores.filter((s) => !q || `${s.employeeName} ${s.designation ?? ""} ${s.department ?? ""}`.toLowerCase().includes(q));
    const val = (s: any) => (s.score == null ? -1 : s.score);
    return list.sort((a, b) =>
      sort === "name" ? String(a.employeeName).localeCompare(String(b.employeeName))
        : sort === "low" ? (a.score == null ? 1 : b.score == null ? -1 : a.score - b.score)
        : val(b) - val(a));
  }, [scores, search, sort]);

  const scoreCell = (s: any) => {
    const gs = gradeStyle(s.grade);
    return (
      <div className="min-w-[8rem]">
        <div className="flex items-center gap-2">
          <span className="w-8 text-lg font-semibold tabular-nums text-slate-900">{s.score != null ? s.score : "—"}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${gs.bg} ${gs.text}`}>{gs.label}</span>
        </div>
        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary" style={{ width: `${s.score ?? 0}%` }} />
        </div>
      </div>
    );
  };
  const part = (score: any, sub: string) => (
    <div>
      <div className="font-medium tabular-nums text-slate-900">{score != null ? score : "—"}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
  const att = (s: any) => part(s.attendance?.score, `${s.attendance?.present ?? 0} present · ${s.attendance?.absent ?? 0} absent`);
  const tasks = (s: any) => part(s.tasks?.score, `${s.tasks?.completed ?? 0}/${s.tasks?.total ?? 0} done`);
  const reviews = (s: any) => part(s.reviews?.score, `${s.reviews?.avgRating ?? "—"}/5 · ${s.reviews?.count ?? 0} reviews`);
  const who = (s: any) => <PersonChip name={s.employeeName} sub={`${s.designation || "Employee"}${s.department ? ` · ${s.department}` : ""}`} to={`/hr/employees/${s.employeeId}`} />;

  const columns: Column<any>[] = [
    { key: "who", header: "Employee", cell: who },
    { key: "score", header: "Overall", cell: scoreCell },
    { key: "att", header: "Attendance", cell: att },
    { key: "tasks", header: "Tasks", cell: tasks },
    { key: "reviews", header: "Reviews", cell: reviews },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Team average" value={avg != null ? <>{avg}<span className="text-sm font-normal text-slate-400">/100</span></> : "—"} />
        <StatTile label="Scored" value={<>{scored.length}<span className="text-sm font-normal text-slate-400">/{scores.length}</span></>} hint="with enough data" />
        <StatTile label="Top performer" value={top ? top.employeeName : "—"} hint={top ? `${top.score}/100 · Grade ${top.grade}` : undefined} tone={top ? "success" : "neutral"} />
        <div className="min-w-0 rounded-xl border bg-card p-3 shadow-sm md:p-4">
          <div className="text-xs font-medium text-slate-500">Grade spread</div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
            {(["A", "B", "C", "D"] as const).map((g) => dist[g] > 0 && (
              <div key={g} className={g === "A" ? "bg-emerald-600" : g === "B" ? "bg-emerald-400" : g === "C" ? "bg-amber-400" : "bg-rose-500"}
                style={{ width: `${(dist[g] / Math.max(1, scored.length)) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs tabular-nums text-slate-600">
            {(["A", "B", "C", "D"] as const).map((g) => <span key={g}><b className="text-slate-900">{g}</b> {dist[g]}</span>)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips<Sort> value={sort} onChange={setSort}
          options={[{ key: "score", label: "Highest first" }, { key: "low", label: "Needs attention" }, { key: "name", label: "A–Z" }]} />
        <SearchField value={search} onChange={setSearch} placeholder="Search name, role or department…" className="md:w-72" />
      </div>

      <ResponsiveList
        items={visible}
        columns={columns}
        getRowKey={(s) => s.employeeId}
        loading={loading}
        onRowClick={(s) => navigate(`/hr/employees/${s.employeeId}`)}
        emptyIcon={Gauge}
        emptyTitle={search ? "No employees match" : "No employees found"}
        renderCard={(s) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              {who(s)}
              <div className="shrink-0">{scoreCell(s)}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5">
              <CardStat label="Attendance" value={s.attendance?.score ?? "—"} />
              <CardStat label="Tasks" value={s.tasks?.score ?? "—"} />
              <CardStat label="Reviews" value={s.reviews?.score ?? "—"} />
            </div>
          </div>
        )}
      />
      <p className="text-xs text-slate-500">Scores combine attendance, task completion and customer reviews, and update automatically.</p>
    </div>
  );
}
