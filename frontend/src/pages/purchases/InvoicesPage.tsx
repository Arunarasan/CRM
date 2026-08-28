import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import SearchableSelect from "@/components/ui/searchable-select";
import type { PurchaseBill, PurchaseOrder } from "@/types/purchase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Receipt } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const BILL_TONE: Record<string, string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

export default function InvoicesPage() {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [form, setForm] = useState<any>({});
  const [payBill, setPayBill] = useState<PurchaseBill | null>(null);
  const [payForm, setPayForm] = useState<any>({ paymentMethod: "BANK_TRANSFER", paymentType: "PARTIAL" });

  const load = () => purchaseApi.getAllBills().then(setBills).catch(console.error);
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    purchaseApi.getPurchaseOrders({ size: 100 }).then((res) => setOrders(res.content || [])).catch(console.error);
  }, [isCreateOpen]);

  const createBill = () => {
    if (!form.purchaseOrderId) return toast.error("Select the purchase order this invoice is against.");
    if (!form.billNumber) return toast.error("Enter the supplier's invoice number.");
    if (!form.totalAmount) return toast.error("Enter the invoice amount.");
    purchaseApi.createBill({
      billNumber: form.billNumber,
      purchaseOrder: { id: Number(form.purchaseOrderId) },
      dueDate: form.dueDate || null,
      taxAmount: form.taxAmount ? Number(form.taxAmount) : null,
      totalAmount: Number(form.totalAmount),
      notes: form.notes,
    })
      .then(() => { setIsCreateOpen(false); setForm({}); load(); toast.success("Supplier bill logged."); })
      .catch((e) => toast.error(apiError(e, "Failed to log invoice.")));
  };

  const addPayment = () => {
    if (!payBill) return;
    if (!payForm.amount) return toast.error("Enter the payment amount.");
    purchaseApi.addPayment({
      purchaseBill: { id: payBill.id },
      amount: Number(payForm.amount),
      paymentType: payForm.paymentType,
      paymentMethod: payForm.paymentMethod,
      referenceNumber: payForm.referenceNumber,
      notes: payForm.notes,
    })
      .then(() => { setPayBill(null); setPayForm({ paymentMethod: "BANK_TRANSFER", paymentType: "PARTIAL" }); load(); toast.success("Payment recorded."); })
      .catch((e) => toast.error(apiError(e, "Failed to record payment.")));
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Supplier invoices linked to purchase orders, with due-date and payment tracking.</p>
        <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" /> Log Invoice</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="hidden md:table-cell">PO</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => {
                const overdue = bill.status !== "PAID" && bill.dueDate && bill.dueDate < today;
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-bold text-slate-800">{bill.billNumber}</TableCell>
                    <TableCell className="font-semibold text-slate-700">{bill.supplier?.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {bill.purchaseOrder?.poNumber ? (
                        <Link className="text-primary text-xs font-semibold hover:underline" to={`/purchases/orders/${bill.purchaseOrder.id}`}>
                          {bill.purchaseOrder.poNumber}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-slate-500">{bill.date ? format(new Date(bill.date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell className={overdue ? "text-red-600 font-bold" : "text-slate-500"}>
                      {bill.dueDate || "—"}{overdue ? " ⚠" : ""}
                    </TableCell>
                    <TableCell><Badge className={BILL_TONE[bill.status]}>{bill.status}</Badge></TableCell>
                    <TableCell className="text-right font-black text-slate-800">{currency(bill.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      {bill.status !== "PAID" && (
                        <Button size="sm" variant="outline" onClick={() => { setPayBill(bill); setPayForm({ paymentMethod: "BANK_TRANSFER", paymentType: "PARTIAL" }); }}>
                          Record Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {bills.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">No supplier invoices logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Log invoice dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Log Supplier Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Purchase Order *</Label>
              <SearchableSelect value={form.purchaseOrderId || ""} onChange={(v) => setForm({ ...form, purchaseOrderId: v })}
                options={orders.map((po) => ({ value: String(po.id), label: po.poNumber, hint: `${po.supplier?.name ?? ""} · ${currency(po.totalAmount)}` }))}
                placeholder="Search purchase order…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Number *</Label>
                <Input value={form.billNumber || ""} onChange={(e) => setForm({ ...form, billNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Amount (₹)</Label>
                <Input type="number" step="0.01" value={form.taxAmount || ""} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Amount (₹) *</Label>
                <Input type="number" step="0.01" value={form.totalAmount || ""} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={createBill}>Save Invoice</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payBill} onOpenChange={(open) => !open && setPayBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payBill?.billNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input type="number" step="0.01" value={payForm.amount || ""} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={payForm.paymentType}
                  onChange={(e) => setPayForm({ ...payForm, paymentType: e.target.value })}>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="FULL">FULL</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Method</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                  {["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "CARD"].map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference #</Label>
                <Input value={payForm.referenceNumber || ""} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={addPayment}>Save Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
