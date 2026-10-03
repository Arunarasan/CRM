import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  FileCheck2, Check, X, Loader2, Clock, IndianRupee, AlertTriangle, Package, MessageSquare, Image as ImageIcon,
} from "lucide-react";
import { dailyReportApi, type AdminDailyReport } from "@/api/dailyReportApi";
import { resolveFileUrl } from "@/lib/uploadFile";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type Filter = "SUBMITTED" | "REVIEWED" | "REJECTED" | "ALL";
const FILTERS: [Filter, string][] = [["SUBMITTED", "Pending"], ["REVIEWED", "Approved"], ["REJECTED", "Rejected"], ["ALL", "All"]];
const STATUS_CHIP: Record<string, [string, string]> = {
  SUBMITTED: ["Pending", "bg-amber-100 text-amber-800"],
  REVIEWED: ["Approved", "bg-emerald-100 text-emerald-800"],
  REJECTED: ["Rejected", "bg-rose-100 text-rose-700"],
};
const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

/**
 * Employee daily reports tagged to this project, with Approve / Reject. Rejecting needs a reason,
 * which the employee is notified with. Cash collected on a report is shown here; the money itself
 * is approved from Commercial › Payments.
 */
export default function ProjectReportsTab({ projectId, onCountsChanged }: { projectId: number; onCountsChanged?: () => void }) {
  const [reports, setReports] = useState<AdminDailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  const [busy, setBusy] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    dailyReportApi.list({ projectId })
      .then((rs) => setReports([...rs].sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate)))))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: reports.length };
    reports.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [reports]);
  const shown = filter === "ALL" ? reports : reports.filter((r) => r.status === filter);

  const replace = (u: AdminDailyReport) => { setReports((rs) => rs.map((r) => (r.id === u.id ? { ...r, ...u } : r))); onCountsChanged?.(); };

  const approve = async (r: AdminDailyReport) => {
    setBusy(r.id);
    try { replace(await dailyReportApi.review(r.id, comment.trim() || undefined)); toast.success("Report approved"); setComment(""); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not approve"); }
    finally { setBusy(null); }
  };
  const reject = async (r: AdminDailyReport) => {
    if (!comment.trim()) { toast.error("Write the reason for rejecting"); return; }
    setBusy(r.id);
    try { replace(await dailyReportApi.reject(r.id, comment.trim())); toast.success("Report rejected — employee notified"); setRejecting(null); setComment(""); }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not reject"); }
    finally { setBusy(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] @container">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-emerald-700" /> Employee Reports</h3>
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {label} <span className="text-slate-400">{counts[f] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {loading ? (
          <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><FileCheck2 className="h-5 w-5" /></span>
            <div className="mt-2 text-sm font-semibold text-slate-600">{filter === "SUBMITTED" ? "Nothing waiting for approval" : "No reports here"}</div>
            <div className="text-xs text-slate-400">Reports employees tag to this project show up here.</div>
          </div>
        ) : shown.map((r) => {
          const [chipLabel, chipTone] = STATUS_CHIP[r.status] || STATUS_CHIP.SUBMITTED;
          const pending = r.status === "SUBMITTED";
          const name = r.employee?.name || "Employee";
          return (
            <div key={r.id} className="rounded-2xl border border-slate-100 p-3.5 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 shrink-0">{name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{name}</div>
                  <div className="text-[11px] text-slate-400">{format(new Date(r.reportDate), "EEE, dd MMM yyyy")}{r.task?.title ? ` · ${r.task.title}` : ""}</div>
                </div>
                <span className="ml-auto flex flex-wrap items-center gap-1.5">
                  {r.hoursWorked != null && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700"><Clock className="h-3 w-3" /> {r.hoursWorked} h</span>}
                  {Number(r.cashCollected || 0) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800"><IndianRupee className="h-3 w-3" /> {inr(r.cashCollected).slice(1)} collected</span>}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${chipTone}`}>{chipLabel}</span>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 @2xl:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400">Work done</div>
                  <p className="text-slate-700 whitespace-pre-line">{r.completedWork || r.todaysWork || "—"}</p>
                </div>
                {r.pendingWork && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400">Pending</div>
                    <p className="text-slate-700 whitespace-pre-line">{r.pendingWork}</p>
                  </div>
                )}
              </div>
              {(r.problems || r.materialRequired) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {r.problems && <span className="inline-flex items-start gap-1.5 rounded-xl bg-rose-50 px-2.5 py-1.5 text-rose-700"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {r.problems}</span>}
                  {r.materialRequired && <span className="inline-flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-amber-800"><Package className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Needs: {r.materialRequired}</span>}
                </div>
              )}
              {r.media?.length > 0 && (
                <div className="mt-2.5 flex gap-2 overflow-x-auto">
                  {r.media.map((m, i) => (
                    <a key={m.id ?? i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="shrink-0">
                      {m.mediaType === "PHOTO"
                        ? <img src={resolveFileUrl(m.fileUrl)} alt={m.caption || "photo"} className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" />
                        : <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200"><ImageIcon className="h-5 w-5" /></span>}
                    </a>
                  ))}
                </div>
              )}
              {r.managerComment && !pending && (
                <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" /> {r.managerComment}
                </div>
              )}

              {pending && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {rejecting === r.id ? (
                    <div className="flex flex-col @xl:flex-row gap-2">
                      <input autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for rejecting (sent to the employee)"
                        className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-100" />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setRejecting(null); setComment(""); }}>Cancel</Button>
                        <Button size="sm" disabled={busy === r.id} onClick={() => reject(r)} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white">
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject report"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => { setComment(""); setRejecting(r.id); }}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button size="sm" disabled={busy === r.id} onClick={() => approve(r)} className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
                        {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Approve</>}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
