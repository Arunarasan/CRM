import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  PackageCheck, Search, Loader2, MapPin, Truck, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, X, ClipboardCheck,
} from "lucide-react";
import { purchaseApi, ProjectPurchases, ProjectReceipt, ShipmentLookup, OrderLine } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type { Warehouse } from "@/types/inventory";
import ImageCaptureField from "@/components/ImageCaptureField";
import { resolveFileUrl } from "@/lib/uploadFile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";

const fmtDateTime = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy, hh:mm a") : "—");
const OPEN_STATUSES = ["APPROVED", "SENT", "CONFIRMED", "PARTIAL"];
const selectCls =
  "w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none";

/** The delivery being checked: which PO it belongs to and the products still expected on it. */
interface Target { purchaseOrderId: number; poNumber: string; supplierName?: string | null; deliveryPlace?: string | null; warehouseId?: number | null; warehouseName?: string | null; items: OrderLine[] }
interface CheckLine { productId: number; verified: boolean; received: string; damaged: string; remarks: string }

/**
 * Project → Resources → Goods Received: enter the shipping ID of a delivery, tick off the products
 * that arrived (with damaged qty), submit — the receipt is approved and stock booked in one step.
 */
export default function ProjectGoodsReceivedTab({ projectId }: { projectId: number }) {
  const [receipts, setReceipts] = useState<ProjectReceipt[]>([]);
  const [purchases, setPurchases] = useState<ProjectPurchases | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [shippingId, setShippingId] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<ShipmentLookup[] | null>(null); // null = not searched yet
  const [target, setTarget] = useState<Target | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      purchaseApi.getProjectReceipts(projectId).then(setReceipts),
      purchaseApi.getProjectPurchases(projectId).then(setPurchases).catch(() => setPurchases(null)),
    ]).catch((e) => toast.error(apiError(e, "Could not load goods received reports.")))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
  }, [load]);

  const openOrders = useMemo(() => (purchases?.orders || []).filter((o) => OPEN_STATUSES.includes(o.status)), [purchases]);
  const awaiting = useMemo(() => openOrders.flatMap((o) =>
    o.shipments.filter((s) => s.status === "IN_TRANSIT").map((s) => ({ shippingId: s.shippingId, poNumber: o.poNumber, supplierName: o.supplierName, deliveryPlace: s.deliveryPlace }))), [openOrders]);

  const find = async (id = shippingId) => {
    const q = id.trim();
    if (!q) { toast.error("Enter the shipping ID."); return; }
    setShippingId(q);
    setSearching(true);
    setTarget(null);
    try {
      const found = await purchaseApi.lookupShipment(projectId, q);
      setMatches(found);
      const usable = found.filter((m) => m.shipmentStatus !== "RECEIVED" && OPEN_STATUSES.includes(m.poStatus));
      if (found.length === 1 && usable.length === 1) pick(usable[0]);
    } catch (e) {
      toast.error(apiError(e, "Could not look up that shipping ID."));
    } finally {
      setSearching(false);
    }
  };

  const pick = (m: { purchaseOrderId: number; poNumber: string; supplierName?: string | null; deliveryPlace?: string | null; warehouseId?: number | null; warehouseName?: string | null; items: OrderLine[] }) =>
    setTarget({ purchaseOrderId: m.purchaseOrderId, poNumber: m.poNumber, supplierName: m.supplierName, deliveryPlace: m.deliveryPlace, warehouseId: m.warehouseId, warehouseName: m.warehouseName, items: m.items });

  const reset = () => { setShippingId(""); setMatches(null); setTarget(null); };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-emerald-600" /> Goods Received</h2>

      {/* 1. Find the delivery by its shipping ID */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
        <div>
          <Label className="text-xs font-semibold text-slate-600">Shipping ID of the delivery</Label>
          <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); find(); }}>
            <Input value={shippingId} onChange={(e) => setShippingId(e.target.value)} placeholder="AWB / LR / docket no." className="flex-1" />
            <Button type="submit" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-1" />} Find</Button>
            {(matches || target) && <Button type="button" variant="outline" onClick={reset}><X className="w-4 h-4" /></Button>}
          </form>
        </div>

        {!matches && awaiting.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 mb-1">On the way</div>
            <div className="flex flex-wrap gap-1.5">
              {awaiting.map((a) => (
                <button key={`${a.poNumber}-${a.shippingId}`} onClick={() => find(a.shippingId)} title={a.deliveryPlace ? `Delivering to ${a.deliveryPlace}` : undefined}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100">
                  <Truck className="h-3 w-3" /> {a.shippingId} <span className="font-normal text-amber-600">· {a.poNumber}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {matches && !target && (
          <LookupResult shippingId={shippingId} matches={matches} openOrders={openOrders} onPick={pick} />
        )}
      </div>

      {/* 2. Verify the products and submit */}
      {target && (
        <VerifyForm key={`${target.purchaseOrderId}-${shippingId}`} target={target} shippingId={shippingId} warehouses={warehouses}
          onCancel={() => setTarget(null)}
          onDone={async () => { reset(); await load(); }} />
      )}

      {/* 3. History */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-2">Goods received reports ({receipts.length})</h3>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : receipts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-400">No deliveries received for this project yet.</div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => {
              const open = expanded === r.id;
              return (
                <div key={r.id} className="rounded-xl border border-slate-100 bg-white">
                  <button onClick={() => setExpanded(open ? null : r.id)} className="w-full p-3 text-left flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800">{r.grnNumber}</span>
                        {r.shippingId && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"><Truck className="h-3 w-3" />{r.shippingId}</span>}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                          {r.status === "APPROVED" ? "Verified" : r.qcStatus === "REJECT" ? "Rejected" : r.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{r.poNumber} · {r.supplierName || "—"}</div>
                      <div className="text-xs text-slate-400">{fmtDateTime(r.date)}{r.receivedBy ? ` · by ${r.receivedBy}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-emerald-700">{r.totalAccepted} accepted</span>
                      {r.totalDamaged > 0 && <span className="font-semibold text-rose-600">{r.totalDamaged} damaged</span>}
                      {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-slate-50 px-3 pb-3 pt-2 space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-slate-400"><tr className="text-left"><th className="py-1 font-medium">Product</th><th className="py-1 font-medium text-right">Received</th><th className="py-1 font-medium text-right">Accepted</th><th className="py-1 font-medium text-right">Damaged</th><th className="py-1 font-medium pl-3">Remarks</th></tr></thead>
                          <tbody>
                            {r.items.map((i, idx) => (
                              <tr key={idx} className="border-t border-slate-50">
                                <td className="py-1.5 font-medium text-slate-700">{i.productName}</td>
                                <td className="py-1.5 text-right">{i.receivedQuantity} {i.unit || ""}</td>
                                <td className="py-1.5 text-right text-emerald-700 font-semibold">{i.acceptedQuantity}</td>
                                <td className={`py-1.5 text-right ${i.damagedQuantity ? "text-rose-600 font-semibold" : "text-slate-400"}`}>{i.damagedQuantity || 0}</td>
                                <td className="py-1.5 pl-3 text-slate-500">{i.remarks || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {r.warehouseName && <span>Stored at: <b className="text-slate-700">{r.warehouseName}</b></span>}
                        {r.supplierInvoiceNumber && <span>Supplier invoice: <b className="text-slate-700">{r.supplierInvoiceNumber}</b></span>}
                        {r.vehicleNumber && <span>Vehicle: <b className="text-slate-700">{r.vehicleNumber}</b></span>}
                      </div>
                      {r.notes && <p className="text-xs text-slate-500">{r.notes}</p>}
                      {r.photos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {r.photos.map((p) => (
                            <a key={p} href={resolveFileUrl(p)} target="_blank" rel="noreferrer">
                              <img src={resolveFileUrl(p)} alt="Delivery" className="h-16 w-16 rounded-lg object-cover border border-slate-100" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LookupResult({ shippingId, matches, openOrders, onPick }: {
  shippingId: string;
  matches: ShipmentLookup[];
  openOrders: ProjectPurchases["orders"];
  onPick: (t: Target) => void;
}) {
  const [poId, setPoId] = useState("");

  if (matches.length === 0) {
    // Not registered beforehand — let them say which order this delivery is for; the ID is saved on submit.
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-2">
        <p className="text-xs text-amber-800 flex items-start gap-1.5"><AlertTriangle className="h-4 w-4 shrink-0" />
          <span>No purchase order on this project is expecting <b>{shippingId}</b>. Pick the order this delivery is for.</span></p>
        {openOrders.length === 0 ? (
          <p className="text-xs text-amber-700">There are no approved, open purchase orders on this project.</p>
        ) : (
          <div className="flex gap-2">
            <select className={selectCls} value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">Select purchase order…</option>
              {openOrders.map((o) => <option key={o.id} value={o.id}>{o.poNumber} · {o.supplierName}</option>)}
            </select>
            <Button disabled={!poId} onClick={() => {
              const o = openOrders.find((x) => String(x.id) === poId);
              if (o) onPick({ purchaseOrderId: o.id, poNumber: o.poNumber, supplierName: o.supplierName, deliveryPlace: o.deliveryAddress, warehouseId: null, warehouseName: o.warehouseName, items: o.items });
            }}>Continue</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {matches.length > 1 && <p className="text-xs text-slate-500">This shipping ID is on {matches.length} purchase orders — pick one to check.</p>}
      {matches.map((m) => {
        const received = m.shipmentStatus === "RECEIVED";
        const closed = !OPEN_STATUSES.includes(m.poStatus);
        return (
          <div key={m.shipmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
            <div className="text-xs">
              <div className="font-bold text-slate-800 text-sm">{m.poNumber} · {m.supplierName}</div>
              <div className="text-slate-500">{m.items.length} products{m.transporterName ? ` · ${m.transporterName}` : ""}</div>
              {m.deliveryPlace && <div className="flex items-center gap-1 text-slate-500"><MapPin className="h-3 w-3 shrink-0" />{m.deliveryPlace}</div>}
            </div>
            {received ? (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Already received{m.grnNumber ? ` (${m.grnNumber})` : ""}</span>
            ) : closed ? (
              <span className="text-xs font-semibold text-amber-700">Order is {m.poStatus.replaceAll("_", " ").toLowerCase()} — approve it first</span>
            ) : (
              <Button size="sm" onClick={() => onPick(m)}>Check products</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VerifyForm({ target, shippingId, warehouses, onCancel, onDone }: {
  target: Target; shippingId: string; warehouses: Warehouse[]; onCancel: () => void; onDone: () => void | Promise<void>;
}) {
  const pending = target.items.filter((i) => i.outstanding > 0);
  const [lines, setLines] = useState<CheckLine[]>(() => pending.map((i) => ({
    productId: i.productId, verified: false, received: String(i.outstanding), damaged: "0", remarks: "",
  })));
  const [warehouseId, setWarehouseId] = useState(target.warehouseId ? String(target.warehouseId) : "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setLine = (productId: number, patch: Partial<CheckLine>) =>
    setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  const verified = lines.filter((l) => l.verified);
  const allVerified = lines.length > 0 && verified.length === lines.length;

  const submit = async () => {
    if (verified.length === 0) { toast.error("Tick at least one product you have checked."); return; }
    for (const l of verified) {
      const rec = Number(l.received), dmg = Number(l.damaged) || 0;
      if (!rec || rec <= 0) { toast.error("Enter the received quantity for every ticked product."); return; }
      if (dmg < 0 || dmg > rec) { toast.error("Damaged quantity can't be more than what was received."); return; }
    }
    if (!target.warehouseId && !target.warehouseName && !warehouseId) { toast.error("Choose where the goods are stored."); return; }
    const anyDamaged = verified.some((l) => Number(l.damaged) > 0);
    setSaving(true);
    try {
      const grn = await purchaseApi.receiveGoods({
        purchaseOrderId: target.purchaseOrderId,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        shippingId,
        supplierInvoiceNumber: invoiceNo || undefined,
        vehicleNumber: vehicleNo || undefined,
        qcStatus: anyDamaged ? "PARTIAL_PASS" : "PASS",
        notes: notes || undefined,
        photoUrls: photos,
        items: verified.map((l) => ({
          productId: l.productId, receivedQuantity: Number(l.received), damagedQuantity: Number(l.damaged) || 0, remarks: l.remarks || undefined,
        })),
      });
      toast.success(`${grn.grnNumber} submitted — goods received against ${target.poNumber}.`);
      await onDone();
    } catch (e) {
      toast.error(apiError(e, "Could not submit the goods received report."));
    } finally {
      setSaving(false);
    }
  };

  const productById = new Map(target.items.map((i) => [i.productId, i]));

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> Verify shipment {shippingId}</h3>
          <p className="text-xs text-slate-500">{target.poNumber} · {target.supplierName}</p>
          {target.deliveryPlace && <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /> Delivered to {target.deliveryPlace}</p>}
        </div>
        {lines.length > 0 && (
          <button className="text-xs font-semibold text-emerald-700 hover:underline"
            onClick={() => setLines((ls) => ls.map((l) => ({ ...l, verified: !allVerified })))}>
            {allVerified ? "Untick all" : "Tick all"}
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-xs text-slate-500">Everything on this order has already been received.</p>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => {
            const p = productById.get(l.productId)!;
            return (
              <div key={l.productId} className={`rounded-xl border p-2.5 transition ${l.verified ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100"}`}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-emerald-600" checked={l.verified} onChange={(e) => setLine(l.productId, { verified: e.target.checked })} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800">{p.productName}</div>
                    <div className="text-[11px] text-slate-500">Ordered {p.ordered} · already received {p.received} · <b>expected {p.outstanding} {p.unit || ""}</b></div>
                  </div>
                </label>
                {l.verified && (
                  <div className="mt-2 grid grid-cols-2 @lg:grid-cols-4 gap-2 pl-6">
                    <div><Label className="text-[11px]">Received</Label><Input type="number" min="0" value={l.received} onChange={(e) => setLine(l.productId, { received: e.target.value })} /></div>
                    <div><Label className="text-[11px]">Damaged</Label><Input type="number" min="0" value={l.damaged} onChange={(e) => setLine(l.productId, { damaged: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="text-[11px]">Remarks</Label><Input value={l.remarks} onChange={(e) => setLine(l.productId, { remarks: e.target.value })} placeholder="Optional" /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 @lg:grid-cols-3 gap-2">
        <div><Label className="text-xs">Store in</Label>
          <select className={selectCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">{target.warehouseName ? `${target.warehouseName} (order default)` : "Select warehouse…"}</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div><Label className="text-xs">Supplier invoice no.</Label><Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} /></div>
        <div><Label className="text-xs">Vehicle no.</Label><Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} /></div>
        <div className="@lg:col-span-3"><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to note about this delivery" /></div>
      </div>

      <div>
        <Label className="text-xs">Photos</Label>
        <div className="mt-1 flex flex-wrap gap-2 items-start">
          {photos.map((p) => (
            <div key={p} className="relative">
              <img src={resolveFileUrl(p)} alt="Delivery" className="h-16 w-16 rounded-lg object-cover border border-slate-100" />
              <button className="absolute -top-1.5 -right-1.5 rounded-full bg-white shadow p-0.5 text-slate-500 hover:text-rose-600" onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="w-48">
            <ImageCaptureField key={photos.length} module="GRN" label="Add photo" onChange={({ url }) => url && setPhotos((ps) => [...ps, url])} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving || verified.length === 0} onClick={submit}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
          Submit ({verified.length} product{verified.length === 1 ? "" : "s"})
        </Button>
      </div>
    </div>
  );
}
