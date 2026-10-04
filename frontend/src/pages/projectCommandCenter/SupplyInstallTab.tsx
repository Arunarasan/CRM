import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Loader2, ShoppingCart, Truck, PackageCheck, Wrench, AlertTriangle, Plus, CheckCircle2, MapPin, Warehouse,
  FileText, Link2,
} from "lucide-react";
import api from "@/lib/api";
import { projectApi, SupplyBoard, SupplyRow, SupplyStage } from "@/api/projectApi";
import { purchaseApi } from "@/api/purchaseApi";
import { Button } from "@/components/ui/button";
import { BaseInput } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SearchableSelect from "@/components/ui/searchable-select";
import { toast } from "@/components/ui/toast";
import { UNIT_DATALIST_ID } from "@/components/UnitOptions";

const STAGES: { key: SupplyStage; label: string; tone: string }[] = [
  { key: "TO_BUY", label: "To Buy", tone: "bg-rose-100 text-rose-700" },
  { key: "IN_STOCK", label: "In Store", tone: "bg-sky-100 text-sky-700" },
  { key: "ORDERED", label: "Ordered", tone: "bg-amber-100 text-amber-700" },
  { key: "RECEIVED", label: "Received", tone: "bg-cyan-100 text-cyan-700" },
  { key: "AT_SITE", label: "At Site", tone: "bg-violet-100 text-violet-700" },
  { key: "INSTALLED", label: "Installed", tone: "bg-emerald-100 text-emerald-700" },
  { key: "NOT_NEEDED", label: "Not needed", tone: "bg-slate-100 text-slate-500" },
];
const stageOf = (k: SupplyStage) => STAGES.find((s) => s.key === k) || STAGES[0];

const inr = (n?: number | null) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const qty = (n: number | null | undefined) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Supply & Install — the products we buy for this project and install for the customer.
 * Each material moves To Buy → Ordered → Received → At Site → Installed. Buying raises one
 * purchase order per supplier (tagged to the project); receiving happens on the order as usual.
 */
