import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import type { PurchaseOrder, PurchaseOrderItem, GoodsReceiptNote, PurchaseBill } from "@/types/purchase";
import { PO_STATUS_TONE } from "@/types/purchase";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string) => (d ? format(new Date(d), "MMM d, yyyy") : "—");

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
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    purchaseApi.getPurchaseOrder(poId).then(setPo).catch(() => setNotFound(true));
    purchaseApi.getPurchaseOrderItems(poId).then(setItems).catch(console.error);
    purchaseApi.getGrnsForPo(poId).then(setGrns).catch(() => setGrns([]));
    purchaseApi.getBillsForPo(poId).then(setBills).catch(() => setBills([]));
  }, [poId]);

  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
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
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
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
      </div>

      {/* Related GRNs + Bills */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RelatedList title="Goods Receipts" empty="No goods receipts yet."
          rows={grns.map((g) => ({ id: g.id, left: g.grnNumber, right: g.status }))} />
        <RelatedList title="Bills" empty="No bills recorded yet."
          rows={bills.map((b) => ({ id: b.id, left: b.billNumber, right: `${currency(b.totalAmount)} · ${b.status}` }))} />
      </div>

      {po.notes && (
        <div className="bg-white border rounded-2xl shadow-sm p-5 text-sm">
          <div className="text-xs uppercase text-slate-500 mb-1">Notes</div>
          <p className="text-slate-700">{po.notes}</p>
        </div>
      )}
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

function RelatedList({ title, empty, rows }: { title: string; empty: string; rows: { id: number; left: string; right: string }[] }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <h2 className="font-semibold text-slate-800 mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className="font-medium text-slate-700">{r.left}</span>
              <span className="text-slate-500">{r.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
