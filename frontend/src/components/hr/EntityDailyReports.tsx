import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { dailyReportApi, type AdminDailyReport } from "@/api/dailyReportApi";
import DailyReportCard from "@/components/hr/DailyReportCard";

/**
 * Daily reports an employee tagged to this project or lead, shown in place on the Project Command
 * Center / Lead profile. Managers can review inline. Pass exactly one of projectId / leadId.
 */
export default function EntityDailyReports({
  projectId,
  leadId,
  title = "Field Daily Reports",
}: {
  projectId?: number;
  leadId?: number;
  title?: string;
}) {
  const [reports, setReports] = useState<AdminDailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    dailyReportApi
      .list({ projectId, leadId })
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [projectId, leadId]);

  useEffect(() => { load(); }, [load]);

  const onReviewed = (u: AdminDailyReport) =>
    setReports((rs) => rs.map((r) => (r.id === u.id ? u : r)));

  return (
    <div className="bg-white border rounded-2xl shadow-sm">
      <div className="p-5 border-b flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className="ml-auto text-sm text-slate-500">{reports.length} total</span>
      </div>
      <div className="p-4 space-y-2.5">
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No daily reports linked here yet.</div>
        ) : (
          reports.map((r) => (
            <DailyReportCard key={r.id} report={r} onReviewed={onReviewed} showLinks={false} />
          ))
        )}
      </div>
    </div>
  );
}
