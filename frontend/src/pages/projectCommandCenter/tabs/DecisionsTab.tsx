import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ClipboardCheck, FileEdit, Check, X, Loader2, CheckCircle2, Gavel } from "lucide-react";
import { projectApi } from "@/api/projectApi";
import { changeRequestApi } from "@/api/changeRequestApi";
import { ProjectChangeRequest, CHANGE_REQUEST_TYPE_LABELS } from "@/types/changeRequest";
import { ProjectPhase } from "@/types/project";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import ApprovalsTab from "./ApprovalsTab";
import ChangeRequestsTab from "./ChangeRequestsTab";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "ALL";
type Kind = "ALL" | "approval" | "change";
interface Decision {
  key: string;
  kind: "approval" | "change";
  id: number;
  title: string;
  sub?: string;
  text?: string;
  detail?: string;
  status: string; // raw status
  bucket: Exclude<Status, "ALL">;
  date?: string;
}

const STATUS_FILTERS: [Status, string][] = [["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["ALL", "All"]];
const bucketOf = (s?: string): Exclude<Status, "ALL"> => {
  const v = (s || "PENDING").toUpperCase();
  if (v === "REJECTED" || v === "CANCELLED") return "REJECTED";
  if (v === "PENDING" || v === "SUBMITTED" || v === "DRAFT") return "PENDING";
  return "APPROVED"; // APPROVED, COMPLETED, APPLIED…
};
const CHIP: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-700",
};

/**
 * Commercial › Approvals & Changes — every customer decision on the project in one list: approval
 * requests (design, material, stage, completion…) and change requests (scope/quote changes), with
 * status and type filters and the same approve / reject / apply actions as before.
 */
export default function DecisionsTab({ projectId, approvals, changeRequests, phases, onApprovalsChanged, onStatsChanged, onChangeRequestsChanged, onFullRefresh }: {
  projectId: number;
  approvals: any[];
  changeRequests: ProjectChangeRequest[];
  phases: ProjectPhase[];
  onApprovalsChanged: () => void;
  onStatsChanged: () => void;
  onChangeRequestsChanged: () => void;
  onFullRefresh: () => void;
}) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [kind, setKind] = useState<Kind>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const items: Decision[] = useMemo(() => {
    const a: Decision[] = (approvals || []).map((x: any) => ({
      key: `a-${x.id}`, kind: "approval", id: x.id,
      title: x.approvalType || "Approval",
      sub: "Customer approval",
      text: x.remarks,
      status: x.status || "PENDING", bucket: bucketOf(x.status),
      date: x.approvalDate || x.createdAt,
    }));
    const c: Decision[] = (changeRequests || []).map((cr) => ({
      key: `c-${cr.id}`, kind: "change", id: cr.id!,
      title: cr.reason || "Change request",
      sub: `${cr.requestNumber || "Change request"} · ${CHANGE_REQUEST_TYPE_LABELS[cr.changeType] || "Change"}${cr.requestedBy?.name ? ` · by ${cr.requestedBy.name}` : ""}`,
      detail: cr.description,
      status: cr.status || "PENDING", bucket: bucketOf(cr.status),
      date: (cr as any).createdAt,
    }));
    return [...a, ...c].sort((x, y) => {
      if (x.bucket === "PENDING" && y.bucket !== "PENDING") return -1;
      if (y.bucket === "PENDING" && x.bucket !== "PENDING") return 1;
      return String(y.date || "").localeCompare(String(x.date || ""));
    });
  }, [approvals, changeRequests]);

  const counts = useMemo(() => {
    const scoped = kind === "ALL" ? items : items.filter((i) => i.kind === kind);
    const c: Record<string, number> = { ALL: scoped.length };
    scoped.forEach((i) => { c[i.bucket] = (c[i.bucket] || 0) + 1; });
    return c;
  }, [items, kind]);
  const shown = items.filter((i) => (kind === "ALL" || i.kind === kind) && (status === "ALL" || i.bucket === status));

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, after: () => void) => {
    setBusy(key);
    try { await fn(); toast.success(ok); after(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || "Action failed"); }
    finally { setBusy(null); }
  };
  const afterApproval = () => { onApprovalsChanged(); onStatsChanged(); };

  const approve = (d: Decision) => d.kind === "approval"
    ? run(d.key, () => projectApi.approveApproval(d.id), "Approved", afterApproval)
    : (confirm("Approve and apply this change now? It creates a new BOQ revision and updates tasks, materials and the quotation.")
        && run(d.key, () => changeRequestApi.approve(d.id), "Change approved & applied", () => { onChangeRequestsChanged(); onFullRefresh(); }));
  const reject = (d: Decision) => {
    if (d.kind === "approval") return run(d.key, () => projectApi.rejectApproval(d.id), "Rejected", afterApproval);
    const reason = window.prompt("Reason for rejecting this change (optional):");
    if (reason === null) return;
    return run(d.key, () => changeRequestApi.reject(d.id, reason || undefined), "Change rejected", onChangeRequestsChanged);
  };
  const complete = (d: Decision) => run(d.key, () => changeRequestApi.complete(d.id), "Marked completed", onChangeRequestsChanged);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] @container">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><Gavel className="h-5 w-5 text-emerald-700" /> Approvals &amp; Changes</h3>
          {(counts.PENDING || 0) > 0 && kind === "ALL" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{counts.PENDING} pending</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ApprovalsTab projectId={projectId} approvals={approvals} onChanged={onApprovalsChanged} onStatsChanged={onStatsChanged} triggerOnly />
          <ChangeRequestsTab projectId={projectId} phases={phases} changeRequests={changeRequests}
            onChangeRequestsChanged={onChangeRequestsChanged} onFullRefresh={onFullRefresh} triggerOnly />
        </div>
      </div>

      <div className="px-3 pt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {STATUS_FILTERS.map(([f, label]) => (
            <button key={f} type="button" onClick={() => setStatus(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${status === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {label} <span className="text-slate-400">{counts[f] || 0}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {([["ALL", "All types"], ["approval", "Approvals"], ["change", "Changes"]] as [Kind, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${kind === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {shown.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Gavel className="h-5 w-5" /></span>
            <div className="mt-2 text-sm font-semibold text-slate-600">{status === "PENDING" ? "Nothing waiting for a decision" : "Nothing here"}</div>
            <div className="text-xs text-slate-400">Request a customer approval or log a change request from the buttons above.</div>
          </div>
        ) : shown.map((d) => {
          const isBusy = busy === d.key;
          const Icon = d.kind === "approval" ? ClipboardCheck : FileEdit;
          const raw = d.status.toUpperCase();
          return (
            <div key={d.key} className={`rounded-2xl border p-3.5 transition-shadow hover:shadow-md ${d.bucket === "PENDING" ? "border-amber-200 bg-amber-50/30" : "border-slate-100"}`}>
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${d.kind === "approval" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700"}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{d.title}</div>
                      <div className="text-[11px] text-slate-400">{d.sub}{d.date ? ` · ${format(new Date(d.date), "dd MMM yyyy")}` : ""}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${CHIP[raw] || CHIP[d.bucket]}`}>{raw.replace(/_/g, " ")}</span>
                  </div>
                  {d.text && <p className="mt-1.5 text-sm text-slate-600">{d.text}</p>}
                  {d.detail && <p className="mt-1 text-xs text-slate-500">{d.detail}</p>}

                  {(d.bucket === "PENDING" || (d.kind === "change" && raw === "APPROVED")) && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                      {isBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      {d.bucket === "PENDING" ? (
                        <>
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => reject(d)} className="h-8 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50">
                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                          <Button size="sm" disabled={isBusy} onClick={() => approve(d)} className="h-8 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white">
                            <Check className="h-3.5 w-3.5 mr-1" /> {d.kind === "change" ? "Approve & apply" : "Approve"}
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => complete(d)} className="h-8 rounded-xl">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark completed
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
