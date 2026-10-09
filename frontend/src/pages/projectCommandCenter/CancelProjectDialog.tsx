import { useEffect, useState } from "react";
import { Ban, Loader2, AlertTriangle, Undo2 } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

export interface CancellationInfo {
  status: string;
  cancellable: boolean;
  amountPaid: number;
  refundRequested: number;
  refunded: number;
  refundable: number;
  cancelledAt?: string;
  cancellationReason?: string;
  refunds: { id: number; refundNumber: string; amount: number; status: string; refundDate?: string; paymentMethod?: string }[];
}

const inr = (n?: number | null) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;
const METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"];

/**
 * Cancel a project at any stage, returning none, part or all of the advance. In "refund" mode (project
 * already cancelled) it only raises a further advance refund. A refund either waits for approval in
 * Finance → Refunds, or — when the money was already handed back — is approved and marked paid at once.
 */
export default function CancelProjectDialog({ projectId, mode, open, onClose, onDone }: {
  projectId: number | string;
  mode: "cancel" | "refund";
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [info, setInfo] = useState<CancellationInfo | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [paidNow, setPaidNow] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(""); setAmount(""); setPaidNow(false); setMethod("CASH"); setReference(""); setInfo(null);
    api.get(`/projects/${projectId}/cancellation`).then((r) => setInfo(r.data))
      .catch((e) => toast.error(apiError(e, "Could not load the payment position.")));
  }, [open, projectId]);

  const refundable = Number(info?.refundable || 0);
  const amt = amount === "" ? 0 : Number(amount);
  const amountInvalid = isNaN(amt) || amt < 0 || amt > refundable + 0.001 || (mode === "refund" && amt <= 0);
  const canSubmit = !!info && !saving && !amountInvalid && (mode === "refund" || reason.trim().length > 0);
  const setPct = (pct: number) => setAmount(pct === 0 ? "" : String(Math.round((refundable * pct) / 100)));

  const submit = async () => {
    setSaving(true);
    const body = { reason: reason.trim() || undefined, refundAmount: amt, refundPaidNow: amt > 0 && paidNow,
      paymentMethod: paidNow ? method : undefined, referenceNumber: paidNow ? reference.trim() || undefined : undefined };
    try {
      if (mode === "cancel") {
        await api.post(`/projects/${projectId}/cancel`, body);
        toast.success(amt > 0 ? `Project cancelled · refund ${inr(amt)} ${paidNow ? "paid" : "sent for approval"}.` : "Project cancelled.");
      } else {
        await api.post(`/projects/${projectId}/cancellation/refund`, body);
        toast.success(`Refund ${inr(amt)} ${paidNow ? "paid" : "sent for approval"}.`);
      }
      onClose();
      await onDone();
    } catch (e) {
      toast.error(apiError(e, mode === "cancel" ? "Could not cancel the project." : "Could not raise the refund."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "cancel" ? <><Ban className="h-5 w-5 text-rose-600" /> Cancel project</> : <><Undo2 className="h-5 w-5 text-emerald-700" /> Refund advance</>}
          </DialogTitle>
        </DialogHeader>

        {!info ? (
          <div className="py-8 flex justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 rounded-xl border border-slate-100 bg-slate-50/60 divide-x divide-slate-100 text-center">
              <div className="p-2.5"><div className="text-[11px] text-slate-400">Paid</div><div className="font-bold text-slate-800">{inr(info.amountPaid)}</div></div>
              <div className="p-2.5"><div className="text-[11px] text-slate-400">Refunded</div><div className="font-bold text-slate-800">{inr(info.refundRequested)}</div></div>
              <div className="p-2.5"><div className="text-[11px] text-slate-400">Refundable</div><div className="font-bold text-emerald-700">{inr(refundable)}</div></div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-600">Reason{mode === "cancel" && <span className="text-rose-500"> *</span>}</Label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
                placeholder={mode === "cancel" ? "Why is the project being cancelled?" : "Optional — defaults to the cancellation reason"}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" />
            </div>

            {refundable > 0 ? (
              <div>
                <Label className="text-xs font-semibold text-slate-600">Refund to customer</Label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
                    <input type="number" inputMode="decimal" min={0} max={refundable} value={amount} onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className={`h-10 w-full rounded-lg border bg-white pl-7 pr-3 text-sm font-semibold text-slate-800 focus:outline-none ${amountInvalid && amount !== "" ? "border-rose-300" : "border-slate-200 focus:border-emerald-400"}`} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(mode === "cancel" ? [0, 25, 50, 75, 100] : [25, 50, 75, 100]).map((p) => (
                    <button key={p} type="button" onClick={() => setPct(p)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
                      {p === 0 ? "No refund" : p === 100 ? "Full" : `${p}%`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {amt > refundable ? <span className="text-rose-600">Can't refund more than {inr(refundable)}.</span>
                    : <>Refund {inr(amt)} · company keeps {inr(refundable - (isNaN(amt) ? 0 : amt))}</>}
                </p>

                {amt > 0 && (
                  <div className="mt-3 space-y-2">
                    <label className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${paidNow ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100"}`}>
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">Already paid to the customer</span>
                        <span className="block text-xs text-slate-500">Record it as paid now. Leave unticked to send it to Finance → Refunds for approval.</span>
                      </span>
                    </label>
                    {paidNow && (
                      <div className="grid grid-cols-2 gap-2">
                        <select value={method} onChange={(e) => setMethod(e.target.value)}
                          className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none">
                          {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                        </select>
                        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / UTR"
                          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                {Number(info.amountPaid) > 0 ? "The advance has already been fully refunded or requested." : "No payment has been received on this project, so there's nothing to refund."}
              </p>
            )}

            {mode === "cancel" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>All open tasks on this project will be cancelled and unpaid invoices voided. This can't be undone.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="outline" disabled={saving} onClick={onClose}>{mode === "cancel" ? "Keep project" : "Close"}</Button>
              <Button disabled={!canSubmit || (mode === "refund" && refundable <= 0)} onClick={submit}
                className={mode === "cancel" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : mode === "cancel" ? <Ban className="w-4 h-4 mr-1.5" /> : <Undo2 className="w-4 h-4 mr-1.5" />}
                {mode === "cancel" ? "Cancel project" : "Raise refund"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Shown on a cancelled project: when/why, refunds raised so far, and a way to refund more. */
export function CancelledBanner({ projectId, refreshKey, onRefund }: { projectId: number | string; refreshKey?: unknown; onRefund: () => void }) {
  const [info, setInfo] = useState<CancellationInfo | null>(null);
  useEffect(() => {
    api.get(`/projects/${projectId}/cancellation`).then((r) => setInfo(r.data)).catch(() => setInfo(null));
  }, [projectId, refreshKey]);
  if (!info) return null;
  const retained = Number(info.amountPaid) - Number(info.refundRequested);
  return (
    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 flex flex-col @2xl:flex-row @2xl:items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-bold text-rose-800">
          <Ban className="h-4 w-4" /> Project cancelled
          {info.cancelledAt && <span className="font-medium text-rose-600/80">· {new Date(info.cancelledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>}
        </div>
        {info.cancellationReason && <p className="mt-0.5 text-sm text-rose-900/80 break-words">{info.cancellationReason}</p>}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>Paid <b className="text-slate-800">{inr(info.amountPaid)}</b></span>
          <span>Refunded <b className="text-slate-800">{inr(info.refunded)}</b></span>
          {Number(info.refundRequested) > Number(info.refunded) && <span>Awaiting approval <b className="text-amber-700">{inr(Number(info.refundRequested) - Number(info.refunded))}</b></span>}
          <span>Retained <b className="text-slate-800">{inr(Math.max(0, retained))}</b></span>
        </div>
        {info.refunds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {info.refunds.map((r) => (
              <span key={r.id} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "PAID" ? "bg-emerald-100 text-emerald-800" : r.status === "REJECTED" ? "bg-slate-200 text-slate-500 line-through" : "bg-amber-100 text-amber-800"}`}>
                {r.refundNumber} · {inr(r.amount)} · {r.status.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      {Number(info.refundable) > 0 && (
        <Button size="sm" variant="outline" onClick={onRefund} className="shrink-0 rounded-xl bg-white">
          <Undo2 className="h-4 w-4 mr-1.5" /> Refund advance
        </Button>
      )}
    </div>
  );
}
