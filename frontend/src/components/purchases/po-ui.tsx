import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight, Loader2, MapPin, Package, Plus, Trash2, Truck } from "lucide-react";
import { purchaseApi, type PoShipment } from "@/api/purchaseApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

/*
 * One look for purchase orders everywhere — Purchasing → Orders, a project's Purchase Orders tab, a
 * supplier's profile and the PO page itself: the same status names and colours, money format, list
 * table and shipments panel.
 */

export const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT: "Sent to supplier",
  CONFIRMED: "Confirmed",
  PARTIAL: "Partly received",
  COMPLETED: "Received",
  CANCELLED: "Cancelled",
};

const PO_STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  DRAFT: { pill: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  PENDING_APPROVAL: { pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" },
  APPROVED: { pill: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  REJECTED: { pill: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
  SENT: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  CONFIRMED: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-200", dot: "bg-indigo-500" },
  PARTIAL: { pill: "bg-orange-50 text-orange-700 ring-orange-200", dot: "bg-orange-500" },
  COMPLETED: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { pill: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

export const poStatusLabel = (s?: string | null) =>
  (s && PO_STATUS_LABEL[s]) || (s || "").replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export const poStatusDot = (s?: string | null) => (s && PO_STATUS_STYLE[s]?.dot) || "bg-slate-400";

export function PoStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "md" }) {
  const st = PO_STATUS_STYLE[status] || PO_STATUS_STYLE.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ring-transparent ${st.pill} ${
      size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {poStatusLabel(status)}
    </span>
  );
}

export const poMoney = (n?: number | null) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const poDate = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");

/** Received share of an order, 0–100. */
export function ReceivedBar({ pct, className = "" }: { pct: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${v >= 100 ? "bg-emerald-500" : "bg-emerald-400"}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-slate-500">{v}%</span>
    </div>
  );
}

/** A purchase order as the list table shows it — fields that aren't known are left out. */
export interface PoListRow {
  id: number;
  poNumber: string;
  date?: string | null;
  supplierName?: string | null;
  projectName?: string | null;
  expectedDeliveryDate?: string | null;
  status: string;
  totalAmount?: number | null;
  paid?: number | null;
  balance?: number | null;
  receivedPct?: number | null;
  shippingIds?: string[];
}

/**
 * The purchase-order list used by Purchasing and by a project: click a row to open the order. Columns
 * for project / received / paid / balance appear only when the rows carry them.
 */
export function PoListTable({ rows, loading, empty, onHover }: {
  rows: PoListRow[];
  loading?: boolean;
  empty?: React.ReactNode;
  /** Optional extra props per row (e.g. a hover card). */
  onHover?: (row: PoListRow) => Record<string, unknown>;
}) {
  const navigate = useNavigate();
  const showProject = rows.some((r) => r.projectName);
  const showReceived = rows.some((r) => r.receivedPct != null);
  const showPaid = rows.some((r) => r.paid != null);

  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-white p-4">
        {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
        <Package className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-2 text-sm font-semibold text-slate-600">{empty || "No purchase orders yet"}</div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Supplier</th>
              {showProject && <th className="hidden px-4 py-2.5 lg:table-cell">Project</th>}
              <th className="hidden px-4 py-2.5 md:table-cell">Expected</th>
              <th className="px-4 py-2.5">Status</th>
              {showReceived && <th className="hidden w-40 px-4 py-2.5 md:table-cell">Received</th>}
              <th className="px-4 py-2.5 text-right">Total</th>
              {showPaid && <th className="hidden px-4 py-2.5 text-right sm:table-cell">Paid</th>}
              {showPaid && <th className="px-4 py-2.5 text-right">Balance</th>}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/purchases/orders/${r.id}`)} {...(onHover ? onHover(r) : {})}
                className="cursor-pointer transition-colors hover:bg-emerald-50/40">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{r.poNumber}</div>
                  <div className="whitespace-nowrap text-xs text-slate-400">
                    {poDate(r.date)}
                    {!!r.shippingIds?.length && <> · <Truck className="-mt-0.5 inline h-3 w-3" /> {r.shippingIds.join(", ")}</>}
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{r.supplierName || "—"}</td>
                {showProject && <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{r.projectName || "—"}</td>}
                <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 md:table-cell">{poDate(r.expectedDeliveryDate)}</td>
                <td className="px-4 py-3"><PoStatusBadge status={r.status} /></td>
                {showReceived && <td className="hidden px-4 py-3 md:table-cell">{r.receivedPct != null ? <ReceivedBar pct={r.receivedPct} /> : "—"}</td>}
                <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">{poMoney(r.totalAmount)}</td>
                {showPaid && <td className="hidden px-4 py-3 text-right tabular-nums text-emerald-700 sm:table-cell">{poMoney(r.paid)}</td>}
                {showPaid && (
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${Number(r.balance) > 0 ? "text-rose-600" : "text-slate-400"}`}>
                    {poMoney(r.balance)}
                  </td>
                )}
                <td className="pr-3 text-slate-300"><ChevronRight className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const selectCls = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";

/**
 * Shipments on an order: each shipping ID with transporter, dispatch date, where it's going and whether
 * it has arrived — plus the form to add one. An order can arrive in several shipments, to several places.
 */
export function PoShipmentsPanel({ poId, addresses, canShip, openSignal, onChanged }: {
  poId: number;
  addresses: string[];
  canShip: boolean;
  /** Bump to open the add form from outside (e.g. a quick-action button). */
  openSignal?: number;
  onChanged?: () => void;
}) {
  const [shipments, setShipments] = useState<PoShipment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const blank = () => ({ open: false, shippingId: "", transporterName: "", deliveryPlace: "", otherPlace: false, dispatchDate: today() });
  const [form, setForm] = useState(blank);

  const load = useCallback(() => {
    purchaseApi.getShipments(poId).then(setShipments).catch(() => setShipments([]));
  }, [poId]);
  useEffect(() => { load(); }, [load]);

  const shipmentsTo = (a: string) => (shipments || []).filter((s) => s.deliveryPlace === a).length;
  const openForm = () => {
    const next = addresses.find((a) => shipmentsTo(a) === 0) || addresses[0] || "";
    setForm({ ...blank(), open: true, deliveryPlace: next, otherPlace: addresses.length === 0 });
  };
  useEffect(() => { if (openSignal && canShip) openForm(); }, [openSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.shippingId.trim()) { toast.error("Enter the shipping ID."); return; }
    setBusy(true);
    try {
      await purchaseApi.addShipment(poId, {
        shippingId: form.shippingId.trim(),
        transporterName: form.transporterName.trim() || undefined,
        deliveryPlace: form.deliveryPlace.trim() || undefined,
        dispatchDate: form.dispatchDate || undefined,
      });
      toast.success("Shipment added.");
      setForm(blank());
      load();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e, "Could not add the shipment."));
    } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    setBusy(true);
    try { await purchaseApi.deleteShipment(id); toast.success("Shipment removed."); load(); onChanged?.(); }
    catch (e) { toast.error(apiError(e, "Could not remove the shipment.")); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {shipments == null ? "Loading…" : shipments.length === 0 ? "No shipping IDs yet — add one when the supplier dispatches."
            : `${shipments.filter((s) => s.status !== "RECEIVED").length} on the way · ${shipments.filter((s) => s.status === "RECEIVED").length} received`}
        </span>
        {canShip && !form.open && (
          <Button size="sm" variant="outline" onClick={openForm}><Plus className="mr-1 h-3.5 w-3.5" /> Add shipping ID</Button>
        )}
      </div>

      {shipments == null ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
      ) : (
        <ul className="space-y-2">
          {shipments.map((sh) => (
            <li key={sh.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div><span className="font-bold text-slate-800">{sh.shippingId}</span>
                  <span className="text-slate-500">{sh.transporterName ? ` · ${sh.transporterName}` : ""} · dispatched {poDate(sh.dispatchDate)}</span></div>
                {sh.deliveryPlace && <div className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0" />{sh.deliveryPlace}</div>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sh.status === "RECEIVED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {sh.status === "RECEIVED" ? `Received ${poDate(sh.receivedAt)}` : "On the way"}
                </span>
                {sh.status !== "RECEIVED" && canShip && (
                  <button disabled={busy} className="text-slate-400 hover:text-rose-600" title="Remove" aria-label="Remove shipment" onClick={() => remove(sh.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {form.open && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3 sm:grid-cols-3">
          <div className="space-y-1"><Label className="text-xs">Shipping ID *</Label>
            <Input autoFocus value={form.shippingId} onChange={(e) => setForm((f) => ({ ...f, shippingId: e.target.value }))} placeholder="AWB / LR / docket no." /></div>
          <div className="space-y-1"><Label className="text-xs">Transporter</Label>
            <Input value={form.transporterName} onChange={(e) => setForm((f) => ({ ...f, transporterName: e.target.value }))} placeholder="Courier / lorry" /></div>
          <div className="space-y-1"><Label className="text-xs">Dispatch date</Label>
            <Input type="date" value={form.dispatchDate} onChange={(e) => setForm((f) => ({ ...f, dispatchDate: e.target.value }))} /></div>
          <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Delivery place</Label>
            {addresses.length > 0 && (
              <select className={selectCls} value={form.otherPlace ? "__other" : form.deliveryPlace}
                onChange={(e) => setForm((f) => e.target.value === "__other"
                  ? { ...f, otherPlace: true, deliveryPlace: "" }
                  : { ...f, otherPlace: false, deliveryPlace: e.target.value })}>
                {addresses.map((a) => <option key={a} value={a}>{a}{shipmentsTo(a) ? ` (${shipmentsTo(a)} already)` : ""}</option>)}
                <option value="__other">Somewhere else…</option>
              </select>
            )}
            {form.otherPlace && (
              <Input value={form.deliveryPlace} onChange={(e) => setForm((f) => ({ ...f, deliveryPlace: e.target.value }))}
                placeholder="Site address, our godown, or transport office to collect from" />
            )}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-3">
            <Button size="sm" variant="outline" onClick={() => setForm(blank())}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={save}>Save shipment</Button>
          </div>
        </div>
      )}
    </div>
  );
}
