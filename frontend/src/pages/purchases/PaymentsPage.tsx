import { useEffect, useState } from "react";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import SearchableSelect from "@/components/ui/searchable-select";
import type { PurchaseOrder, PurchasePayment } from "@/types/purchase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wallet } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const TYPE_TONE: Record<string, string> = {
  ADVANCE: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  FULL: "bg-emerald-100 text-emerald-700",
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [isAdvanceOpen, setIsAdvanceOpen] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [form, setForm] = useState<any>({ paymentMethod: "BANK_TRANSFER" });

  const load = () => {
    purchaseApi.getAllPayments().then(setPayments).catch(console.error);
    purchaseApi.getOutstandingPayments().then(setOutstanding).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isAdvanceOpen) return;
    purchaseApi.getPurchaseOrders({ size: 100 }).then((res) => setOrders(res.content || [])).catch(console.error);
  }, [isAdvanceOpen]);

  const saveAdvance = () => {
    if (!form.purchaseOrderId) return toast.error("Select the purchase order.");
    if (!form.amount) return toast.error("Enter the advance amount.");
    purchaseApi.addPayment({
      purchaseOrder: { id: Number(form.purchaseOrderId) },
      amount: Number(form.amount),
      paymentType: "ADVANCE",
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber,
      notes: form.notes,
    })
      .then(() => { setIsAdvanceOpen(false); setForm({ paymentMethod: "BANK_TRANSFER" }); load(); toast.success("Advance payment recorded."); })
      .catch((e) => toast.error(apiError(e, "Failed to record advance.")));
  };

  const totalOutstanding = outstanding.reduce((acc, o) => acc + (o.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-white border rounded-2xl px-5 py-3 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Outstanding to Suppliers</div>
          <div className="text-2xl font-black text-red-600">{currency(totalOutstanding)}</div>
        </div>
        <Button onClick={() => setIsAdvanceOpen(true)}><Plus className="w-4 h-4 mr-2" /> Record Advance</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 font-bold text-sm text-slate-700">Outstanding Invoices</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead className="hidden md:table-cell">PO</TableHead>
                <TableHead>Due Date</TableHead><TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map((o) => (
                <TableRow key={o.billId}>
                  <TableCell className="font-bold text-slate-800">{o.billNumber}</TableCell>
                  <TableCell>{o.supplierName}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500">{o.poNumber || "—"}</TableCell>
                  <TableCell className={o.overdue ? "text-red-600 font-bold" : "text-slate-500"}>{o.dueDate || "—"}</TableCell>
                  <TableCell className="text-right">{currency(o.totalAmount)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{currency(o.paidAmount)}</TableCell>
                  <TableCell className="text-right font-black text-red-600">{currency(o.balance)}</TableCell>
                </TableRow>
              ))}
              {outstanding.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Nothing outstanding — all supplier invoices are settled.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2 font-bold text-sm text-slate-700">
          <Wallet className="w-4 h-4" /> Payment History
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Against</TableHead>
                <TableHead>Type</TableHead><TableHead className="hidden md:table-cell">Method</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-500">{p.paymentDate ? format(new Date(p.paymentDate), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="font-semibold text-slate-700">{p.supplier?.name || "—"}</TableCell>
                  <TableCell className="text-slate-500">{p.purchaseBill?.billNumber || p.purchaseOrder?.poNumber || "—"}</TableCell>
                  <TableCell><Badge className={TYPE_TONE[p.paymentType] || TYPE_TONE.PARTIAL}>{p.paymentType}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500">{p.paymentMethod?.replaceAll("_", " ") || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500">{p.referenceNumber || "—"}</TableCell>
                  <TableCell className="text-right font-black text-slate-800">{currency(p.amount)}</TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">No payments recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isAdvanceOpen} onOpenChange={setIsAdvanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Advance Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Purchase Order *</Label>
              <SearchableSelect value={form.purchaseOrderId || ""} onChange={(v) => setForm({ ...form, purchaseOrderId: v })}
                options={orders.map((po) => ({ value: String(po.id), label: po.poNumber, hint: `${po.supplier?.name ?? ""} · ${currency(po.totalAmount)}` }))}
                placeholder="Search purchase order…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Method</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"].map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference #</Label>
              <Input value={form.referenceNumber || ""} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveAdvance}>Save Advance</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
