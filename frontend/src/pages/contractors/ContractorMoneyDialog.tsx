import { useEffect, useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorOrderRow } from "@/types/contractor";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MODES = ["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE"];
const IN_TYPES = [
  { key: "SETTLEMENT_RECEIVED", label: "Settlement received" },
  { key: "REFUND", label: "Advance refund" },
  { key: "RECOVERY", label: "Recovery (material / penalty)" },
];
const inputCls = "w-full h-10 rounded-md border border-input bg-white px-3 text-sm";

/**
 * One small dialog for both directions of contractor money, straight from the profile:
 *   OUT — we pay the contractor (booked as an advance, set off against later bills)
 *   IN  — the contractor paid us (refund / recovery / settlement)
 * No bill or approval ladder; the backend writes the ledger + Cash Book entry.
 */
export default function ContractorMoneyDialog({
  open, onClose, direction, contractorId, contractorName, onDone, orderId,
}: {
  open: boolean;
  onClose: () => void;
  direction: "IN" | "OUT";
  contractorId: number;
  contractorName: string;
  onDone: () => void;
  /** Pre-select this order (e.g. when opened from an order row). */
  orderId?: number;
}) {
  const incoming = direction === "IN";
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("CASH");
  const [type, setType] = useState("SETTLEMENT_RECEIVED");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<ContractorOrderRow[]>([]);
  const [order, setOrder] = useState<string>(orderId ? String(orderId) : "");

  // Offer this contractor's live orders; paying out only lists orders that still have a balance.
  useEffect(() => {
    contractorApi.getOrders(contractorId).then((d) => {
      const live = d.orders.filter((o) => o.status !== "CANCELLED");
      const list = incoming ? live : live.filter((o) => o.balance > 0);
      setOrders(list);
      const pick = orderId ? list.find((o) => o.id === orderId) : (!incoming ? list[0] : undefined);
      if (pick) {
        setOrder(String(pick.id));
        if (!incoming) setAmount(String(pick.balance));
      }
    }).catch(() => {});
  }, [contractorId, incoming, orderId]);

  const onPickOrder = (v: string) => {
    setOrder(v);
    const o = orders.find((x) => String(x.id) === v);
    if (o && !incoming) setAmount(String(o.balance));
  };

  const submit = async () => {
    const amt = Number(amount);
    if (!(amt > 0)) { toast.error("Enter an amount greater than zero."); return; }
    setBusy(true);
    try {
      await contractorApi.quickPayment({
        contractorId,
        direction,
        payment: {
          amount: amt, paymentDate: date, paymentMode: mode,
          paymentType: incoming ? (type as never) : "ADVANCE",
          order: order ? ({ id: Number(order) } as never) : undefined,
          referenceNumber: reference || undefined, remarks: remarks || undefined,
        },
      });
      toast.success(incoming ? `Recorded ₹${amt.toLocaleString("en-IN")} received from ${contractorName}`
                             : `Paid ₹${amt.toLocaleString("en-IN")} to ${contractorName}`);
      setAmount(""); setReference(""); setRemarks("");
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{incoming ? `${contractorName} paid us` : `Pay ${contractorName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {incoming
              ? "Money the contractor returned to us. It lowers what we owe them and shows as income in the Cash Book."
              : "Money we pay the contractor now. Pick the order it is for — its balance updates straight away."}
          </p>
          <div>
            <Label>For order</Label>
            <select className={inputCls} value={order} onChange={(e) => onPickOrder(e.target.value)}>
              <option value="">{incoming ? "General (no order)" : "General advance (no order)"}</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.projectName} — {o.title} · balance ₹{o.balance.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>
          {incoming && (
            <div>
              <Label>What is it for</Label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                {IN_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode</Label>
              <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
            </div>
          </div>
          <div>
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Saving…" : incoming ? "Record received" : "Pay now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
