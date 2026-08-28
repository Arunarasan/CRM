import { useEffect, useState } from "react";
import { Users, HardHat, User, Loader2, ListChecks } from "lucide-react";
import { projectApi, ProjectResource } from "@/api/projectApi";
import { Button } from "@/components/ui/button";

/**
 * Labour on this project — every employee and contractor assigned across the project's tasks,
 * one row per person with their task load. Read-only: assignment happens on the task/work-item,
 * this is the "who's working here" roll-up.
 */
export default function LabourTab({ projectId, onManageTasks }: { projectId: number; onManageTasks?: () => void }) {
  const [rows, setRows] = useState<ProjectResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    projectApi.getProjectResources(projectId)
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, [projectId]);

  const employees = rows.filter((r) => r.resourceType === "EMPLOYEE");
  const contractors = rows.filter((r) => r.resourceType !== "EMPLOYEE");
  const totalActive = rows.reduce((s, r) => s + r.activeTaskCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center"><Users className="w-5 h-5 mr-2 text-emerald-600"/> Labour on this Project</h2>
          <p className="text-sm text-slate-500 mt-0.5">Everyone assigned across this project's tasks. Assign more from a task or work item.</p>
        </div>
        {onManageTasks && (
          <Button variant="outline" onClick={onManageTasks}><ListChecks className="w-4 h-4 mr-1"/> Manage tasks</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tile label="People" value={String(rows.length)} />
        <Tile label="Employees" value={String(employees.length)} />
        <Tile label="Contractors" value={String(contractors.length)} />
        <Tile label="Open task-assignments" value={String(totalActive)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No one is assigned to this project's tasks yet.</p>
          <p className="mt-1 text-xs text-slate-400">Assign employees or contractors from a task or work item and they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {employees.length > 0 && <Group title="Employees" icon={<User className="w-4 h-4 text-emerald-600" />} rows={employees} />}
          {contractors.length > 0 && <Group title="Contractors" icon={<HardHat className="w-4 h-4 text-amber-600" />} rows={contractors} />}
        </div>
      )}
    </div>
  );
}

function Group({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: ProjectResource[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-3 border-b bg-slate-50 flex items-center gap-2 text-sm font-bold text-slate-700">{icon} {title} <span className="text-slate-400 font-medium">· {rows.length}</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr className="text-left border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Roles</th>
              <th className="p-3 text-right">Active tasks</th>
              <th className="p-3 text-right">Completed</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r) => (
              <tr key={`${r.resourceType}-${r.resourceId}`} className="hover:bg-slate-50">
                <td className="p-3 font-medium text-slate-800">{r.name}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {r.roles.length === 0 ? <span className="text-slate-400">—</span>
                      : r.roles.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{role}</span>)}
                  </div>
                </td>
                <td className="p-3 text-right font-semibold text-emerald-600">{r.activeTaskCount}</td>
                <td className="p-3 text-right text-emerald-600">{r.completedTaskCount}</td>
                <td className="p-3 text-right text-slate-500">{r.taskCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-xl font-black text-slate-900 mt-1">{value}</div>
    </div>
  );
}