export default function SupplyInstallTab({ projectId, onChanged }: { projectId: number; onChanged?: () => void }) {
  const [board, setBoard] = useState<SupplyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SupplyStage | "ALL">("ALL");
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  // Buy dialog
  const [buyOpen, setBuyOpen] = useState(false);
  const [buyQty, setBuyQty] = useState<Record<number, string>>({});
  const [buySupplier, setBuySupplier] = useState<Record<number, string>>({});
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  const [expected, setExpected] = useState("");
  const [toSite, setToSite] = useState(false);
  const [busy, setBusy] = useState(false);

  // Add product dialog
  const [addOpen, setAddOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ productId: "", qty: "", unit: "" });
  /** When set, the Add dialog links this unmatched quote line (and remembers the name). */
  const [linking, setLinking] = useState<string | null>(null);
  const autoLoaded = useRef(false);

  // Per-row action dialog (send to site / mark installed)
  const [action, setAction] = useState<{ row: SupplyRow; kind: "send" | "install"; value: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    projectApi.getSupplyInstall(projectId)
      .then((b) => {
        setBoard(b);
        // First visit to a project made from a quote with an empty list: fill it from the quote.
        if (!autoLoaded.current && b.hasQuote && b.rows.length === 0) {
          autoLoaded.current = true;
          projectApi.loadSupplyFromQuote(projectId)
            .then((r) => { if (r.added > 0) { toast.success(`Linked ${r.added} product(s) from the quote`); load(); } })
            .catch(() => {});
        }
      })
      .catch(() => toast.error("Could not load Supply & Install"))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(load, [load]);

  const rows = useMemo(
    () => (board?.rows || []).filter((r) => filter === "ALL" || r.stage === filter),
    [board, filter],
  );
  const pickedRows = (board?.rows || []).filter((r) => selected[r.requirementId]);
  const s = board?.summary;

  const openBuy = (list: SupplyRow[]) => {
    if (!list.length) { toast.error("Tick the items you want to buy"); return; }
    setSelected(Object.fromEntries(list.map((r) => [r.requirementId, true])));
    setBuyQty(Object.fromEntries(list.map((r) => [r.requirementId, String(r.suggestedBuy || Math.max(0, r.required - r.ordered))])));
    setBuySupplier({});
    if (!suppliers.length) purchaseApi.getSuppliers().then((l: any[]) => setSuppliers(l || [])).catch(() => {});
    setBuyOpen(true);
  };

  const submitBuy = async () => {
    const lines = pickedRows
      .map((r) => ({
        requirementId: r.requirementId,
        quantity: Number(buyQty[r.requirementId] || 0),
        supplierId: buySupplier[r.requirementId] ? Number(buySupplier[r.requirementId]) : undefined,
      }))
      .filter((l) => l.quantity > 0);
    if (!lines.length) { toast.error("Enter a quantity to buy"); return; }
    setBusy(true);
    try {
      const pos = await projectApi.buySupplyItems(projectId, {
        lines, expectedDeliveryDate: expected || undefined, deliverToSite: toSite,
      });
      toast.success(`Created ${pos.length} purchase order${pos.length > 1 ? "s" : ""}: ${pos.map((p) => p.poNumber).join(", ")}`);
      setBuyOpen(false);
      setSelected({});
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not create the purchase order");
    } finally {
      setBusy(false);
    }
  };

  const openAdd = (line?: { name: string; quantity: number; unit?: string | null }) => {
    if (!products.length) api.get(`/inventory/products?size=1000`).then((res) => setProducts(res.data.content || [])).catch(() => {});
    setLinking(line?.name ?? null);
    setNewItem({ productId: "", qty: line ? String(line.quantity) : "", unit: line?.unit || "" });
    setAddOpen(true);
  };

  const reloadFromQuote = async () => {
    setBusy(true);
    try {
      const r = await projectApi.loadSupplyFromQuote(projectId);
      toast.success(r.added ? `Linked ${r.added} product(s) from the quote` : "Nothing new to link from the quote");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not read the quote");
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async () => {
    if (!newItem.productId || !Number(newItem.qty)) { toast.error("Pick a product and quantity"); return; }
    const product = products.find((p) => String(p.id) === newItem.productId);
    setBusy(true);
    try {
      if (linking) {
        await projectApi.linkSupplyQuoteLine(projectId, {
          name: linking, productId: Number(newItem.productId), quantity: Number(newItem.qty), unit: newItem.unit || product?.unit,
        });
        toast.success(`Linked "${linking}" — it will match automatically next time`);
      } else {
        await projectApi.addMaterial(projectId, {
          product: { id: Number(newItem.productId) },
          requiredQty: Number(newItem.qty),
          unit: newItem.unit || product?.unit,
        } as any);
        toast.success("Added to the supply list");
      }
      setAddOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not add the product");
    } finally {
      setBusy(false);
    }
  };

  const submitAction = async () => {
    if (!action) return;
    const value = Number(action.value || 0);
    setBusy(true);
    try {
      if (action.kind === "send") {
        if (value <= 0) { toast.error("Enter a quantity"); return; }
        await projectApi.sendSupplyToSite(projectId, action.row.requirementId, value);
        toast.success(`${action.row.productName} sent to site`);
      } else {
        await projectApi.setSupplyInstalled(projectId, action.row.requirementId, value);
        toast.success(`${action.row.productName}: ${qty(value)} installed`);
      }
      setAction(null);
      load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !board) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  const pct = (n: number) => (s && s.items ? Math.round((n / s.items) * 100) : 0);
  const toBuyRows = (board?.rows || []).filter((r) => r.stage === "TO_BUY");

  return (
    <div className="space-y-5">
      {/* Header + progress strip */}
      <div className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Supply & Install</h3>
            <p className="text-sm text-slate-500">Products we buy for this project and install for the customer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {board?.hasQuote && (
              <Button variant="outline" size="sm" onClick={reloadFromQuote} disabled={busy}><FileText className="h-4 w-4 mr-1" />Load from quote</Button>
            )}
            <Button variant="outline" size="sm" onClick={() => openAdd()}><Plus className="h-4 w-4 mr-1" />Add product</Button>
            <Button size="sm" onClick={() => openBuy(pickedRows.length ? pickedRows : toBuyRows)}>
              <ShoppingCart className="h-4 w-4 mr-1" />
              {pickedRows.length ? `Buy ${pickedRows.length} selected` : `Buy all to-buy (${toBuyRows.length})`}
            </Button>
          </div>
        </div>

        {s && s.items > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "To buy", v: s.toBuy, icon: ShoppingCart, tone: "text-rose-600" },
                { label: "Ordered", v: s.ordered, icon: Truck, tone: "text-amber-600" },
                { label: "Received", v: s.received, icon: PackageCheck, tone: "text-cyan-600" },
                { label: "At site", v: s.atSite, icon: MapPin, tone: "text-violet-600" },
                { label: "Installed", v: s.installed, icon: Wrench, tone: "text-emerald-600" },
              ].map((c) => (
                <div key={c.label} className="rounded-xl border bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500"><c.icon className={`h-3.5 w-3.5 ${c.tone}`} />{c.label}</div>
                  <div className="text-lg font-semibold text-slate-900">{c.v}<span className="text-xs font-normal text-slate-400"> / {s.items}</span></div>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Installed {pct(s.installed)}%</span>
                <span>{s.readyToInstall ? "All material at site — ready to install" : `${s.items - s.atSite} item(s) not at site yet`}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                <div className="bg-emerald-500" style={{ width: `${pct(s.installed)}%` }} />
                <div className="bg-violet-400" style={{ width: `${pct(s.atSite - s.installed)}%` }} />
                <div className="bg-cyan-300" style={{ width: `${pct(s.received - s.atSite)}%` }} />
                <div className="bg-amber-300" style={{ width: `${pct(s.ordered - s.received)}%` }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">Quoted <b className="text-slate-900">{inr(s.quotedValue)}</b></span>
              <span className="text-slate-500">Bought <b className="text-slate-900">{inr(s.purchaseCost)}</b></span>
              <span className="text-slate-500">Margin <b className={s.margin >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(s.margin)}</b></span>
            </div>
          </>
        )}
      </div>

      {/* Late supplier deliveries */}
      {!!board?.lateOrders.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-amber-800"><AlertTriangle className="h-4 w-4" />Waiting on supplier</div>
          <ul className="mt-1 space-y-0.5 text-amber-900">
            {board.lateOrders.map((o) => (
              <li key={o.id}>
                <Link to={`/purchases/orders/${o.id}`} className="underline">{o.poNumber}</Link>
                {o.supplierName ? ` · ${o.supplierName}` : ""} — {o.daysLate} day{o.daysLate === 1 ? "" : "s"} late
                (due {format(new Date(o.expectedDeliveryDate), "d MMM")})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quote lines with no matching product */}
      {!!board?.unlinked?.length && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-sky-900"><Link2 className="h-4 w-4" />Quote items not linked to a product ({board.unlinked.length})</div>
          <p className="text-xs text-sky-800 mt-0.5">Link each once — the same name links automatically on every future quote.</p>
          <ul className="mt-2 space-y-1.5">
            {board.unlinked.map((u, i) => (
              <li key={`${u.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5">
                <span className="min-w-0 truncate text-slate-800">{u.name} <span className="text-xs text-slate-500">· {qty(u.quantity)} {u.unit || ""}</span></span>
                <Button size="sm" variant="outline" onClick={() => openAdd(u)}>Link</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stage filter */}
      {!!board?.rows.length && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["ALL", ...STAGES.filter((x) => x.key !== "NOT_NEEDED").map((x) => x.key)] as (SupplyStage | "ALL")[]).map((k) => {
            const count = k === "ALL" ? board.rows.length : board.rows.filter((r) => r.stage === k).length;
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${filter === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600"}`}
              >
                {k === "ALL" ? "All" : stageOf(k).label} · {count}
              </button>
            );
          })}
        </div>
      )}

      {/* Items */}
      {!board?.rows.length ? (
        <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
          No products on this project yet. Products from the approved quote's materials appear here automatically,
          or use <b>Add product</b> to list what you'll buy and install.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = stageOf(r.stage);
            const unit = r.unit || "";
            const canSend = r.sentToSite < r.required && (r.received > 0 || r.inStock > 0);
            const canInstall = r.sentToSite > 0 && r.installed < r.required;
            return (
              <div key={r.requirementId} className="rounded-xl border bg-white p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-slate-900"
                    checked={!!selected[r.requirementId]}
                    onChange={(e) => setSelected((p) => ({ ...p, [r.requirementId]: e.target.checked }))}
                    aria-label={`Select ${r.productName}`}
                  />
                  {r.imageUrl
                    ? <img src={r.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border" />
                    : <div className="h-10 w-10 rounded-lg bg-slate-100 grid place-items-center"><Warehouse className="h-4 w-4 text-slate-400" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{r.productName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.label}</span>
                      {r.phaseName && <span className="text-xs text-slate-400">{r.phaseName}</span>}
                    </div>
                    {r.colors && <div className="mt-0.5 text-xs text-slate-600">Colours: {r.colors}</div>}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      <span>Need <b className="text-slate-800">{qty(r.required)} {unit}</b></span>
                      <span>In store {qty(r.inStock)}</span>
                      <span>Ordered {qty(r.ordered)}</span>
                      <span>Received {qty(r.received)}</span>
                      <span>At site {qty(r.sentToSite)}</span>
                      <span>Installed {qty(r.installed)}</span>
                      {r.supplierName && <span>Supplier {r.supplierName}</span>}
                    </div>
                    {!!r.orders.length && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.orders.map((o) => (
                          <Link
                            key={`${o.id}-${o.quantity}`}
                            to={`/purchases/orders/${o.id}`}
                            className="rounded-md border bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                          >
                            {o.poNumber} · {o.status} · {qty(o.received)}/{qty(o.quantity)}
                            {o.expectedDeliveryDate ? ` · due ${format(new Date(o.expectedDeliveryDate), "d MMM")}` : ""}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {r.stage === "TO_BUY" && (
                    <Button size="sm" variant="outline" onClick={() => openBuy([r])}><ShoppingCart className="h-3.5 w-3.5 mr-1" />Buy</Button>
                  )}
                  {canSend && (
                    <Button size="sm" variant="outline"
                      onClick={() => setAction({ row: r, kind: "send", value: String(r.required - r.sentToSite) })}>
                      <Truck className="h-3.5 w-3.5 mr-1" />Send to site
                    </Button>
                  )}
                  {canInstall && (
                    <Button size="sm" variant="outline" onClick={() => setAction({ row: r, kind: "install", value: String(r.sentToSite) })}>
                      <Wrench className="h-3.5 w-3.5 mr-1" />Mark installed
                    </Button>
                  )}
                  {r.stage === "INSTALLED" && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Installed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Buy dialog */}
      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Buy for this project</DialogTitle>
            <DialogDescription>One purchase order is created per supplier, linked to this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {pickedRows.map((r) => (
              <div key={r.requirementId} className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {r.productName}
                    {r.colors && <span className="block text-xs font-normal text-slate-500">Colours: {r.colors}</span>}
                  </span>
                  <span className="text-xs text-slate-500">need {qty(r.required)} · in store {qty(r.inStock)} · ordered {qty(r.ordered)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500">Quantity ({r.unit || "units"})
                    <BaseInput type="number" min={0} value={buyQty[r.requirementId] ?? ""}
                      onChange={(e) => setBuyQty((p) => ({ ...p, [r.requirementId]: e.target.value }))} />
                  </label>
                  <div className="text-xs text-slate-500">Supplier
                    <SearchableSelect
                      value={buySupplier[r.requirementId] || ""}
                      onChange={(v) => setBuySupplier((p) => ({ ...p, [r.requirementId]: v }))}
                      options={suppliers.map((x) => ({ value: String(x.id), label: x.name }))}
                      placeholder={r.supplierName ? `${r.supplierName} (default)` : "Pick supplier…"}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="text-xs text-slate-500">Expected delivery
              <BaseInput type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-5">
              <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={toSite} onChange={(e) => setToSite(e.target.checked)} />
              Deliver directly to customer's site
            </label>
          </div>
          {toSite && board?.siteAddress && <p className="text-xs text-slate-500">Site: {board.siteAddress}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancel</Button>
            <Button onClick={submitBuy} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create purchase order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add product dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{linking ? "Link quote item to a product" : "Add product to supply"}</DialogTitle>
            <DialogDescription>
              {linking ? <>Quote item: <b>{linking}</b>. This name will match the product automatically from now on.</> : "A product this project needs bought and installed."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <SearchableSelect
              value={newItem.productId}
              onChange={(v) => {
                const p = products.find((x) => String(x.id) === v);
                setNewItem((n) => ({ ...n, productId: v, unit: n.unit || p?.unit || "" }));
              }}
              options={products.map((p: any) => ({ value: String(p.id), label: p.name, hint: p.materialCode }))}
              placeholder="Select product…"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">Quantity
                <BaseInput type="number" min={0} value={newItem.qty} onChange={(e) => setNewItem((n) => ({ ...n, qty: e.target.value }))} />
              </label>
              <label className="text-xs text-slate-500">Unit
                <BaseInput list={UNIT_DATALIST_ID} value={newItem.unit} onChange={(e) => setNewItem((n) => ({ ...n, unit: e.target.value }))} placeholder="m, pcs…" />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={busy}>{linking ? "Link" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to site / installed dialog */}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-w-sm">
          {action && (
            <>
              <DialogHeader>
                <DialogTitle>{action.kind === "send" ? "Send to site" : "Mark installed"}</DialogTitle>
                <DialogDescription>
                  {action.row.productName} — need {qty(action.row.required)} {action.row.unit || ""},
                  {" "}at site {qty(action.row.sentToSite)}, installed {qty(action.row.installed)}.
                </DialogDescription>
              </DialogHeader>
              <label className="text-xs text-slate-500">
                {action.kind === "send" ? "Quantity leaving the store" : "Total quantity installed so far"}
                <BaseInput type="number" min={0} value={action.value} onChange={(e) => setAction({ ...action, value: e.target.value })} />
              </label>
              {action.kind === "send" && <p className="text-xs text-slate-500">Taken out of store stock and booked to this project.</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
                <Button onClick={submitAction} disabled={busy}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
