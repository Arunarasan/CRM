import { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  projectId: number;
  issues: any[];
  risks: any[];
  /** Refresh the core project blob. */
  onChanged: () => void;
  /** Refresh the header quick-stats (open-issue count). */
  onStatsChanged: () => void;
}

/** Active issues + risk matrix, both editable. */
export default function IssuesRisksTab({ projectId, issues, risks, onChanged, onStatsChanged }: Props) {
  const [newIssue, setNewIssue] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [newRisk, setNewRisk] = useState({ title: '', description: '', riskLevel: 'MEDIUM', mitigationPlan: '' });

  const handleAddIssue = () => {
    api.post(`/projects/${projectId}/issues`, newIssue)
      .then(() => { onChanged(); onStatsChanged(); setNewIssue({ title: '', description: '', priority: 'MEDIUM' }); })
      .catch(() => toast.error("Failed to add issue"));
  };

  const handleAddRisk = () => {
    if (!newRisk.title.trim()) { toast.error("Enter a risk title"); return; }
    api.post(`/projects/${projectId}/risks`, newRisk)
      .then(() => { onChanged(); setNewRisk({ title: '', description: '', riskLevel: 'MEDIUM', mitigationPlan: '' }); toast.success("Risk added"); })
      .catch(() => toast.error("Failed to add risk"));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

      {/* ISSUES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center"><AlertTriangle className="w-5 h-5 mr-2 text-red-500"/> Active Issues</h2>
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline">Report Issue</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Report Issue</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Title</Label><Input value={newIssue.title} onChange={e => setNewIssue({...newIssue, title: e.target.value})} /></div>
                <div className="space-y-2"><Label>Priority</Label>
                  <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newIssue.priority} onChange={e => setNewIssue({...newIssue, priority: e.target.value})}>
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>Description</Label>
                  <textarea className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm" value={newIssue.description} onChange={e => setNewIssue({...newIssue, description: e.target.value})} />
                </div>
                <Button className="w-full" onClick={handleAddIssue}>Submit Issue</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {issues.map((issue: any) => (
            <div key={issue.id} className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-red-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800">{issue.title}</h4>
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded uppercase">{issue.priority}</span>
              </div>
              <p className="text-sm text-slate-600">{issue.description}</p>
            </div>
          ))}
          {issues.length === 0 && <div className="text-slate-500 py-4">No active issues.</div>}
        </div>
      </div>

      {/* RISKS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center"><ShieldAlert className="w-5 h-5 mr-2 text-orange-500"/> Risk Matrix</h2>
          <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline">Add Risk</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Title</Label><Input value={newRisk.title} onChange={e => setNewRisk({...newRisk, title: e.target.value})} placeholder="e.g. Monsoon may delay exterior work" /></div>
                <div className="space-y-2"><Label>Risk Level</Label>
                  <select className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={newRisk.riskLevel} onChange={e => setNewRisk({...newRisk, riskLevel: e.target.value})}>
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="space-y-2"><Label>Description</Label>
                  <textarea className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm" value={newRisk.description} onChange={e => setNewRisk({...newRisk, description: e.target.value})} />
                </div>
                <div className="space-y-2"><Label>Mitigation Plan</Label>
                  <textarea className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm" value={newRisk.mitigationPlan} onChange={e => setNewRisk({...newRisk, mitigationPlan: e.target.value})} placeholder="How will this risk be managed?" />
                </div>
                <Button className="w-full" onClick={handleAddRisk}>Add Risk</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-3">
          {risks.map((risk: any) => (
            <div key={risk.id} className="bg-white p-4 rounded-xl border border-slate-100 border-l-4 border-l-orange-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-slate-800">{risk.title}</h4>
                <span className="text-xs font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded uppercase">{risk.riskLevel}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{risk.mitigationPlan}</p>
            </div>
          ))}
          {risks.length === 0 && <div className="text-slate-500 py-4">No logged risks.</div>}
        </div>
      </div>

    </div>
  );
}
