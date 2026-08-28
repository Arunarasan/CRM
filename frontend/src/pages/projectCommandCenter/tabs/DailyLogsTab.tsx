import { useState } from "react";
import { format } from "date-fns";
import { PenTool, User } from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const emptyLog = () => ({ logDate: format(new Date(), 'yyyy-MM-dd'), percentageCompleted: 0, workCompleted: '', workPending: '', issues: '', weather: '', manpower: 0 });

/** Daily execution logs — site diary entries recorded per day. */
export default function DailyLogsTab({ projectId, dailyLogs, onChanged }: { projectId: number; dailyLogs: any[]; onChanged: () => void }) {
  const [newDailyLog, setNewDailyLog] = useState(emptyLog());

  const handleAddDailyLog = () => {
    api.post(`/projects/${projectId}/daily-logs`, newDailyLog)
      .then(() => { onChanged(); setNewDailyLog(emptyLog()); })
      .catch(() => toast.error("Failed to add log"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Daily Execution Logs</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button><PenTool className="w-4 h-4 mr-2"/> New Daily Log</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Daily Log</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={newDailyLog.logDate} onChange={e => setNewDailyLog({...newDailyLog, logDate: e.target.value})} /></div>
              <div className="space-y-2"><Label>Work Completed</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newDailyLog.workCompleted} onChange={e => setNewDailyLog({...newDailyLog, workCompleted: e.target.value})} /></div>
              <div className="space-y-2"><Label>Work Pending</Label><textarea className="w-full min-h-[80px] p-2 rounded-md border text-sm" value={newDailyLog.workPending} onChange={e => setNewDailyLog({...newDailyLog, workPending: e.target.value})} /></div>
              <div className="space-y-2"><Label>Issues / Blockers</Label><textarea className="w-full min-h-[60px] p-2 rounded-md border text-sm" value={newDailyLog.issues} onChange={e => setNewDailyLog({...newDailyLog, issues: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Manpower</Label><Input type="number" value={newDailyLog.manpower} onChange={e => setNewDailyLog({...newDailyLog, manpower: Number(e.target.value)})} /></div>
                <div className="space-y-2"><Label>Weather</Label><Input value={newDailyLog.weather} onChange={e => setNewDailyLog({...newDailyLog, weather: e.target.value})} /></div>
              </div>
              <Button className="w-full" onClick={handleAddDailyLog}>Submit Log</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {dailyLogs.map((log: any) => (
          <div key={log.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-semibold text-slate-700">
                <User className="w-4 h-4 text-slate-400" /> {log.reportedBy?.username || 'User'}
              </div>
              <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-700">
                {format(new Date(log.logDate), 'MMMM d, yyyy')}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Work Completed</span>
                <p className="text-sm text-slate-700">{log.workCompleted || '-'}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Work Pending</span>
                <p className="text-sm text-slate-700">{log.workPending || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-50 mt-2">
              <div><span className="text-xs font-bold text-slate-400 uppercase">Manpower:</span> <span className="text-sm font-semibold ml-2">{log.manpower}</span></div>
              <div><span className="text-xs font-bold text-slate-400 uppercase">Weather:</span> <span className="text-sm font-semibold ml-2">{log.weather || '-'}</span></div>
              <div><span className="text-xs font-bold text-slate-400 uppercase">Issues:</span> <span className="text-sm font-semibold ml-2 text-red-500">{log.issues || 'None'}</span></div>
            </div>
          </div>
        ))}
        {dailyLogs.length === 0 && <div className="text-slate-500 text-center py-12">No daily logs recorded yet.</div>}
      </div>
    </div>
  );
}
