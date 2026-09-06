import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import ProjectTaskManager from "./ProjectTaskManager";

/**
 * Project → Execution → Tasks list. Each field task links to its full execution report page
 * (start/end time, who worked, check-ins, work steps, progress+photos, materials, issues) so a
 * manager can see WHAT was really done, not just the status. Assignment is handled inline by the
 * ProjectTaskManager above.
 */
export default function FieldProgressTab({ projectId, fieldTasks, onChanged }: { projectId: number; fieldTasks: any[]; onChanged?: () => void }) {
  const navigate = useNavigate();
  const openReport = (taskId: number) => navigate(`/projects/${projectId}/tasks/${taskId}`);

  return (
    <div className="space-y-6">
      {/* Admin task manager — one-click auto-assign to cut manual assignment work */}
      <ProjectTaskManager projectId={projectId} onChanged={onChanged} />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Field Task Execution</h3>
          <span className="text-xs text-slate-500">
            {fieldTasks.filter((t: any) => t.status === 'COMPLETED').length} / {fieldTasks.length} completed
          </span>
        </div>
        <div className="divide-y">
          {fieldTasks.map((task: any) => (
            <div
              key={task.id}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
              role="button"
              tabIndex={0}
              onClick={() => openReport(task.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openReport(task.id); } }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{task.taskName}</p>
                <p className="text-xs text-slate-500">{task.room?.roomName || task.phase?.name || 'Unassigned location'}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${
                  task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                  : task.status === 'WAITING_APPROVAL' ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
                }`}>
                  {task.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">View details</span>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </div>
            </div>
          ))}
          {fieldTasks.length === 0 && <div className="text-slate-500 text-center py-12">No field tasks generated for this project yet.</div>}
        </div>
      </div>
    </div>
  );
}
