import { useState } from "react";
import { FileEdit, Plus } from "lucide-react";
import { changeRequestApi } from "@/api/changeRequestApi";
import { ProjectChangeRequest, ChangeRequestType, CHANGE_REQUEST_TYPE_LABELS, CHANGE_REQUEST_STATUS_STYLES } from "@/types/changeRequest";
import { ProjectPhase } from "@/types/project";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  projectId: number;
  phases: ProjectPhase[];
  changeRequests: ProjectChangeRequest[];
  /** Reload just the change-request list. */
  onChangeRequestsChanged: () => void;
  /** Approving cascades to BOQ/tasks/materials/quotation — reload everything. */
  onFullRefresh: () => void;
}

export default function ChangeRequestsTab({ projectId, phases, changeRequests, onChangeRequestsChanged, onFullRefresh }: Props) {
  const [newChangeRequest, setNewChangeRequest] = useState<{ changeType: ChangeRequestType; reason: string; description: string }>({
    changeType: 'CUSTOMER_REQUEST', reason: '', description: '',
  });
  const [changeRequestPhaseActions, setChangeRequestPhaseActions] = useState<Record<string, 'ACTIVATE' | 'DEACTIVATE'>>({});

  const handleCreate = () => {
    if (!newChangeRequest.reason) { toast.error("Enter a reason for this change request"); return; }
    changeRequestApi.create(projectId, newChangeRequest)
      .then(async (cr) => {
        const entries = Object.entries(changeRequestPhaseActions);
        for (const [phaseId, action] of entries) {
          await changeRequestApi.addPhaseAction(cr.id!, Number(phaseId), action);
        }
        setNewChangeRequest({ changeType: 'CUSTOMER_REQUEST', reason: '', description: '' });
        setChangeRequestPhaseActions({});
        onChangeRequestsChanged();
      })
      .catch(() => toast.error("Failed to submit change request"));
  };

  const handleApprove = (crId: number) => {
    if (!confirm("Approve and apply this change request now? This will create a new BOQ revision and cascade to tasks/materials/quotation.")) return;
    changeRequestApi.approve(crId)
      .then(() => { onChangeRequestsChanged(); onFullRefresh(); })
      .catch((err) => toast.error(err?.response?.data?.message || err?.message || "Failed to approve change request"));
  };

  const handleReject = (crId: number) => {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    changeRequestApi.reject(crId, reason).then(() => onChangeRequestsChanged())
      .catch(() => toast.error("Failed to reject change request"));
  };

  const handleComplete = (crId: number) => {
    changeRequestApi.complete(crId).then(() => onChangeRequestsChanged())
      .catch(() => toast.error("Failed to mark change request completed"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center"><FileEdit className="w-5 h-5 mr-2 text-emerald-600"/> Project Change Requests</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2"/> New Change Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Change Request</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Change Type</Label>
                <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newChangeRequest.changeType}
                  onChange={e => setNewChangeRequest({ ...newChangeRequest, changeType: e.target.value as ChangeRequestType })}>
                  {Object.entries(CHANGE_REQUEST_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input value={newChangeRequest.reason} onChange={e => setNewChangeRequest({ ...newChangeRequest, reason: e.target.value })} placeholder="e.g. Customer wants to reduce scope to Ground Floor only" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newChangeRequest.description}
                  onChange={e => setNewChangeRequest({ ...newChangeRequest, description: e.target.value })} />
              </div>
              {phases.length > 0 && (
                <div className="space-y-2">
                  <Label>Phase Actions (activate/deactivate on approval)</Label>
                  <div className="space-y-1.5 border rounded-md p-2">
                    {phases.map(phase => (
                      <div key={phase.id} className="flex items-center justify-between text-sm">
                        <span>{phase.name}</span>
                        <select className="border rounded px-2 py-1 text-xs"
                          value={changeRequestPhaseActions[phase.id!] || ''}
                          onChange={e => setChangeRequestPhaseActions({ ...changeRequestPhaseActions, [phase.id!]: e.target.value as 'ACTIVATE' | 'DEACTIVATE' })}>
                          <option value="">No change</option>
                          <option value="ACTIVATE">Activate</option>
                          <option value="DEACTIVATE">Deactivate</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button className="w-full" onClick={handleCreate}>Submit Change Request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {changeRequests.map(cr => (
          <div key={cr.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800">{cr.requestNumber}</h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${CHANGE_REQUEST_STATUS_STYLES[cr.status || 'PENDING']}`}>{cr.status}</span>
                </div>
                <div className="text-sm text-slate-500">{CHANGE_REQUEST_TYPE_LABELS[cr.changeType]} · requested by {cr.requestedBy?.name || '—'}</div>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-1">{cr.reason}</p>
            {cr.description && <p className="text-sm text-slate-500 mb-3">{cr.description}</p>}
            <div className="flex gap-2">
              {cr.status === 'PENDING' && (
                <>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(cr.id!)}>Approve &amp; Apply</Button>
                  <Button size="sm" variant="outline" onClick={() => handleReject(cr.id!)}>Reject</Button>
                </>
              )}
              {cr.status === 'APPROVED' && (
                <Button size="sm" variant="outline" onClick={() => handleComplete(cr.id!)}>Mark Completed</Button>
              )}
            </div>
          </div>
        ))}
        {changeRequests.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
            <FileEdit className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No change requests yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
