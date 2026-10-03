import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { workforceApi } from "@/api/workforceApi";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { FilterChips, PersonChip, StatTile } from "./hrUi";

const REPORTS = [
  { key: "workforce-availability", label: "Availability", description: "Who is free to take work right now." },
  { key: "skills-matrix", label: "Skills", description: "How many people you have for each skill." },
  { key: "active-workforce", label: "Active workforce", description: "Headcount by type and status." },
  { key: "workforce-utilization", label: "Utilization", description: "Active projects per person." },
];

const humanize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

export default function WorkforceReportsPage() {
  const [active, setActive] = useState(REPORTS[0].key);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workforceApi.report(active).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [active]);

  const report = REPORTS.find((r) => r.key === active)!;

  return (
    <div className="space-y-4">
      <FilterChips options={REPORTS.map(({ key, label }) => ({ key, label }))} value={active} onChange={setActive} />
      <p className="text-sm text-muted-foreground">{report.description}</p>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" />)}
        </div>
      ) : <ReportBody data={data} />}
    </div>
  );
}

type UtilRow = { name: string; type: string; activeProjects: number; status: string };

function ReportBody({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <div className="rounded-xl border bg-card"><EmptyState icon={BarChart3} title="No data for this report yet" /></div>;

  // utilization: rows array
  if (Array.isArray((data as any).rows)) {
    const rows = ((data as any).rows as UtilRow[]).slice().sort((a, b) => b.activeProjects - a.activeProjects);
    const max = Math.max(1, ...rows.map((r) => r.activeProjects || 0));
    const bar = (r: UtilRow) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:w-32">
          <div className="h-full rounded-full bg-primary" style={{ width: `${((r.activeProjects || 0) / max) * 100}%` }} />
        </div>
        <span className="tabular-nums text-sm font-medium text-slate-900">{r.activeProjects}</span>
      </div>
    );
    const columns: Column<UtilRow>[] = [
      { key: "name", header: "Name", cell: (r) => <PersonChip name={r.name} size="sm" tone={r.type === "EMPLOYEE" ? "employee" : "contractor"} /> },
      { key: "type", header: "Type", cellClassName: "text-slate-600", cell: (r) => humanize(String(r.type)) },
      { key: "load", header: "Active projects", cell: bar },
      { key: "status", header: "Status", cellClassName: "text-slate-600", cell: (r) => humanize(String(r.status)) },
    ];
    return (
      <ResponsiveList items={rows} columns={columns} getRowKey={(r) => `${r.name}-${r.type}`}
        emptyIcon={BarChart3} emptyTitle="Nobody to report on yet"
        renderCard={(r) => (
          <div className="flex items-center justify-between gap-3">
            <PersonChip name={r.name} sub={`${humanize(String(r.type))} · ${humanize(String(r.status))}`} tone={r.type === "EMPLOYEE" ? "employee" : "contractor"} />
            {bar(r)}
          </div>
        )} />
    );
  }

  // byStatus / bySkill: object of counts
  const buckets = ((data as any).byStatus || (data as any).bySkill) as Record<string, number> | undefined;
  if (buckets) {
    const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {(data as any).available != null && (
          <StatTile label="Available now" value={(data as any).available as number} tone="success" />
        )}
        {entries.map(([k, v]) => <StatTile key={k} label={humanize(k)} value={v} />)}
      </div>
    );
  }

  // summary fallback
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {Object.entries(data).map(([k, v]) => (
        <StatTile key={k} label={humanize(k)} value={typeof v === "number" ? v : String(v)} />
      ))}
    </div>
  );
}
