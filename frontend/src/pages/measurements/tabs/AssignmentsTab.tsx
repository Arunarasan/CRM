import { useState } from "react";
import { Plus, Trash2, UserCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { measurementApi } from "@/api/measurementApi";
import { ASSIGNMENT_ROLES, type MeasurementAssignment, type UserSummary } from "@/types/measurement";
import { Field, TextAreaField, selectClass } from "../../leads/fields";
import { ListSkeleton } from "../../leads/tabs/shared";
import EmptyState from "../../customer360/components/EmptyState";
import { formatDateTime, initials, useMeasurementSubResource } from "../helpers";

const ASSIGNMENT_STATUS_STYLES: Record<string, string> = {
  Assigned: "bg-blue-100 text-blue-700",
  Accepted: "bg-indigo-100 text-indigo-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Declined: "bg-red-100 text-red-700",
};

export default function AssignmentsTab({ measurementId, employees, canAssign, canWrite, onChanged }: {
  measurementId: number; employees: UserSummary[]; canAssign: boolean; canWrite: boolean; onChanged: () => void;
}) {
  const { items: assignments, loading, reload } = useMeasurementSubResource<MeasurementAssignment>(
    () => measurementApi.getAssignments(measurementId), [measurementId]);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => { reload(); onChanged(); };

  const accept = (a: MeasurementAssignment) => a.id && measurementApi.acceptAssignment(measurementId, a.id).then(refresh).catch(console.error);
  const complete = (a: MeasurementAssignment) => a.id && measurementApi.completeAssignment(measurementId, a.id).then(refresh).catch(console.error);
  const remove = (a: MeasurementAssignment) => {
    if (!a.id || !confirm(`Remove ${a.employee?.name} from this measurement?`)) return;
    measurementApi.removeAssignment(measurementId, a.id).then(refresh).catch(console.error);
  };

  if (loading) return <ListSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{assignments.length} team member{assignments.length === 1 ? "" : "s"}</h3>
        {canAssign && <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-2" /> Assign Employee</Button>}
      </div>

      {assignments.length === 0 ? (
        <EmptyState icon={UserRound} title="No one assigned yet" description="Assign engineers, designers, project managers or supervisors to this measurement." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {assignments.map((a) => (
            <div key={a.id} className="border rounded-xl p-4 bg-card flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
                {initials(a.employee?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{a.employee?.name}</span>
                  <Badge className={ASSIGNMENT_STATUS_STYLES[a.status || ""] || ""}>{a.status || "Assigned"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{a.role}</div>
                <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                  {a.assignedDate && <div>Assigned {formatDateTime(a.assignedDate)}</div>}
                  {a.acceptedTime && <div>Accepted {formatDateTime(a.acceptedTime)}</div>}
                  {a.completedTime && <div>Completed {formatDateTime(a.completedTime)}</div>}
                </div>
                {a.remarks && <p className="text-xs text-muted-foreground mt-1">{a.remarks}</p>}
                <div className="flex gap-2 mt-2">
                  {canWrite && a.status === "Assigned" && (
                    <Button size="sm" variant="outline" onClick={() => accept(a)}><UserCheck className="h-3.5 w-3.5 mr-1" /> Accept</Button>
                  )}
                  {canWrite && a.status === "Accepted" && (
                    <Button size="sm" variant="outline" onClick={() => complete(a)}>Mark Complete</Button>
                  )}
                  {canAssign && (
                    <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AssignFormDialog open={formOpen} onOpenChange={setFormOpen} measurementId={measurementId} employees={employees} onSaved={refresh} />
    </div>
  );
}

function AssignFormDialog({ open, onOpenChange, measurementId, employees, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number; employees: UserSummary[]; onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState(ASSIGNMENT_ROLES[0]);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    setSaving(true);
    measurementApi.assignEmployee(measurementId, Number(employeeId), role, remarks || undefined)
      .then(() => { onOpenChange(false); setEmployeeId(""); setRemarks(""); onSaved(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Employee</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Role">
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
              {ASSIGNMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Employee" required>
            <select className={selectClass} required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select employee...</option>
              {employees.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </Field>
          <TextAreaField label="Remarks" value={remarks} onChange={setRemarks} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !employeeId}>{saving ? "Assigning..." : "Assign"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
