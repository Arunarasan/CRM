import { useState } from "react";
import { CheckCircle2, Clock, Loader2, Rocket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BaseInput } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { projectRequestApi, type ProjectRequest } from "@/api/projectRequestApi";
import { resolveFileUrl } from "@/lib/uploadFile";

const METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];
const inr = (v?: number | null) => "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const when = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

/**
 * A field employee's "Customer Agreed" request on the lead's quote. Pending: the employee sees it waits for
 * an admin; an admin / project manager sees the advance and proof and approves (project created) or
 * rejects (quote opens again). Rejected: the reason, until the employee sends it again.
 */
export default function ProjectRequestBanner({ request, canDecide, onDecided }: {
  request: ProjectRequest;
  /** Admin / project manager — shows Approve & Reject. */
  canDecide: boolean;
  onDecided: () => void;
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = request.status === "PENDING";
  const rejected = request.status === "REJECTED";
  const hasAdvance = request.advanceAmount != null && Number(request.advanceAmount) > 0;

  const openApprove = () => {
    setAmount(hasAdvance ? String(request.advanceAmount) : "");
    setMethod(request.paymentMethod || "Cash");
    setApproveOpen(true);
  };

  const approve = async () => {
    if (amount.trim() && !(Number(amount.replace(/,/g, "")) >= 0)) { toast.error("Enter a valid advance amount."); return; }
    setBusy(true);
    try {
      await projectRequestApi.approve(request.id, { advanceAmount: amount.trim() || "0", paymentMethod: method });
      toast.success("Project created");
      setApproveOpen(false);
      onDecided();
    } catch (e) {
      toast.error(errMsg(e, "Could not approve the request."));
    } finally { setBusy(false); }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await projectRequestApi.reject(request.id, reason ?? "");
      toast.success("Request rejected — the quote is open again");
      setReason(null);
      onDecided();
    } catch (e) {
      toast.error(errMsg(e, "Could not reject the request."));
    } finally { setBusy(false); }
  };

  if (!pending && !rejected) return null;

  return (
    <>
      <div className={`rounded-lg border p-3 text-sm ${pending ? "border-amber-300 bg-amber-50 text-amber-950" : "border-red-200 bg-red-50 text-red-900"}`}>
        <div className="flex flex-wrap items-start gap-2">
          {pending ? <Clock className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {pending
                ? canDecide ? "Waiting for your approval to create the project" : "Sent to admin — waiting for approval"
                : `Project request rejected${request.decidedByName ? ` by ${request.decidedByName}` : ""}`}
            </p>
            <p className="mt-0.5 text-[12.5px] opacity-90">
              {request.requestedByName || "An employee"} · {when(request.requestedAt)}
              {request.quotationNumber ? ` · Quote ${request.quotationNumber}` : ""}
              {request.quoteTotal != null ? ` · ${inr(request.quoteTotal)}` : ""}
            </p>
            {rejected && (
              <p className="mt-1.5">
                {request.decisionNote ? <><span className="font-medium">Reason:</span> {request.decisionNote}. </> : null}
                The quote is open again — fix it and send it again.
              </p>
            )}
            {pending && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span>
                  <span className="text-[12px] uppercase tracking-wide opacity-75">Advance </span>
                  <span className="font-semibold">{hasAdvance ? inr(request.advanceAmount) : "None yet"}</span>
                  {hasAdvance && request.paymentMethod ? ` · ${request.paymentMethod}` : ""}
                  {hasAdvance && request.referenceNumber ? ` · Ref ${request.referenceNumber}` : ""}
                </span>
                {request.proofUrl && (
                  <a href={resolveFileUrl(request.proofUrl)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-white px-1.5 py-1 text-[12px] font-medium">
                    <img src={resolveFileUrl(request.proofUrl)} alt="" className="h-7 w-7 rounded object-cover" /> Payment proof
                  </a>
                )}
              </div>
            )}
            {pending && request.note && <p className="mt-1.5 text-[12.5px]"><span className="font-medium">Note:</span> {request.note}</p>}
          </div>
          {pending && canDecide && (
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <Button size="sm" variant="outline" className="flex-1 border-red-300 bg-background text-red-700 hover:bg-red-50 sm:flex-none"
                disabled={busy} onClick={() => setReason("")}>
                <XCircle className="mr-1.5 h-4 w-4" /> Reject
              </Button>
              <Button size="sm" className="flex-1 bg-[#16805C] text-white hover:bg-[#126B4C] sm:flex-none" disabled={busy} onClick={openApprove}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Approve → create the project; the advance can be corrected after checking it. */}
      <Dialog open={approveOpen} onOpenChange={(o) => !busy && setApproveOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-[#16805C]" /> Approve & create project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              The project is created from quote {request.quotationNumber || ""}
              {request.quoteTotal != null ? ` (${inr(request.quoteTotal)})` : ""}. Check the advance below — it's
              recorded as a confirmed payment collected by {request.requestedByName || "the employee"}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Advance received ₹</label>
                <BaseInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  {[...new Set([method, ...METHODS])].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {request.referenceNumber && <p className="text-xs text-muted-foreground">Reference: {request.referenceNumber}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={approve} disabled={busy} className="bg-[#16805C] text-white hover:bg-[#126B4C]">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Approve & Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject → the quote opens again; the employee is told why. */}
      <Dialog open={reason != null} onOpenChange={(o) => !o && !busy && setReason(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject project request?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              No project is created. The quote opens again so it can be fixed and sent again, and
              {` ${request.requestedByName || "the employee"}`} is notified.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason (sent to the employee)</label>
              <textarea value={reason ?? ""} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="e.g. Advance not received in the account yet — confirm with the customer"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReason(null)} disabled={busy}>Cancel</Button>
            <Button onClick={reject} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
