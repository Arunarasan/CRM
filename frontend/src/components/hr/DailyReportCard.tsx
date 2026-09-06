import { useState } from "react";
import { CalendarDays, User as UserIcon, FolderKanban, Target, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { resolveFileUrl } from "@/lib/uploadFile";
import { toast } from "@/components/ui/toast";
import { dailyReportApi, type AdminDailyReport } from "@/api/dailyReportApi";

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : format(d, "EEE, MMM d, yyyy");
};

/**
 * One employee daily report rendered in full. Used on the admin Daily Reports page, the HR
 * employee profile, and embedded on Project / Lead pages. When `onReviewed` is provided the
 * manager gets a "Mark reviewed" box; omit it (e.g. read-only embeds) to hide the action.
 */
export default function DailyReportCard({
  report,
  onReviewed,
  defaultOpen = false,
  showEmployee = true,
  showLinks = true,
}: {
  report: AdminDailyReport;
  onReviewed?: (updated: AdminDailyReport) => void;
  defaultOpen?: boolean;
  showEmployee?: boolean;
  showLinks?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [comment, setComment] = useState(report.managerComment ?? "");
  const [saving, setSaving] = useState(false);
  const reviewed = report.status === "REVIEWED";

  const submitReview = async () => {
    setSaving(true);
    try {
      const updated = await dailyReportApi.review(report.id, comment.trim() || undefined);
      toast.success("Report marked as reviewed");
      onReviewed?.(updated);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
            {fmtDate(report.reportDate)}
            {report.hoursWorked != null && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-slate-500">
                <Clock className="w-3 h-3" /> {Number(report.hoursWorked)}h
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {showEmployee && report.employee?.name && (
              <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {report.employee.name}</span>
            )}
            {showLinks && report.project?.projectName && (
              <span className="flex items-center gap-1"><FolderKanban className="w-3 h-3" /> {report.project.projectName}</span>
            )}
            {showLinks && report.lead?.name && (
              <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {report.lead.name}</span>
            )}
          </div>
          {!open && report.todaysWork && (
            <p className="mt-1 line-clamp-1 text-sm text-slate-600">{report.todaysWork}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            reviewed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {reviewed ? "Reviewed" : "New"}
        </span>
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-3">
          <Field label="Today's work" value={report.todaysWork} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Completed" value={report.completedWork} />
            <Field label="Pending" value={report.pendingWork} />
            <Field label="Problems / blockers" value={report.problems} />
            <Field label="Remarks" value={report.remarks} />
            <Field label="Material used" value={report.materialUsed} />
            <Field label="Material required" value={report.materialRequired} />
          </div>

          {report.media?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Photos / Videos</p>
              <div className="flex flex-wrap gap-2">
                {report.media.map((m, i) =>
                  m.mediaType === "VIDEO" ? (
                    <video key={i} src={resolveFileUrl(m.fileUrl)} controls className="h-24 w-32 rounded-lg border object-cover bg-black" />
                  ) : (
                    <a key={i} href={resolveFileUrl(m.fileUrl)} target="_blank" rel="noreferrer">
                      <img src={resolveFileUrl(m.fileUrl)} alt={m.caption ?? "photo"} className="h-24 w-24 rounded-lg border object-cover" />
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {report.managerComment && (
            <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 flex gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span><b>Manager:</b> {report.managerComment}</span>
            </div>
          )}

          {onReviewed && (
            <div className="pt-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a comment for the employee (optional)…"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={submitReview}
                disabled={saving}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? "Saving…" : reviewed ? "Update review" : "Mark reviewed"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
