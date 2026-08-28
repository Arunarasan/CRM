import { useState } from "react";
import { format } from "date-fns";
import { CheckSquare, ClipboardCheck } from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const emptyCheck = () => ({ checklistCategory: '', itemChecked: '', status: 'APPROVED', remarks: '', inspectionDate: format(new Date(), 'yyyy-MM-dd') });

/** Quality inspections recorded against the project. */
export default function QualityTab({ projectId, qualityChecks, onChanged }: { projectId: number; qualityChecks: any[]; onChanged: () => void }) {
  const [newQualityCheck, setNewQualityCheck] = useState(emptyCheck());

  const handleAddQualityCheck = () => {
    api.post(`/projects/${projectId}/quality-checks`, newQualityCheck)
      .then(() => { onChanged(); setNewQualityCheck(emptyCheck()); })
      .catch(() => toast.error("Failed to add check"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center"><ClipboardCheck className="w-5 h-5 mr-2 text-emerald-600"/> Quality Inspections</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button><CheckSquare className="w-4 h-4 mr-2"/> New Inspection</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Quality Check</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Category</Label><Input value={newQualityCheck.checklistCategory} onChange={e => setNewQualityCheck({...newQualityCheck, checklistCategory: e.target.value})} placeholder="e.g. Electrical, Plumbing" /></div>
              <div className="space-y-2"><Label>Item Checked</Label><Input value={newQualityCheck.itemChecked} onChange={e => setNewQualityCheck({...newQualityCheck, itemChecked: e.target.value})} /></div>
              <div className="space-y-2"><Label>Status</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newQualityCheck.status} onChange={e => setNewQualityCheck({...newQualityCheck, status: e.target.value})}>
                  <option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="REWORK_REQUIRED">Rework Required</option>
                </select>
              </div>
              <div className="space-y-2"><Label>Remarks</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newQualityCheck.remarks} onChange={e => setNewQualityCheck({...newQualityCheck, remarks: e.target.value})} /></div>
              <Button className="w-full" onClick={handleAddQualityCheck}>Submit Inspection</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {qualityChecks.map((qc: any) => (
          <div key={qc.id} className={`bg-white p-5 rounded-2xl border border-slate-100 border-l-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${qc.status === 'APPROVED' ? 'border-l-green-500' : qc.status === 'REJECTED' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-800">{qc.itemChecked}</h4>
              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${qc.status === 'APPROVED' ? 'bg-green-100 text-green-700' : qc.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {qc.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="text-sm font-medium text-slate-500 mb-2">{qc.checklistCategory}</div>
            <p className="text-sm text-slate-700">{qc.remarks || '-'}</p>
            <div className="mt-4 pt-3 border-t text-xs font-medium text-slate-400 flex justify-between">
              <span>Inspector: {qc.inspector?.username || 'Unknown'}</span>
              <span>{qc.inspectionDate ? format(new Date(qc.inspectionDate), 'MMM d, yyyy') : ''}</span>
            </div>
          </div>
        ))}
        {qualityChecks.length === 0 && <div className="md:col-span-2 text-slate-500 text-center py-12">No quality checks recorded yet.</div>}
      </div>
    </div>
  );
}
