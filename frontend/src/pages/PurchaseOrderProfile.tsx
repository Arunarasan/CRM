import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type {
  PurchaseOrder, PurchaseOrderItem, GoodsReceiptNote, PurchasePayment, PurchaseReturn,
} from "@/types/purchase";
import type { Warehouse } from "@/types/inventory";
import { PO_STATUS_TONE } from "@/types/purchase";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SearchableSelect from "@/components/ui/searchable-select";
import ImageCaptureField from "@/components/ImageCaptureField";
import { resolveFileUrl } from "@/lib/uploadFile";
import { ArrowLeft, PackageCheck, Wallet, Undo2, Plus, Receipt } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => (d ? format(new Date(d), "MMM d, yyyy") : "—");

const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "UPI", "CHEQUE", "CARD"];
const RETURN_REASONS = [
  { value: "DAMAGED", label: "Damaged material" },
  { value: "WRONG_MATERIAL", label: "Wrong material" },
  { value: "EXCESS_QUANTITY", label: "Excess quantity" },
];

// Mirrors PurchaseService.PO_TRANSITIONS so buttons only offer legal next states.
const TRANSITIONS: Record<string, { to: string; label: string; variant?: "default" | "outline" | "destructive" }[]> = {
  DRAFT: [
    { to: "PENDING_APPROVAL", label: "Submit for Approval" },
    { to: "APPROVED", label: "Approve", variant: "outline" },
    { to: "CANCELLED", label: "Cancel", variant: "destructive" },
  ],
  PENDING_APPROVAL: [
    { to: "APPROVED", label: "Approve" },
    { to: "REJECTED", label: "Reject", variant: "destructive" },
    { to: "CANCELLED", label: "Cancel", variant: "outline" },
  ],
  APPROVED: [
    { to: "SENT", label: "Send to Supplier" },
    { to: "CANCELLED", label: "Cancel", variant: "outline" },
  ],
  REJECTED: [{ to: "DRAFT", label: "Reopen as Draft", variant: "outline" }],
  SENT: [
    { to: "CONFIRMED", label: "Mark Confirmed" },
    { to: "PARTIAL", label: "Partially Received", variant: "outline" },
    { to: "COMPLETED", label: "Mark Completed", variant: "outline" },
    { to: "CANCELLED", label: "Cancel", variant: "destructive" },
  ],
  CONFIRMED: [
    { to: "PARTIAL", label: "Partially Received" },
    { to: "COMPLETED", label: "Mark Completed" },
    { to: "CANCELLED", label: "Cancel", variant: "outline" },
  ],
  PARTIAL: [
    { to: "COMPLETED", label: "Mark Completed" },
    { to: "CANCELLED", label: "Cancel", variant: "outline" },
  ],
};

