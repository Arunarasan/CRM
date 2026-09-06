import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { ArrowLeft, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoBack } from "@/hooks/useGoBack";
import TaskExecutionReport from "@/components/projects/TaskExecutionReport";

/**
 * Full-page task execution report — the "what really happened" detail for one field task, opened
 * from the Project → Execution → Tasks list. All data comes from GET /api/employee-tasks/{id}
 * (rich detail) plus GET /api/tasks/{id}/assignments (roster with resolved contractor names).
 */
export default function TaskReportPage() {
  const { id: projectId, taskId } = useParams();
  const goBack = useGoBack(projectId ? `/projects/${projectId}` : "/tasks");
  const [detail, setDetail] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.get(`/employee-tasks/${taskId}`).then(res => res.data?.data ?? res.data),
      api.get(`/tasks/${taskId}/assignments`).then(res => res.data).catch(() => []),
    ])
      .then(([d, a]) => { setDetail(d); setAssignments(a || []); })
      .catch(err => {
        console.error("Failed to load task report", err);
        setError(err?.response?.data?.message || "Could not load this task's details.");
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const status: string | undefined = detail?.status;
  const statusStyle = status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
    : status === 'WAITING_APPROVAL' ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-700';

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-4 flex items-start gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={goBack} title="Back" className="mt-0.5 text-slate-400 hover:text-slate-600 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-800 truncate">
              {detail?.taskName || detail?.title || (loading ? 'Loading…' : 'Task Details')}
            </h1>
            {status && (
              <span className={`px-2.5 py-0.5 text-[11px] rounded-full font-semibold uppercase tracking-wide ${statusStyle}`}>
                {status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="text-slate-400 flex items-center gap-3 text-xs sm:text-sm mt-1.5 flex-wrap">
            {detail?.customer && <span className="flex items-center gap-1"><User className="w-4 h-4" /> {detail.customer}</span>}
            {(detail?.floor || detail?.location) && (
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-emerald-400" /> {[detail.floor, detail.location].filter(Boolean).join(' · ')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-slate-500 py-12 text-center">Loading task details…</div>
          ) : error ? (
            <div className="text-rose-600 py-12 text-center">{error}</div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-7">
              <TaskExecutionReport task={detail} detail={detail} assignments={assignments} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
