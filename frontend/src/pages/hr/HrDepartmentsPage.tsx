import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Building, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import EmptyState from "@/pages/customer360/components/EmptyState";
import { SectionHeader } from "@/pages/workforce/hrUi";

/**
 * Departments list + add dialog. Extracted from the old Human Resources "Departments"
 * tab when HR + Workforce merged into one module.
 */
export default function HrDepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deptForm, setDeptForm] = useState<any>({ name: '', description: '' });

  const fetchData = () => {
    api.get(`/hr/departments`).then(res => setDepartments(res.data || [])).catch(() => setDepartments([])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveDepartment = () => {
    if (!deptForm.name.trim()) { toast.error("Give the department a name."); return; }
    setSaving(true);
    api.post(`/hr/departments`, { ...deptForm, name: deptForm.name.trim() })
      .then(() => { setIsDeptOpen(false); setDeptForm({ name: '', description: '' }); toast.success("Department added."); fetchData(); })
      .catch(() => toast.error("Failed to save department."))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Departments"
        description="Group employees for filtering, reports and approvals."
        actions={<Button onClick={() => setIsDeptOpen(true)} className="w-full sm:w-auto"><Plus className="mr-1.5 h-4 w-4" /> Add department</Button>}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl border bg-card" />)}
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Building} title="No departments yet" description="Add departments like Installation, Stitching or Sales."
            action={<Button size="sm" onClick={() => setIsDeptOpen(true)}><Plus className="mr-1 h-4 w-4" /> Add department</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map(d => (
            <div key={d.id} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Building className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900">{d.name}</h3>
                <p className="line-clamp-2 text-sm text-slate-500">{d.description || "No description"}</p>
                <Link to="/workforce/people" state={{ department: d.name }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Users className="h-3.5 w-3.5" /> View people
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add department</DialogTitle>
            <DialogDescription>Departments appear in the directory filters and on each employee's profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input autoFocus value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="e.g. Installation" />
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="font-normal text-slate-400">(optional)</span></Label>
              <Input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIsDeptOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveDepartment} disabled={saving}>Save department</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
