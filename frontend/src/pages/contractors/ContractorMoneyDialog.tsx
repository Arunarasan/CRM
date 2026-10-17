import { useState } from "react";
import { contractorApi } from "@/api/contractorApi";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { BaseInput } from "@/components/ui/input";
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
  open, onClose, direction, contractorId, contractorName, onDone,
}: {
  open: boolean;
  onClose: () => void;
  direction: "IN" | "OUT";
  contractorId: number;
  contractorName: string;
  onDone: () => void;
}) {
  const incoming = direction === "IN";
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("CASH");
  const [type, setType] = useState("SETTLEMENT_RECEIVED");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

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
              : "Money we pay the contractor now. It is booked as an advance and set off against their later bills."}
          </p>
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
              <BaseInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Date</Label>
              <BaseInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
              <BaseInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
            </div>
          </div>
          <div>
            <Label>Remarks</Label>
            <BaseInput value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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
