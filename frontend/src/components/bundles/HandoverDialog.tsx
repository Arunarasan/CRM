import { useEffect, useMemo, useState } from "react";
import { bundleApi, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_STYLES, type Bundle } from "@/api/bundleApi";
import { useAuth } from "@/hooks/useAuth";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, BaseInput } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ImageCaptureField from "@/components/ImageCaptureField";
import { Camera } from "lucide-react";

const METHODS = [
  { v: "CASH", label: "Cash" },
  { v: "UPI", label: "UPI" },
  { v: "CARD", label: "Card" },
  { v: "BANK_TRANSFER", label: "Bank" },
];

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Hand bundles to the customer in one step: tick the bundles going out (every READY one of the bill
 * by default), collect what is still owed on the bill, record who took them. Staff can't hand over
 * while money is due; a manager can, with a reason.
 */
export default function HandoverDialog({ bundles, focusId, onClose, onDone }: {
  /** Candidate bundles — usually every bundle of the bill. Closed ones are ignored. */
  bundles: Bundle[];
  /** The bundle the dialog was opened from (always pre-ticked). */
  focusId?: number;
  onClose: () => void;
  onDone: (updated: Bundle[]) => void;
}) {
  const { hasAnyAuthority, roleNames } = useAuth();
  const canCollect = hasAnyAuthority(["FINANCE_WRITE", "FINANCE_COLLECT"]);
  const canOverride = roleNames.includes("ROLE_ADMIN") || roleNames.includes("ROLE_MANAGER");

  const open = bundles.filter((b) => b.status !== "DELIVERED" && b.status !== "CANCELLED");
  const [picked, setPicked] = useState<Set<number>>(
    () => new Set(open.filter((b) => b.status === "READY" || b.id === focusId).map((b) => b.id)),
  );

  // balance per bill (each bill counted once)
  const owed = useMemo(() => {
    const bills = new Map<number, { number: string; due: number }>();
    open.filter((b) => picked.has(b.id) && b.invoiceId).forEach((b) =>
      bills.set(b.invoiceId!, { number: b.invoiceNumber ?? "", due: Number(b.balanceDue ?? 0) }));
    return [...bills.values()];
  }, [open, picked]);
  const due = owed.reduce((s, x) => s + x.due, 0);

  const first = open[0];
  const [to, setTo] = useState(first?.customerName && first.customerName !== "Walk-in Customer" ? first.customerName : "");
  const [amount, setAmount] = useState(due > 0 ? String(due) : "");
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);
  const [allowDue, setAllowDue] = useState(false);
  const [busy, setBusy] = useState(false);
  // ticking/unticking bundles of another bill changes what is owed — default to collecting all of it
  useEffect(() => { setAmount(due > 0 ? String(due) : ""); }, [due]);

  const paying = canCollect ? Math.max(0, Number(amount) || 0) : 0;
  const left = Math.max(0, Math.round((due - paying) * 100) / 100);
  const overpay = paying > due + 0.001;
  const notReady = open.filter((b) => picked.has(b.id) && b.status !== "READY");
  const blocked = picked.size === 0 || overpay
    || (left > 0 && (!canOverride || !allowDue || !note.trim()))
    || (notReady.length > 0 && !canOverride);

  const toggle = (id: number) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const submit = async () => {
    setBusy(true);
    try {
      const updated = await bundleApi.handover({
        bundleIds: [...picked],
        deliveredTo: to.trim() || undefined,
        note: note.trim() || undefined,
        photoUrl: photo || undefined,
        payments: paying > 0 ? [{ method, amount: paying, referenceNumber: ref.trim() || undefined }] : [],
        allowBalanceDue: left > 0 && allowDue,
      });
      toast.success(`${updated.map((b) => b.code).join(", ")} handed over${paying > 0 ? ` · ${inr(paying)} collected` : ""}.`);
      onDone(updated);
    } catch (e) {
      toast.error(apiError(e, "Could not hand over."));
      setBusy(false);
    }
  };

  const pickupWord = first?.handoverMode === "DELIVERY" ? "Delivered to" : "Collected by";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Hand over{first?.invoiceNumber ? ` · Bill ${first.invoiceNumber}` : ""}</DialogTitle></DialogHeader>

        <div className="space-y-4 text-sm">
          {/* bundles */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Bundles going out</div>
            <ul className="rounded-lg border divide-y">
              {open.map((b) => {
                const ready = b.status === "READY";
                const disabled = !ready && !canOverride;
                return (
                  <li key={b.id}>
                    <label className={`flex items-center gap-3 px-3 py-2 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
                      <BaseInput type="checkbox" className="w-4 h-4" checked={picked.has(b.id)} disabled={disabled}
                        onChange={() => toggle(b.id)} />
                      <span className="font-mono font-bold text-slate-800">{b.code}</span>
                      <span className="text-slate-500">{b.itemCount} item{b.itemCount === 1 ? "" : "s"}</span>
                      <span className={`ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${BUNDLE_STATUS_STYLES[b.status] ?? ""}`}>{BUNDLE_STATUS_LABELS[b.status] ?? b.status}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {notReady.length > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {notReady.map((b) => b.code).join(", ")} {notReady.length === 1 ? "is" : "are"} not {BUNDLE_STATUS_LABELS.READY.toLowerCase()} yet
                {canOverride ? " — handing over early as manager." : "."}
              </p>
            )}
          </div>

          {/* money */}
          <div className={`rounded-lg border p-3 ${due > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            {due > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium text-amber-900">Balance due</span>
                  <span className="text-xl font-black text-amber-900">{inr(due)}</span>
                </div>
                {owed.length > 1 && <p className="text-xs text-amber-800 mt-0.5">{owed.map((o) => `${o.number}: ${inr(o.due)}`).join(" · ")}</p>}
                {canCollect ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 shrink-0">Collect now ₹</span>
                      <Input type="number" min={0} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 bg-white" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {METHODS.map((m) => (
                        <button key={m.v} type="button" onClick={() => setMethod(m.v)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${method === m.v ? "bg-primary text-white border-primary" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {method !== "CASH" && (
                      <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference / UTR (optional)" className="h-9 bg-white" />
                    )}
                    {overpay && <p className="text-xs text-red-600">That is more than the balance due.</p>}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-amber-800">You can't take payments — ask billing to collect it first.</p>
                )}
                {left > 0 && !overpay && (
                  <div className="mt-3 border-t border-amber-200 pt-2">
                    <p className="text-xs font-medium text-amber-900">{inr(left)} will still be due after this.</p>
                    {canOverride ? (
                      <label className="mt-1 flex items-center gap-2 text-xs text-amber-900">
                        <BaseInput type="checkbox" className="w-4 h-4" checked={allowDue} onChange={(e) => setAllowDue(e.target.checked)} />
                        Hand over with balance due (reason required)
                      </label>
                    ) : (
                      <p className="text-xs text-amber-800">Collect the full balance to hand over, or ask a manager.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between font-medium text-emerald-800">
                <span>{owed.length ? "Bill fully paid" : "No bill on these bundles"}</span>
                {owed.length > 0 && <span>PAID</span>}
              </div>
            )}
          </div>

          {/* who */}
          <label className="block"><span className="text-slate-500">{pickupWord}</span>
            <Input value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" placeholder="Name (optional)" /></label>
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={left > 0 && allowDue ? "Reason for handing over with balance due" : "Note (optional)"} className="flex-1" />
            <Button type="button" variant="outline" onClick={() => setShowPhoto((v) => !v)}><Camera className="w-4 h-4 mr-1" />{photo ? "Photo added" : "Photo"}</Button>
          </div>
          {showPhoto && (
            <div className="max-w-xs"><ImageCaptureField module="BUNDLE" value={photo} onChange={(r) => setPhoto(r.url)} label="Handover photo" allowEdit /></div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || blocked} onClick={submit}>
            {busy ? "Saving…" : paying > 0 ? `Collect ${inr(paying)} & hand over ${picked.size}` : `Hand over ${picked.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