export default function PurchaseOrderProfile() {
  const { id } = useParams();
  const poId = Number(id);
  const goBack = useGoBack("/purchases/orders");

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [payments, setPayments] = useState<PurchasePayment[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // dialogs
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  // receive form
  const [recvWarehouseId, setRecvWarehouseId] = useState("");
  const [recvInvoice, setRecvInvoice] = useState("");
  const [recvVehicle, setRecvVehicle] = useState("");
  const [recvQty, setRecvQty] = useState<Record<number, number>>({});
  const [recvDamaged, setRecvDamaged] = useState<Record<number, number>>({});

  // pay form
  const [payForm, setPayForm] = useState<{ amount?: number; paymentMethod: string; paymentDate: string; referenceNumber?: string; proofUrl?: string; notes?: string }>(
    { paymentMethod: "BANK_TRANSFER", paymentDate: new Date().toISOString().slice(0, 10) }
  );

  // return form
  const [retReason, setRetReason] = useState("DAMAGED");
  const [retWarehouseId, setRetWarehouseId] = useState("");
  const [retNotes, setRetNotes] = useState("");
  const [retQty, setRetQty] = useState<Record<number, number>>({});

  const load = useCallback(() => {
    purchaseApi.getPurchaseOrder(poId).then(setPo).catch(() => setNotFound(true));
    purchaseApi.getPurchaseOrderItems(poId).then(setItems).catch(console.error);
    purchaseApi.getGrnsForPo(poId).then(setGrns).catch(() => setGrns([]));
    // On error (e.g. backend not yet restarted with this endpoint) keep whatever is already shown
    // rather than clearing — so an optimistically-added payment isn't wiped by a failing refetch.
    purchaseApi.getPaymentsForPo(poId).then(setPayments).catch(() => {});
    purchaseApi.getAllReturns().then((r) => setReturns(r.filter((x) => x.purchaseOrder?.id === poId))).catch(() => setReturns([]));
  }, [poId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { inventoryApi.getWarehouses().then(setWarehouses).catch(() => {}); }, []);

  const paid = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments]);
  const total = po?.totalAmount ?? 0;
  const pending = Math.max(total - paid, 0);

  const STATUS_TOAST: Record<string, string> = {
    PENDING_APPROVAL: "sent for approval", APPROVED: "approved", REJECTED: "rejected",
    SENT: "sent to the supplier", CONFIRMED: "marked confirmed", PARTIAL: "marked partially received",
    COMPLETED: "marked completed", CANCELLED: "cancelled", DRAFT: "reopened as a draft",
  };

  const changeStatus = async (status: string) => {
    if (status === "CANCELLED" && !confirm(`Cancel ${po?.poNumber}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const updated = await purchaseApi.updatePurchaseOrderStatus(poId, status);
      setPo(updated);
      toast.success(`${updated.poNumber} ${STATUS_TOAST[status] ?? "updated"}.`);
    } catch (e) {
      toast.error(apiError(e, "Could not update the purchase order."));
    } finally { setBusy(false); }
  };

  // ---- Receive goods (create GRN + approve, in one step) ----
  const openReceive = () => {
    setRecvWarehouseId(po?.warehouse?.id ? String(po.warehouse.id) : "");
    setRecvInvoice(""); setRecvVehicle("");
    const q: Record<number, number> = {};
    items.forEach((it) => { q[it.id] = Math.max((it.quantity ?? 0) - (it.receivedQuantity ?? 0), 0); });
    setRecvQty(q); setRecvDamaged({});
    setReceiveOpen(true);
  };

  const submitReceive = async () => {
    if (!recvWarehouseId) return toast.error("Choose the warehouse the goods arrive at.");
    const grnItems = items
      .filter((it) => (recvQty[it.id] || 0) > 0)
      .map((it) => ({
        product: { id: it.product.id },
        receivedQuantity: recvQty[it.id],
        damagedQuantity: recvDamaged[it.id] || 0,
      }));
    if (grnItems.length === 0) return toast.error("Enter a received quantity for at least one item.");
    setBusy(true);
    try {
      const grn = await purchaseApi.createGrn(
        { purchaseOrder: { id: poId }, warehouse: { id: Number(recvWarehouseId) }, supplierInvoiceNumber: recvInvoice || undefined, vehicleNumber: recvVehicle || undefined },
        grnItems,
      );
      await purchaseApi.approveGrn(grn.id); // any employee may approve — stock updates now
      toast.success("Goods received and added to stock.");
      setReceiveOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e, "Could not record the goods receipt."));
    } finally { setBusy(false); }
  };

  // ---- Record payment (against the order) ----
  // Open the payment dialog pre-filled with the outstanding balance (one-tap "pay the balance").
  const openPay = () => {
    setPayForm({ amount: pending > 0 ? pending : undefined, paymentMethod: "BANK_TRANSFER", paymentDate: new Date().toISOString().slice(0, 10) });
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!payForm.amount || payForm.amount <= 0) return toast.error("Enter the amount paid.");
    setBusy(true);
    try {
      const saved = await purchaseApi.addPayment({
        purchaseOrder: { id: poId },
        amount: payForm.amount,
        paymentMethod: payForm.paymentMethod,
        paymentDate: payForm.paymentDate,
        referenceNumber: payForm.referenceNumber || undefined,
        proofUrl: payForm.proofUrl || undefined,
        notes: payForm.notes || undefined,
      });
      // Show it immediately (optimistic) so the history updates even before the refetch resolves.
      setPayments((prev) => (saved && !prev.some((p) => p.id === saved.id) ? [saved, ...prev] : prev));
      toast.success("Payment recorded.");
      setPayOpen(false);
      setPayForm({ paymentMethod: "BANK_TRANSFER", paymentDate: new Date().toISOString().slice(0, 10) });
      load();
    } catch (e) {
      toast.error(apiError(e, "Could not record the payment."));
    } finally { setBusy(false); }
  };

  // ---- Return items to supplier ----
  const openReturn = () => {
    setRetReason("DAMAGED"); setRetNotes(""); setRetQty({});
    setRetWarehouseId(po?.warehouse?.id ? String(po.warehouse.id) : "");
    setReturnOpen(true);
  };

  const submitReturn = async () => {
    if (!retWarehouseId) return toast.error("Choose the warehouse the material leaves from.");
    const retItems = items
      .filter((it) => (retQty[it.id] || 0) > 0)
      .map((it) => ({ product: { id: it.product.id }, quantity: retQty[it.id], unitPrice: it.unitPrice }));
    if (retItems.length === 0) return toast.error("Enter a return quantity for at least one item.");
    setBusy(true);
    try {
      const ret = await purchaseApi.createReturn(
        { purchaseOrder: { id: poId }, warehouse: { id: Number(retWarehouseId) }, reasonType: retReason, notes: retNotes || undefined },
        retItems,
      );
      await purchaseApi.confirmReturn(ret.id).catch(() => {/* confirm may need approver rights; leave as draft */});
      toast.success("Return raised.");
      setReturnOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e, "Could not create the return."));
    } finally { setBusy(false); }
  };

  if (notFound) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={goBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">Purchase order not found.</div>
      </div>
    );
  }
  if (!po) return <div className="p-8 text-slate-500">Loading purchase order…</div>;

  const actions = TRANSITIONS[po.status] ?? [];
  const received = grns.length > 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{po.poNumber}</h1>
              <Badge className={PO_STATUS_TONE[po.status]}>{po.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{po.supplier?.name} · raised {fmtDate(po.date)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.to} variant={a.variant ?? "default"} size="sm" disabled={busy} onClick={() => changeStatus(a.to)}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Money summary — Total / Paid / Pending */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Order total" value={currency(total)} tone="text-slate-900" />
        <SummaryCard label="Paid" value={currency(paid)} tone="text-sky-700" />
        <SummaryCard label="Pending" value={currency(pending)} tone={pending > 0 ? "text-red-600" : "text-emerald-600"} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={openReceive}><PackageCheck className="w-4 h-4 mr-2" /> Receive Goods</Button>
        <Button size="sm" variant="outline" onClick={openPay}><Wallet className="w-4 h-4 mr-2" /> Record Payment</Button>
        <Button size="sm" variant="outline" onClick={openReturn} disabled={!received}><Undo2 className="w-4 h-4 mr-2" /> Return Items</Button>
      </div>

      {/* Meta */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Meta label="Supplier" value={po.supplier?.name} />
        <Meta label="Project" value={po.project?.projectName || "—"} />
        <Meta label="Warehouse" value={po.warehouse?.name || "—"} />
        <Meta label="Expected Delivery" value={fmtDate(po.expectedDeliveryDate)} />
        <Meta label="Payment Terms" value={po.paymentTerms || "—"} />
        <Meta label="Sent" value={po.sentAt ? fmtDate(po.sentAt) : "—"} />
        <Meta label="Confirmed" value={po.confirmedAt ? fmtDate(po.confirmedAt) : "—"} />
        <Meta label="Delivery Address" value={po.deliveryAddress || "—"} />
      </div>

      {/* Items */}
      <Section title="Items">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Material</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{it.product?.name}</td>
                  <td className="px-4 py-3 text-right">{it.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{it.receivedQuantity ?? 0}</td>
                  <td className="px-4 py-3 text-right">{currency(it.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{currency(it.totalPrice)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No line items.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t p-5 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={currency(po.subtotal)} />
            <Row label={`Tax (${po.taxPercent ?? 0}%)`} value={currency(po.taxAmount)} />
            {!!po.discountAmount && <Row label="Discount" value={`− ${currency(po.discountAmount)}`} />}
            {!!po.transportationCost && <Row label="Transport" value={currency(po.transportationCost)} />}
            <div className="flex justify-between border-t pt-2 mt-1 text-base font-bold text-slate-900">
              <span>Grand Total</span><span>{currency(po.totalAmount)}</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Goods received */}
      <Section title="Goods Received">
        {grns.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No goods received yet. Use “Receive Goods” when material arrives.</p>
        ) : (
          <ul className="divide-y text-sm">
            {grns.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-semibold text-slate-800">{g.grnNumber}</span>
                  <span className="text-slate-400"> · {fmtDate(g.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {g.qcStatus && g.qcStatus !== "PENDING" && <Badge variant="secondary">{g.qcStatus}</Badge>}
                  <Badge className={g.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{g.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Payment history */}
      <Section title={`Payment History${payments.length ? ` (${payments.length})` : ""}`}>
        {payments.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No payments recorded. {pending > 0 && <>Pending <b className="text-red-600">{currency(pending)}</b>.</>}</p>
        ) : (
          <>
            <ul className="divide-y text-sm">
              {[...payments].sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || "")).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div>
                      <span className="font-semibold text-slate-800">{currency(p.amount)}</span>
                      <span className="text-slate-400"> · {p.paymentMethod?.replaceAll("_", " ")} · {fmtDate(p.paymentDate)}</span>
                      {p.referenceNumber && <span className="text-slate-400"> · ref {p.referenceNumber}</span>}
                    </div>
                    {p.notes && <div className="text-xs text-slate-500 mt-0.5">{p.notes}</div>}
                  </div>
                  {p.proofUrl && (
                    <a href={resolveFileUrl(p.proofUrl)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-primary hover:underline">
                      <img src={resolveFileUrl(p.proofUrl)} alt="proof" className="h-8 w-8 rounded object-cover border" />
                      <Receipt className="w-3.5 h-3.5" /> Proof
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-4 border-t bg-slate-50 px-5 py-3 text-sm">
              <span className="font-semibold text-slate-600">Total paid <b className="text-sky-700">{currency(paid)}</b></span>
              <span className="font-semibold text-slate-600">Pending <b className={pending > 0 ? "text-red-600" : "text-emerald-600"}>{currency(pending)}</b></span>
            </div>
          </>
        )}
      </Section>

      {/* Returns */}
      {returns.length > 0 && (
        <Section title="Returns">
          <ul className="divide-y text-sm">
            {returns.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-3">
                <div><span className="font-semibold text-slate-800">{r.returnNumber}</span>
                  <span className="text-slate-400"> · {r.reasonType?.replaceAll("_", " ")}</span></div>
                <Badge className={r.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {po.notes && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm">
          <div className="text-xs uppercase text-slate-500 mb-1">Notes</div>
          <p className="text-slate-700">{po.notes}</p>
        </div>
      )}

      {/* ---- Receive dialog ---- */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Receive Goods · {po.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Warehouse</Label>
                <SearchableSelect value={recvWarehouseId} onChange={setRecvWarehouseId}
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                  placeholder="Choose warehouse…" />
              </div>
              <div className="space-y-1"><Label>Supplier Invoice #</Label>
                <Input value={recvInvoice} onChange={(e) => setRecvInvoice(e.target.value)} /></div>
              <div className="space-y-1"><Label>Vehicle #</Label>
                <Input value={recvVehicle} onChange={(e) => setRecvVehicle(e.target.value)} /></div>
            </div>
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Ordered</th>
                    <th className="px-3 py-2 text-right">Already in</th><th className="px-3 py-2 text-right w-28">Receiving</th>
                    <th className="px-3 py-2 text-right w-28">Damaged</th></tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.product?.name}</td>
                      <td className="px-3 py-2 text-right">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{it.receivedQuantity ?? 0}</td>
                      <td className="px-3 py-2"><Input type="number" min={0} className="h-8 text-right" value={recvQty[it.id] ?? 0}
                        onChange={(e) => setRecvQty({ ...recvQty, [it.id]: parseInt(e.target.value) || 0 })} /></td>
                      <td className="px-3 py-2"><Input type="number" min={0} className="h-8 text-right" value={recvDamaged[it.id] ?? 0}
                        onChange={(e) => setRecvDamaged({ ...recvDamaged, [it.id]: parseInt(e.target.value) || 0 })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">Accepted stock (received − damaged) is added to inventory on submit. Any logged-in employee can receive &amp; approve.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={submitReceive} disabled={busy}>Receive &amp; Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Payment dialog ---- */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment · {po.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {/* Breakdown queue: total → paid → balance */}
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Order total</span><span className="font-semibold text-slate-800">{currency(total)}</span></div>
              <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Already paid</span><span className="font-semibold text-sky-700">− {currency(paid)}</span></div>
              <div className="flex justify-between px-3 py-2 bg-slate-50"><span className="font-semibold text-slate-700">Balance to pay</span><span className="font-black text-red-600">{currency(pending)}</span></div>
            </div>

            {/* Quick fill */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPayForm({ ...payForm, amount: pending || undefined })}
                className="rounded-full border border-primary bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                Pay balance · {currency(pending)}
              </button>
              {pending > 1 && (
                <button type="button" onClick={() => setPayForm({ ...payForm, amount: Math.round(pending / 2) })}
                  className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary">
                  Half · {currency(Math.round(pending / 2))}
                </button>
              )}
              {paid > 0 && (
                <button type="button" onClick={() => setPayForm({ ...payForm, amount: total || undefined })}
                  className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary">
                  Full order · {currency(total)}
                </button>
              )}
            </div>

            <div className="space-y-1"><Label>Amount to pay now</Label>
              <Input type="number" min={0} value={payForm.amount ?? ""} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || undefined })} />
              {(() => {
                const amt = payForm.amount || 0;
                const after = Math.max(pending - amt, 0);
                const advance = Math.max(amt - pending, 0);
                if (amt <= 0) return null;
                return advance > 0
                  ? <p className="text-xs text-amber-600">Clears the balance; extra <b>{currency(advance)}</b> goes as advance to the supplier's account.</p>
                  : <p className="text-xs text-slate-500">Balance after this payment: <b className={after > 0 ? "text-red-600" : "text-emerald-600"}>{currency(after)}</b></p>;
              })()}
            </div>

            {payments.length > 0 && (
              <div className="rounded-lg border divide-y max-h-28 overflow-y-auto text-xs">
                <div className="px-3 py-1.5 font-semibold text-slate-500 bg-slate-50">Already paid ({payments.length})</div>
                {[...payments].sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || "")).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-slate-700"><b>{currency(p.amount)}</b> · {fmtDate(p.paymentDate)}</span>
                    {p.proofUrl && <a href={resolveFileUrl(p.proofUrl)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">proof</a>}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Method</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                </select></div>
              <div className="space-y-1"><Label>Date</Label>
                <Input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Reference #</Label>
              <Input value={payForm.referenceNumber ?? ""} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} /></div>
            <ImageCaptureField
              module="PAYMENT"
              label="Payment proof (screenshot / receipt)"
              value={payForm.proofUrl ? resolveFileUrl(payForm.proofUrl) : ""}
              onChange={({ url }) => setPayForm({ ...payForm, proofUrl: url })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPayment} disabled={busy}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Return dialog ---- */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Return Items · {po.poNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Reason</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={retReason}
                  onChange={(e) => setRetReason(e.target.value)}>
                  {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select></div>
              <div className="space-y-1"><Label>From Warehouse</Label>
                <SearchableSelect value={retWarehouseId} onChange={setRetWarehouseId}
                  options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
                  placeholder="Choose warehouse…" /></div>
            </div>
            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right w-28">Return qty</th></tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.product?.name}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{it.receivedQuantity ?? 0}</td>
                      <td className="px-3 py-2"><Input type="number" min={0} max={it.receivedQuantity ?? 0} className="h-8 text-right" value={retQty[it.id] ?? 0}
                        onChange={(e) => setRetQty({ ...retQty, [it.id]: parseInt(e.target.value) || 0 })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1"><Label>Notes</Label>
              <Input value={retNotes} onChange={(e) => setRetNotes(e.target.value)} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={submitReturn} disabled={busy}><Plus className="w-4 h-4 mr-1" /> Raise Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4">
      <div className={`text-xl font-black ${tone}`}>{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-slate-800 text-sm">{title}</div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800 mt-0.5">{value || "—"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className="font-semibold">{value}</span></div>;
}
