import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ShoppingCart, Plus, Loader2, MapPin, IndianRupee, Wallet, Truck, Package, ExternalLink, Trash2, CheckCircle2, Send,
} from "lucide-react";
import { purchaseApi, ProjectPurchases, ProjectPurchaseOrder } from "@/api/purchaseApi";
import { PAYMENT_METHODS } from "@/types/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

const money = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");
const today = () => new Date().toISOString().slice(0, 10);
const selectCls =
  "w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-sky-50 text-sky-700",
  SENT: "bg-indigo-50 text-indigo-700",
  CONFIRMED: "bg-indigo-50 text-indigo-700",
  PARTIAL: "bg-orange-50 text-orange-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-rose-50 text-rose-700",
};

export function PoStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.DRAFT}`}>
      {status === "PARTIAL" ? "Partly received" : status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

function Stat({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500"><Icon className="h-3.5 w-3.5 text-emerald-600" />{label}</div>
      <div className="mt-1 text-lg font-black text-slate-800 leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}

/** Project → Resources → Purchase Orders: every PO raised for this project, what's on it, shipped and paid. */
export default function ProjectPurchaseOrdersTab({ projectId }: { projectId: number }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ProjectPurchases | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    return purchaseApi.getProjectPurchases(projectId)
      .then(setData)
      .catch((e) => toast.error(apiError(e, "Could not load purchase orders.")))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary;
  const open = data?.orders.find((o) => o.id === openId) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-emerald-600" /> Purchase Orders</h2>
        <Button onClick={() => navigate(`/purchases/orders/new?projectId=${projectId}`)}><Plus className="w-4 h-4 mr-1.5" /> New Purchase Order</Button>
      </div>

      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2.5">
        <Stat label="Orders" value={s?.orderCount ?? 0} sub="for this project" icon={ShoppingCart} />
        <Stat label="Ordered value" value={money(s?.totalOrdered)} icon={IndianRupee} />
        <Stat label="Paid to suppliers" value={money(s?.totalPaid)} icon={Wallet} />
        <Stat label="Balance due" value={money(s?.balance)} sub={s?.shipmentsInTransit ? `${s.shipmentsInTransit} shipment(s) on the way` : undefined} icon={Truck} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : !data?.orders.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <Package className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-600">No purchase orders yet</p>
          <p className="text-xs text-slate-400">Raise one to buy products for this project.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.orders.map((o) => <OrderRow key={o.id} order={o} onOpen={() => setOpenId(o.id)} />)}
        </div>
      )}

      <OrderDetailDialog order={open} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  );
}

function OrderRow({ order: o, onOpen }: { order: ProjectPurchaseOrder; onOpen: () => void }) {
  const ids = o.shipments.map((sh) => sh.shippingId);
  const receivedPct = o.qtyOrdered ? Math.round((o.qtyReceived / o.qtyOrdered) * 100) : 0;
  return (
    <button onClick={onOpen} className="w-full text-left rounded-xl border border-slate-100 bg-white p-3 hover:border-emerald-200 hover:shadow-sm transition">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{o.poNumber}</span>
            <PoStatusBadge status={o.status} />
          </div>
          <div className="text-sm text-slate-600 truncate">{o.supplierName || "—"}</div>
          <div className="text-xs text-slate-400">
            {fmtDate(o.date)} · {o.items.length} product{o.items.length === 1 ? "" : "s"}
            {ids.length > 0 && <> · <Truck className="inline h-3 w-3 -mt-0.5" /> {ids.join(", ")}</>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-right text-xs">
          <div><div className="text-slate-400">Total</div><div className="font-bold text-slate-800">{money(o.totalAmount)}</div></div>
          <div><div className="text-slate-400">Paid</div><div className="font-bold text-emerald-700">{money(o.paid)}</div></div>
          <div><div className="text-slate-400">Balance</div><div className={`font-bold ${o.balance > 0 ? "text-rose-600" : "text-slate-500"}`}>{money(o.balance)}</div></div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${receivedPct}%` }} /></div>
        <span className="text-[11px] font-semibold text-slate-500">{receivedPct}% received</span>
      </div>
    </button>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function OrderDetailDialog({ order: o, onClose, onChanged }: { order: ProjectPurchaseOrder | null; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const blankShip = () => ({ open: false, shippingId: "", transporterName: "", deliveryPlace: "", dispatchDate: today() });
  const [shipForm, setShipForm] = useState<{ open: boolean; shippingId: string; transporterName: string; deliveryPlace: string; dispatchDate: string }>(blankShip);
  const [payForm, setPayForm] = useState<{ open: boolean; amount: string; paymentMethod: string; paymentDate: string; referenceNumber: string; notes: string }>(
    { open: false, amount: "", paymentMethod: "BANK_TRANSFER", paymentDate: today(), referenceNumber: "", notes: "" });

  // Reset the inline forms whenever a different order is opened.
  useEffect(() => {
    setShipForm(blankShip());
    setPayForm({ open: false, amount: "", paymentMethod: "BANK_TRANSFER", paymentDate: today(), referenceNumber: "", notes: "" });
  }, [o?.id]);

  if (!o) return null;
  const canShip = !["CANCELLED", "REJECTED", "COMPLETED"].includes(o.status);

  const run = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await onChanged(); return true; }
    catch (e) { toast.error(apiError(e, fail)); return false; }
    finally { setBusy(false); }
  };

  const setStatus = (status: string, ok: string) =>
    run(() => purchaseApi.updatePurchaseOrderStatus(o.id, status), ok, "Could not update the order status.");

  const addShipment = async () => {
    if (!shipForm.shippingId.trim()) { toast.error("Enter the shipping ID."); return; }
    const done = await run(() => purchaseApi.addShipment(o.id, {
      shippingId: shipForm.shippingId.trim(),
      transporterName: shipForm.transporterName.trim() || undefined,
      deliveryPlace: shipForm.deliveryPlace.trim() || undefined,
      dispatchDate: shipForm.dispatchDate || undefined,
    }), "Shipment added.", "Could not add the shipment.");
    if (done) setShipForm(blankShip());
  };

  const recordPayment = async () => {
    const amount = Number(payForm.amount);
    if (!amount || amount <= 0) { toast.error("Enter the amount paid."); return; }
    const done = await run(() => purchaseApi.addPayment({
      purchaseOrder: { id: o.id },
      amount,
      paymentMethod: payForm.paymentMethod,
      paymentDate: payForm.paymentDate,
      referenceNumber: payForm.referenceNumber || undefined,
      notes: payForm.notes || undefined,
    }), "Payment recorded.", "Could not record the payment.");
    if (done) setPayForm({ open: false, amount: "", paymentMethod: "BANK_TRANSFER", paymentDate: today(), referenceNumber: "", notes: "" });
  };

  return (
    <Dialog open={!!o} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto @container">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">{o.poNumber} <PoStatusBadge status={o.status} /></DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2 text-xs">
            <div><div className="text-slate-400">Supplier</div><div className="font-semibold text-slate-800">{o.supplierName || "—"}</div></div>
            <div><div className="text-slate-400">Order date</div><div className="font-semibold text-slate-800">{fmtDate(o.date)}</div></div>
            <div><div className="text-slate-400">Expected delivery</div><div className="font-semibold text-slate-800">{fmtDate(o.expectedDeliveryDate)}</div></div>
            <div><div className="text-slate-400">Receive into</div><div className="font-semibold text-slate-800">{o.warehouseName || "—"}</div></div>
            {o.paymentTerms && <div><div className="text-slate-400">Payment terms</div><div className="font-semibold text-slate-800">{o.paymentTerms}</div></div>}
            {o.deliveryAddress && <div className="col-span-2"><div className="text-slate-400">Delivery address</div><div className="font-semibold text-slate-800">{o.deliveryAddress}</div></div>}
          </div>

          <div className="flex flex-wrap gap-2">
            {(o.status === "DRAFT" || o.status === "PENDING_APPROVAL") && (
              <Button size="sm" disabled={busy} onClick={() => setStatus("APPROVED", "Order approved.")}><CheckCircle2 className="w-4 h-4 mr-1" /> Approve</Button>
            )}
            {o.status === "APPROVED" && (
              <Button size="sm" disabled={busy} onClick={() => setStatus("SENT", "Marked as sent to supplier.")}><Send className="w-4 h-4 mr-1" /> Mark sent to supplier</Button>
            )}
            <Link to={`/purchases/orders/${o.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline ml-auto self-center">
              Open full order <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <Section title={`Products (${o.items.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400">
                  <tr className="text-left"><th className="py-1 font-medium">Product</th><th className="py-1 font-medium text-right">Qty</th><th className="py-1 font-medium text-right">Rate</th><th className="py-1 font-medium text-right">Amount</th><th className="py-1 font-medium text-right">Received</th></tr>
                </thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.productId} className="border-t border-slate-50">
                      <td className="py-1.5 font-medium text-slate-700">{it.productName}</td>
                      <td className="py-1.5 text-right">{it.ordered} {it.unit || ""}</td>
                      <td className="py-1.5 text-right">{money(it.unitPrice)}</td>
                      <td className="py-1.5 text-right">{money(it.totalPrice)}</td>
                      <td className={`py-1.5 text-right font-semibold ${it.outstanding === 0 ? "text-emerald-700" : "text-slate-600"}`}>{it.received}/{it.ordered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 ml-auto max-w-xs space-y-0.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{money(o.subtotal)}</span></div>
              {!!o.taxAmount && <div className="flex justify-between"><span className="text-slate-500">GST{o.taxPercent ? ` (${o.taxPercent}%)` : ""}</span><span>{money(o.taxAmount)}</span></div>}
              {!!o.transportationCost && <div className="flex justify-between"><span className="text-slate-500">Transport</span><span>{money(o.transportationCost)}</span></div>}
              {!!o.discountAmount && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>−{money(o.discountAmount)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-800"><span>Total</span><span>{money(o.totalAmount)}</span></div>
            </div>
          </Section>

          <Section title={`Shipments (${o.shipments.length})`}
            action={canShip && !shipForm.open && <Button size="sm" variant="outline" onClick={() => setShipForm((f) => ({ ...f, open: true, deliveryPlace: f.deliveryPlace || o.deliveryAddress || "" }))}><Plus className="w-3.5 h-3.5 mr-1" /> Add shipping ID</Button>}>
            {o.shipments.length === 0 && !shipForm.open && <p className="text-xs text-slate-400">No shipping IDs yet. Add one when the supplier dispatches — an order can arrive in several shipments.</p>}
            <div className="space-y-1.5">
              {o.shipments.map((sh) => (
                <div key={sh.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{sh.shippingId}</span>
                    <span className="text-slate-500">{sh.transporterName ? ` · ${sh.transporterName}` : ""} · dispatched {fmtDate(sh.dispatchDate)}</span>
                    {sh.deliveryPlace && <div className="flex items-center gap-1 text-slate-500"><MapPin className="h-3 w-3 shrink-0" />{sh.deliveryPlace}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${sh.status === "RECEIVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {sh.status === "RECEIVED" ? `Received ${fmtDate(sh.receivedAt)}` : "On the way"}
                    </span>
                    {sh.status !== "RECEIVED" && (
                      <button disabled={busy} className="text-slate-400 hover:text-rose-600" title="Remove"
                        onClick={() => run(() => purchaseApi.deleteShipment(sh.id), "Shipment removed.", "Could not remove the shipment.")}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {shipForm.open && (
              <div className="mt-2 grid grid-cols-1 @lg:grid-cols-3 gap-2">
                <div><Label className="text-xs">Shipping ID *</Label><Input value={shipForm.shippingId} onChange={(e) => setShipForm((f) => ({ ...f, shippingId: e.target.value }))} placeholder="AWB / LR / docket no." /></div>
                <div><Label className="text-xs">Transporter</Label><Input value={shipForm.transporterName} onChange={(e) => setShipForm((f) => ({ ...f, transporterName: e.target.value }))} placeholder="Courier / lorry" /></div>
                <div><Label className="text-xs">Dispatch date</Label><Input type="date" value={shipForm.dispatchDate} onChange={(e) => setShipForm((f) => ({ ...f, dispatchDate: e.target.value }))} /></div>
                <div className="@lg:col-span-3"><Label className="text-xs">Delivery place</Label><Input value={shipForm.deliveryPlace} onChange={(e) => setShipForm((f) => ({ ...f, deliveryPlace: e.target.value }))} placeholder="Site address, our godown, or transport office to collect from" /></div>
                <div className="@lg:col-span-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShipForm((f) => ({ ...f, open: false }))}>Cancel</Button>
                  <Button size="sm" disabled={busy} onClick={addShipment}>Save shipment</Button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Paid to supplier"
            action={!payForm.open && !["CANCELLED", "REJECTED"].includes(o.status) && (
              <Button size="sm" variant="outline" onClick={() => setPayForm((f) => ({ ...f, open: true, amount: o.balance > 0 ? String(o.balance) : "" }))}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Record payment
              </Button>
            )}>
            <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-slate-400">Total</div><div className="font-bold text-slate-800">{money(o.totalAmount)}</div></div>
              <div><div className="text-slate-400">Paid</div><div className="font-bold text-emerald-700">{money(o.paid)}</div></div>
              <div><div className="text-slate-400">Balance</div><div className={`font-bold ${o.balance > 0 ? "text-rose-600" : "text-slate-500"}`}>{money(o.balance)}</div></div>
            </div>
            {o.payments.length === 0 && !payForm.open && <p className="text-xs text-slate-400">No payments recorded yet.</p>}
            <div className="space-y-1.5">
              {o.payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span className="text-slate-600">{fmtDate(p.paymentDate)} · {p.paymentMethod?.replaceAll("_", " ") || "—"}{p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}</span>
                  <span className="font-bold text-slate-800">{money(p.amount)}</span>
                </div>
              ))}
            </div>
            {payForm.open && (
              <div className="mt-2 grid grid-cols-1 @lg:grid-cols-2 gap-2">
                <div><Label className="text-xs">Amount *</Label><Input type="number" min="0" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></div>
                <div><Label className="text-xs">Date</Label><Input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))} /></div>
                <div><Label className="text-xs">Method</Label>
                  <select className={selectCls} value={payForm.paymentMethod} onChange={(e) => setPayForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                  </select>
                </div>
                <div><Label className="text-xs">Reference no.</Label><Input value={payForm.referenceNumber} onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))} placeholder="UTR / cheque no." /></div>
                <div className="@lg:col-span-2"><Label className="text-xs">Notes</Label><Input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} /></div>
                <div className="@lg:col-span-2 flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPayForm((f) => ({ ...f, open: false }))}>Cancel</Button>
                  <Button size="sm" disabled={busy} onClick={recordPayment}>Save payment</Button>
                </div>
              </div>
            )}
          </Section>

          {o.notes && <p className="text-xs text-slate-500"><span className="font-semibold">Notes:</span> {o.notes}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
