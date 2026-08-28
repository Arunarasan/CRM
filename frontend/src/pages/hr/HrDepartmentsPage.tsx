import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/**
 * Departments list + add dialog. Extracted from the old Human Resources "Departments"
 * tab when HR + Workforce merged into one module.
 */
export default function HrDepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<any>({ name: '', description: '' });

  const fetchData = () => {
    api.get(`/hr/departments`).then(res => setDepartments(res.data || []));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveDepartment = () => {
    api.post(`/hr/departments`, deptForm)
      .then(() => { setIsDeptOpen(false); setDeptForm({ name: '', description: '' }); fetchData(); })
      .catch(_err => alert("Failed to save department"));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Add Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} />
              </div>
              <Button onClick={handleSaveDepartment} className="w-full mt-4">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {departments.map(d => (
          <div key={d.id} className="bg-white border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{d.name}</h3>
            <p className="text-sm text-slate-500">{d.description}</p>
          </div>
        ))}
        {departments.length === 0 && (
          <div className="col-span-full bg-white border rounded-2xl p-8 text-center text-slate-500 shadow-sm">
            No departments yet.
          </div>
        )}
      </div>
    </div>
  );
}
