import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { NotebookPen, Plus, Users, CloudSun, AlertTriangle, CheckCircle2, Clock, X, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { BaseInput } from "@/components/ui/input";

const emptyLog = () => ({ logDate: format(new Date(), 'yyyy-MM-dd'), percentageCompleted: 0, workCompleted: '', workPending: '', issues: '', weather: '', manpower: 0 });
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200";

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE');
};

/** Daily execution logs — the site diary, as a dated timeline with an inline "add today's log" form. */
export default function DailyLogsTab({ projectId, dailyLogs, onChanged }: { projectId: number; dailyLogs: any[]; onChanged: () => void }) {
  const [form, setForm] = useState(emptyLog());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!form.workCompleted.trim()) { toast.error("Write what work was done"); return; }
    setSaving(true);
    api.post(`/projects/${projectId}/daily-logs`, form)
      .then(() => { toast.success("Daily log added"); onChanged(); setForm(emptyLog()); setOpen(false); })
      .catch(() => toast.error("Failed to add log"))
      .finally(() => setSaving(false));
  };

  const logs = [...(dailyLogs || [])].sort((a, b) => String(b.logDate).localeCompare(String(a.logDate)));

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] @container">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><NotebookPen className="w-5 h-5 text-emerald-700" /> Daily Logs</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{logs.length}</span>
        </div>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)} className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add today's log
          </Button>
        )}
      </div>

      {open && (
        <div className="m-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-slate-800">New daily log</div>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Work completed *</span>
              <textarea className={`${field} min-h-[72px]`} value={form.workCompleted} onChange={e => setForm({ ...form, workCompleted: e.target.value })} placeholder="What got done on site today" />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500">Work pending</span>
              <textarea className={`${field} min-h-[72px]`} value={form.workPending} onChange={e => setForm({ ...form, workPending: e.target.value })} placeholder="What is still left" />
            </label>
            <label className="space-y-1 @2xl:col-span-2">
              <span className="text-[11px] font-semibold text-slate-500">Issues / blockers</span>
              <BaseInput className={field} value={form.issues} onChange={e => setForm({ ...form, issues: e.target.value })} placeholder="Anything stopping the work (optional)" />
            </label>
            <div className="grid grid-cols-3 gap-3 @2xl:col-span-2">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Date</span>
                <BaseInput type="date" className={field} value={form.logDate} onChange={e => setForm({ ...form, logDate: e.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Manpower</span>
                <BaseInput type="number" min={0} className={field} value={form.manpower} onChange={e => setForm({ ...form, manpower: Number(e.target.value) })} />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Weather</span>
                <BaseInput className={field} value={form.weather} onChange={e => setForm({ ...form, weather: e.target.value })} placeholder="Sunny" />
              </label>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={save} className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save log
            </Button>
          </div>
        </div>
      )}

      <div className="p-4">
        {logs.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><NotebookPen className="h-5 w-5" /></span>
            <div className="mt-2 text-sm font-semibold text-slate-600">No daily logs yet</div>
            <div className="text-xs text-slate-400">Record each day's site work to build the project diary.</div>
          </div>
        ) : (
          <ol className="relative space-y-4 before:absolute before:left-[23px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {logs.map((log: any) => {
              const d = new Date(log.logDate);
              const who = log.reportedBy?.name || log.reportedBy?.username;
              const hasIssue = log.issues && String(log.issues).trim();
              return (
                <li key={log.id} className="relative flex gap-3 @lg:gap-4">
                  <div className="relative z-10 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm">
                    <span className="text-base font-bold leading-none text-slate-900">{format(d, 'dd')}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{format(d, 'MMM')}</span>
                  </div>
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-sm font-bold text-slate-900">{dayLabel(log.logDate)}</span>
                      {who && <span className="text-xs text-slate-400">by {who}</span>}
                      <span className="ml-auto flex items-center gap-1.5">
                        {(log.manpower ?? 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"><Users className="h-3 w-3" /> {log.manpower}</span>}
                        {log.weather && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><CloudSun className="h-3 w-3" /> {log.weather}</span>}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 @2xl:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Work done</div>
                        <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{log.workCompleted || '—'}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700"><Clock className="h-3.5 w-3.5" /> Pending</div>
                        <p className="mt-0.5 text-sm text-slate-700 whitespace-pre-line">{log.workPending || '—'}</p>
                      </div>
                    </div>
                    {hasIssue && (
                      <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {log.issues}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
