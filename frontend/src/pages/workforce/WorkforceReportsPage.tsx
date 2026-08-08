import { useEffect, useState } from "react";
import { workforceApi } from "@/api/workforceApi";

const REPORTS = [
  { key: "workforce-availability", label: "Workforce Availability" },
  { key: "skills-matrix", label: "Skills Matrix" },
  { key: "active-workforce", label: "Active Workforce" },
  { key: "workforce-utilization", label: "Workforce Utilization" },
];

export default function WorkforceReportsPage() {
  const [active, setActive] = useState(REPORTS[0].key);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workforceApi.report(active).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [active]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active === r.key ? "bg-primary text-white border-primary" : "bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <ReportBody data={data} />}
      </div>
    </div>
  );
}

function ReportBody({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-sm text-muted-foreground">No data.</p>;

  // utilization: rows array
  if (Array.isArray((data as any).rows)) {
    const rows = (data as any).rows as any[];
    return (
      <table className="w-full text-sm">
        <thead className="text-slate-500 text-left">
          <tr><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2 text-center">Active Projects</th><th className="p-2">Status</th></tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="p-2 font-medium">{r.name}</td>
              <td className="p-2">{r.type}</td>
              <td className="p-2 text-center">{r.activeProjects}</td>
              <td className="p-2">{String(r.status).replace(/_/g, " ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // byStatus / bySkill: object of counts
  const buckets = ((data as any).byStatus || (data as any).bySkill) as Record<string, number> | undefined;
  if (buckets) {
    const entries = Object.entries(buckets);
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(data as any).available != null && (
          <Tile label="Available now" value={(data as any).available as number} />
        )}
        {entries.map(([k, v]) => <Tile key={k} label={k.replace(/_/g, " ")} value={v} />)}
      </div>
    );
  }

  // summary fallback
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Object.entries(data).map(([k, v]) => (
        <Tile key={k} label={k} value={typeof v === "number" ? v : String(v)} />
      ))}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-slate-500 capitalize">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
