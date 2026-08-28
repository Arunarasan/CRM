import { useState } from "react";
import { format } from "date-fns";
import api from "@/lib/api";
import { resolveFileUrl } from "@/lib/uploadFile";
import ProjectTaskManager from "./ProjectTaskManager";

/**
 * Read-only view into the mobile Employee Task module's live execution data — assignments,
 * progress updates with photos, materials used and issues reported — so a manager can see HOW
 * the work was done, not just the status. Assignments and full detail are lazy-loaded per task.
 */
export default function FieldProgressTab({ projectId, fieldTasks, onChanged }: { projectId: number; fieldTasks: any[]; onChanged?: () => void }) {
  const [expandedFieldTask, setExpandedFieldTask] = useState<number | null>(null);
  const [fieldTaskAssignments, setFieldTaskAssignments] = useState<Record<number, any[]>>({});
  const [fieldTaskDetails, setFieldTaskDetails] = useState<Record<number, any>>({});

  const toggleExpandFieldTask = (taskId: number) => {
    if (expandedFieldTask === taskId) {
      setExpandedFieldTask(null);
      return;
    }
    setExpandedFieldTask(taskId);
    if (!fieldTaskAssignments[taskId]) {
      api.get(`/tasks/${taskId}/assignments`).then(res => setFieldTaskAssignments(prev => ({ ...prev, [taskId]: res.data })));
    }
    if (!fieldTaskDetails[taskId]) {
      api.get(`/employee-tasks/${taskId}`)
        .then(res => setFieldTaskDetails(prev => ({ ...prev, [taskId]: res.data?.data ?? res.data })))
        .catch(err => {
          console.error("Failed to fetch task execution detail", err);
          // Show the empty state rather than a perpetual "Loading…" (e.g. a PM without task-read access).
          setFieldTaskDetails(prev => ({ ...prev, [taskId]: { progress: [], materialUsage: [], issues: [] } }));
        });
    }
  };

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
          <div key={task.id}>
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
              role="button"
              tabIndex={0}
              onClick={() => toggleExpandFieldTask(task.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpandFieldTask(task.id); } }}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{task.taskName}</p>
                <p className="text-xs text-slate-500">{task.room?.roomName || task.phase?.name || 'Unassigned location'}</p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-bold shrink-0 ml-3">
                {task.status?.replace(/_/g, ' ')}
              </span>
            </div>
            {expandedFieldTask === task.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                {(fieldTaskAssignments[task.id] || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No employees assigned yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="py-1 font-medium">Employee</th>
                        <th className="py-1 font-medium">Role</th>
                        <th className="py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldTaskAssignments[task.id].map((a: any) => (
                        <tr key={a.employeeId} className="border-t border-slate-200">
                          <td className="py-1.5">{a.employeeName}</td>
                          <td className="py-1.5">{a.role || '-'}</td>
                          <td className="py-1.5">{a.status?.replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {(() => {
                  const d = fieldTaskDetails[task.id];
                  if (!d) return <p className="text-xs text-slate-400 py-2">Loading work details…</p>;
                  const progress = d.progress || [];
                  const materials = d.materialUsage || [];
                  const issues = d.issues || [];
                  if (progress.length === 0 && materials.length === 0 && issues.length === 0)
                    return <p className="text-xs text-slate-400 py-2">No progress updates, photos, or materials logged yet.</p>;
                  return (
                    <div className="mt-3 space-y-3">
                      {progress.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Progress &amp; Photos</p>
                          <ul className="space-y-2">
                            {progress.map((p: any) => (
                              <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-700">{p.employeeName || 'Employee'}</span>
                                  <span className="text-slate-400">{p.createdAt ? format(new Date(p.createdAt), 'MMM d, h:mm a') : ''}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-[11px] mt-0.5">
                                  {p.progressPercent != null && <span className="text-emerald-600 font-medium">{p.progressPercent}% complete</span>}
                                  {p.timeSpentMinutes != null && <span className="text-slate-500">{p.timeSpentMinutes} min</span>}
                                </div>
                                {p.remarks && <p className="text-xs text-slate-700 mt-1">{p.remarks}</p>}
                                {p.media?.length > 0 && (
                                  <div className="mt-1.5 flex gap-2 overflow-x-auto">
                                    {p.media.map((m: any, i: number) => (
                                      (m.mediaType === 'PHOTO' || m.mediaType === 'Image') ? (
                                        <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="shrink-0">
                                          <img src={resolveFileUrl(m.fileUrl)} alt="work" className="h-16 w-16 rounded-md border object-cover" />
                                        </a>
                                      ) : (
                                        <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer"
                                           className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-slate-100 text-[10px] text-slate-500">
                                          {m.mediaType}
                                        </a>
                                      )
                                    ))}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {materials.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Materials Used</p>
                          <ul className="space-y-1">
                            {materials.map((m: any) => (
                              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                                <span className="min-w-0 truncate text-slate-700">{m.productName}</span>
                                <span className="shrink-0 text-slate-500">{String(m.quantityUsed)} {m.unit} · {m.usedByName}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {issues.length > 0 && (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Issues Reported</p>
                          <ul className="space-y-1">
                            {issues.map((i: any) => (
                              <li key={i.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                                <span className="font-medium text-slate-700">{(i.issueType || '').replace(/_/g, ' ')}</span>
                                {i.description ? ` — ${i.description}` : ''}
                                <span className="text-slate-400"> ({i.status})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
        {fieldTasks.length === 0 && <div className="text-slate-500 text-center py-12">No field tasks generated for this project yet.</div>}
      </div>
    </div>
    </div>
  );
}
