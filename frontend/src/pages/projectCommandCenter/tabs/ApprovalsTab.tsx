import { useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { projectApi } from "@/api/projectApi";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  projectId: number;
  approvals: any[];
  onChanged: () => void;
  onStatsChanged: () => void;
}

// Standard approval gates in the delivery lifecycle; "Other" lets the user type a custom one.
const APPROVAL_TYPES = ["Design Approval", "Material Approval", "Stage Approval", "Completion Approval", "Other"];

/** Customer approvals — request a new one, then approve/reject pending decisions. */
export default function ApprovalsTab({ projectId, approvals, onChanged, onStatsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ approvalType: "Design Approval", customType: "", remarks: "" });

  const handleDecide = (approvalId: number, approve: boolean) => {
    const action = approve ? projectApi.approveApproval(approvalId) : projectApi.rejectApproval(approvalId);
    action.then(() => { onChanged(); onStatsChanged(); }).catch(() => toast.error("Failed to update approval"));
  };

  const handleRequest = () => {
    const approvalType = form.approvalType === "Other" ? form.customType.trim() : form.approvalType;
    if (!approvalType) { toast.error("Enter what needs approval"); return; }
    setSaving(true);
    projectApi.createApproval(projectId, { approvalType, remarks: form.remarks || undefined })
      .then(() => {
        setOpen(false);
        setForm({ approvalType: "Design Approval", customType: "", remarks: "" });
        onChanged();
        onStatsChanged();
        toast.success("Approval requested");
      })
      .catch((e: any) => toast.error(e?.response?.data?.message || "Failed to request approval"))
      .finally(() => setSaving(false));
  };

  const pending = approvals?.filter((a: any) => a.status === "PENDING").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <ClipboardCheck className="w-5 h-5 mr-2 text-emerald-600"/> Customer Approvals
          {pending > 0 && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{pending} pending</span>}
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/> Request Approval</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Customer Approval</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>What needs approval?</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.approvalType} onChange={e => setForm({ ...form, approvalType: e.target.value })}>
                  {APPROVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.approvalType === "Other" && (
                <div className="space-y-2">
                  <Label>Custom approval title</Label>
                  <Input value={form.customType} onChange={e => setForm({ ...form, customType: e.target.value })} placeholder="e.g. Kitchen layout sign-off" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Note to customer (optional)</Label>
                <textarea className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm"
                  value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                  placeholder="What are they approving? Add context or a link." />
              </div>
              <Button className="w-full" onClick={handleRequest} disabled={saving}>{saving ? "Requesting…" : "Request Approval"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(approvals || []).map((a: any) => (
          <div key={a.id} className={`bg-white p-5 rounded-2xl border border-slate-100 border-l-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${a.status === 'APPROVED' ? 'border-l-green-500' : a.status === 'REJECTED' ? 'border-l-red-500' : 'border-l-orange-500'}`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-slate-800">{a.approvalType}</h4>
              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${a.status === 'APPROVED' ? 'bg-green-100 text-green-700' : a.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {a.status}
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-3">{a.remarks || '-'}</p>
            {a.status === 'PENDING' ? (
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecide(a.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => handleDecide(a.id, false)}>Reject</Button>
              </div>
            ) : a.approvalDate ? (
              <p className="text-xs text-slate-400">{a.status === 'APPROVED' ? 'Approved' : 'Rejected'} on {new Date(a.approvalDate).toLocaleDateString('en-IN')}</p>
            ) : null}
          </div>
        ))}
        {(!approvals || approvals.length === 0) && (
          <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No approvals requested yet.</p>
            <p className="mt-1 text-xs text-slate-400">Use "Request Approval" to send a design, material, or stage sign-off to the customer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
