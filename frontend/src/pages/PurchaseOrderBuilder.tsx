import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { purchaseApi } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type { Supplier, BuyNowRow } from "@/types/purchase";
import type { Product, Warehouse } from "@/types/inventory";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import ProductSearchSelect from "@/pages/inventory/components/ProductSearchSelect";
import { ArrowLeft, Plus, Trash2, Save, PackageSearch, UserPlus, ChevronDown, AlertTriangle, PackagePlus } from "lucide-react";
import { UnitOptions } from "@/components/UnitOptions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProjectLite { id: number; projectName?: string }
/** `text` = what is typed in the material search before a material is picked. */
interface Line { key: number; product: Product | null; quantity: number; unitPrice: number; text: string }

const currency = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let keySeed = 1;
const blankLine = (): Line => ({ key: keySeed++, product: null, quantity: 1, unitPrice: 0, text: "" });
const lineAmount = (l: Line) => (l.quantity || 0) * (l.unitPrice || 0);
/** A line the user started (typed a name or a rate) but that has no material picked — it would be dropped. */
const isUnlinked = (l: Line) => !l.product && (l.text.trim() !== "" || (l.unitPrice || 0) > 0);

export default function PurchaseOrderBuilder() {
  const navigate = useNavigate();
  const goBack = useGoBack("/purchases/orders");
  // ?projectId=<id> — opened from a project's Purchase Orders tab: prefill it and return there on save.
  const [params] = useSearchParams();
  const fromProject = params.get("projectId") || "";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [projectId, setProjectId] = useState(fromProject);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  // One order can ship to several places (site, godown, transport office) — one per shipment.
  const [deliveryAddresses, setDeliveryAddresses] = useState<string[]>([""]);
  const [taxPercent, setTaxPercent] = useState("18");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [transportationCost, setTransportationCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  // "Add as new material" from a line's search: which line, and the typed name.
  const [newMaterial, setNewMaterial] = useState<{ lineKey: number; name: string } | null>(null);
  // Inline errors show after the first Create attempt.
  const [tried, setTried] = useState(false);

  const [lowStock, setLowStock] = useState<BuyNowRow[]>([]);
  const [showLowStock, setShowLowStock] = useState(true);

  useEffect(() => {
    purchaseApi.getSuppliers().then(setSuppliers).catch(() => toast.error("Could not load suppliers."));
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
    api.get("/projects?size=200").then((r) => setProjects(r.data?.content ?? r.data ?? [])).catch(() => {});
    purchaseApi.getPurchaseOverview().then((o) => setLowStock(o.buyNow || [])).catch(() => {});
  }, []);

  // Pull a low-stock material into the order. Prefills the supplier if none chosen yet.
  const addFromLowStock = (row: BuyNowRow) => {
    if (lines.some((l) => l.product?.id === row.productId)) { toast.info(`${row.productName} is already on the order.`); return; }
    const product = { id: row.productId, name: row.productName, unit: row.unit } as Product;
    const need = Math.max((row.reorderLevel || 0) - (row.currentStock || 0), 1);
    setLines((ls) => {
      const withoutBlank = ls.filter((l) => l.product);
      return [...withoutBlank, { key: keySeed++, product, quantity: need, unitPrice: 0, text: "" }];
    });
    if (!supplierId && row.suggestedSupplierId) setSupplierId(String(row.suggestedSupplierId));
  };

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.product ? lineAmount(l) : 0), 0);
    const tax = subtotal * (Number(taxPercent) || 0) / 100;
    const discount = Number(discountAmount) || 0;
    const transport = Number(transportationCost) || 0;
    const grand = subtotal + tax - discount + transport;
    return { subtotal, tax, discount, transport, grand };
  }, [lines, taxPercent, discountAmount, transportationCost]);

  const validItems = lines.filter((l) => l.product && l.quantity > 0);
  const unlinked = lines.filter(isUnlinked);
  const zeroQty = lines.filter((l) => l.product && !(l.quantity > 0));

  const save = async () => {
    setTried(true);
    if (!supplierId) { toast.error("Please choose a supplier."); return; }
    if (unlinked.length > 0) {
      toast.error(`${unlinked.length} material line${unlinked.length === 1 ? " isn't" : "s aren't"} picked yet — choose from the list or add it as a new material.`);
      return;
    }
    if (zeroQty.length > 0) { toast.error("Enter a quantity for every material."); return; }
    if (validItems.length === 0) { toast.error("Add at least one material with a quantity."); return; }
    setSaving(true);
    try {
      const po: Record<string, unknown> = {
        supplier: { id: Number(supplierId) },
        warehouse: warehouseId ? { id: Number(warehouseId) } : null,
        project: projectId ? { id: Number(projectId) } : null,
        expectedDeliveryDate: expectedDeliveryDate || null,
        deliveryAddresses: deliveryAddresses.map((a) => a.trim()).filter(Boolean),
        paymentTerms: paymentTerms || null,
        taxPercent: Number(taxPercent) || 0,
        discountAmount: Number(discountAmount) || 0,
        transportationCost: Number(transportationCost) || 0,
        notes: notes || null,
      };
      const items = validItems.map((l) => ({ product: { id: l.product!.id }, quantity: l.quantity, unitPrice: l.unitPrice }));
      const created = await purchaseApi.createPurchaseOrder(po, items);
      toast.success(`${created.poNumber} created as a draft.`);
      navigate(fromProject ? `/projects/${fromProject}?tab=purchaseOrders` : `/purchases/orders/${created.id}`);
    } catch (e) {
      toast.error(apiError(e, "Could not create the purchase order."));
      setSaving(false);
    }
  };

  const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: String(w.id), label: w.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.projectName || `Project #${p.id}` }));

  return (
    <div>
      <div className="p-4 md:p-8 pb-28 md:pb-28 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Purchase Order</h1>
            <p className="text-sm text-muted-foreground">Raise a PO to a supplier — it's saved as a draft you can review and send.</p>
          </div>
        </div>

        {/* Step 1 — supplier & delivery */}
        <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">1 · Supplier &amp; delivery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">Supplier<span className="text-red-500"> *</span></span>
                <button type="button" onClick={() => setNewSupplierOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                  <UserPlus className="h-3.5 w-3.5" /> New supplier
                </button>
              </div>
              <div className={`mt-1 ${tried && !supplierId ? "rounded-md ring-2 ring-red-300" : ""}`}>
                <SearchableSelect value={supplierId} onChange={setSupplierId} options={supplierOptions} placeholder="Search supplier…" />
              </div>
              {tried && !supplierId && <p className="mt-1 text-xs text-red-600">Choose who you're buying from.</p>}
            </div>
            <Field label="Deliver to warehouse">
              <SearchableSelect value={warehouseId} onChange={setWarehouseId} options={warehouseOptions} placeholder="Search warehouse…" clearLabel="— none —" />
            </Field>
            <Field label="Project">
              <SearchableSelect value={projectId} onChange={setProjectId} options={projectOptions} placeholder="Search project…" clearLabel="— none —" />
            </Field>
            <Field label="Expected delivery">
              <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
            </Field>
            <Field label="Payment terms">
              <Input placeholder="e.g. 30 days credit" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </Field>
            <div className="text-sm md:col-span-2">
              <span className="font-semibold text-slate-700">Delivery addresses</span>
              <span className="ml-1.5 text-xs text-slate-400">— add one per place the shipments will go</span>
              <div className="mt-1 space-y-2">
                {deliveryAddresses.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={a} placeholder={i === 0 ? "e.g. customer site address" : "e.g. our godown / transport office"}
                      onChange={(e) => setDeliveryAddresses((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
                    {deliveryAddresses.length > 1 && (
                      <Button type="button" variant="outline" size="icon" aria-label="Remove address"
                        onClick={() => setDeliveryAddresses((list) => list.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setDeliveryAddresses((list) => [...list, ""])}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Add another address
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 — items */}
        <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">2 · Materials</h2>
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
              <Plus className="w-4 h-4 mr-1" /> Add item
            </Button>
          </div>

          {/* Low-stock reference — tap to add materials that need reordering */}
          {lowStock.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
              <button type="button" onClick={() => setShowLowStock((v) => !v)}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-600">
                <PackageSearch className="w-4 h-4" /> Low stock — tap to add ({lowStock.length})
                <ChevronDown className={`w-4 h-4 transition-transform ${showLowStock ? "" : "-rotate-90"}`} />
              </button>
              {showLowStock && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {lowStock.map((r) => {
                    const added = lines.some((l) => l.product?.id === r.productId);
                    return (
                      <button type="button" key={r.productId} onClick={() => addFromLowStock(r)} disabled={added}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs text-left transition-colors ${
                          added ? "border-slate-200 bg-slate-100 text-slate-400" : "border-red-200 bg-white hover:border-red-400"}`}>
                        <div className="font-semibold text-slate-800">{r.productName}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.currentStock} {r.unit} left · reorder {r.reorderLevel}
                          {r.suggestedSupplierName ? ` · ${r.suggestedSupplierName}` : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Column headings (desktop) */}
          <div className="hidden md:grid md:grid-cols-12 gap-2 border-b pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <div className="md:col-span-5">Material</div>
            <div className="md:col-span-2">Qty</div>
            <div className="md:col-span-2">Rate ₹</div>
            <div className="md:col-span-2 text-right">Amount</div>
            <div className="md:col-span-1" />
          </div>

          {lines.map((l) => {
            const pending = isUnlinked(l);
            const showPending = pending && (tried || l.text.trim() !== "");
            return (
              <div key={l.key} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="grid grid-cols-2 md:grid-cols-12 gap-2 items-start">
                  <div className="col-span-2 md:col-span-5">
                    <ProductSearchSelect value={l.product} invalid={showPending}
                      onTextChange={(text) => setLine(l.key, { text })}
                      onCreateNew={(name) => setNewMaterial({ lineKey: l.key, name })}
                      onChange={(p) => setLine(l.key, {
                        product: p, text: "", unitPrice: l.unitPrice || p?.purchasePrice || p?.costPrice || 0,
                      })} />
                  </div>
                  <label className="md:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Qty</span>
                    <div className="relative">
                      <Input type="number" min={0} step="any" inputMode="decimal" placeholder="Qty"
                        value={l.quantity || ""} className={l.product?.unit ? "pr-12" : undefined}
                        onChange={(e) => setLine(l.key, { quantity: Math.max(0, Number(e.target.value)) })} />
                      {l.product?.unit && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{l.product.unit}</span>
                      )}
                    </div>
                    {tried && l.product && !(l.quantity > 0) && <span className="mt-1 block text-xs text-red-600">Enter a quantity</span>}
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:hidden">Rate ₹</span>
                    <Input type="number" min={0} step="any" inputMode="decimal" placeholder="0"
                      value={l.unitPrice || ""} onChange={(e) => setLine(l.key, { unitPrice: Math.max(0, Number(e.target.value)) })} />
                  </label>
                  <div className="col-span-1 md:col-span-2 self-center text-left md:text-right">
                    <span className="md:hidden text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount </span>
                    <span className={`text-sm font-semibold tabular-nums ${l.product ? "text-slate-800" : "text-slate-400 line-through decoration-slate-300"}`}>
                      {currency(lineAmount(l))}
                    </span>
                  </div>
                  <div className="col-span-1 md:col-span-1 self-center text-right">
                    <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => removeLine(l.key)} disabled={lines.length === 1}>
                      <Trash2 className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
                {showPending && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {l.text.trim() ? <>“{l.text.trim()}” isn't picked yet — </> : <>No material picked — </>}
                      choose it from the list, or add it as a new material. It isn't counted until then.
                    </span>
                    {l.text.trim() && (
                      <button type="button" onClick={() => setNewMaterial({ lineKey: l.key, name: l.text.trim() })}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-100">
                        <PackagePlus className="h-3.5 w-3.5" /> Add as new material
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {validItems.length === 0 && unlinked.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400 pt-1">
              <PackageSearch className="w-4 h-4" /> Search a material above and pick it from the list to start the order.
            </div>
          )}
        </section>

        {/* Step 3 — charges + totals */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl shadow-sm p-5 grid grid-cols-3 gap-3">
            <Field label="Tax %"><Input type="number" min={0} value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /></Field>
            <Field label="Discount ₹"><Input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} /></Field>
            <Field label="Transport ₹"><Input type="number" min={0} value={transportationCost} onChange={(e) => setTransportationCost(e.target.value)} /></Field>
            <div className="col-span-3"><Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-2 text-sm">
            <Row label="Subtotal" value={currency(totals.subtotal)} />
            <Row label={`Tax (${Number(taxPercent) || 0}%)`} value={currency(totals.tax)} />
            <Row label="Discount" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />
            <Row label="Transport" value={currency(totals.transport)} />
            <div className="flex justify-between border-t pt-2 mt-2 text-base"><span className="font-bold text-slate-800">Grand Total</span><span className="font-black text-slate-900">{currency(totals.grand)}</span></div>
          </div>
        </section>

        {/* Action bar — sticks to the bottom of the content column (not over the sidebar or the items) */}
        <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-white/95 px-4 py-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
          <span className="text-sm text-muted-foreground hidden sm:flex items-center gap-2">
            <span>
              {validItems.length} item{validItems.length === 1 ? "" : "s"} · <span className="font-semibold text-slate-800 tabular-nums">{currency(totals.grand)}</span>
            </span>
            {unlinked.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                <AlertTriangle className="h-3 w-3" /> {unlinked.length} line{unlinked.length === 1 ? "" : "s"} not picked
              </span>
            )}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={goBack}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="active:scale-[0.98]"><Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Create Purchase Order"}</Button>
          </div>
        </div>
      </div>

      <QuickMaterialDialog draft={newMaterial} rate={lines.find((l) => l.key === newMaterial?.lineKey)?.unitPrice || 0}
        onClose={() => setNewMaterial(null)}
        onCreated={(p) => { if (newMaterial) setLine(newMaterial.lineKey, { product: p, text: "", unitPrice: (lines.find((l) => l.key === newMaterial.lineKey)?.unitPrice || p.purchasePrice || 0) }); }} />

      <QuickSupplierDialog open={newSupplierOpen} onClose={() => setNewSupplierOpen(false)}
        onCreated={(sup) => { setSuppliers((list) => [...list, sup]); setSupplierId(String(sup.id)); }} />

    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="text-sm block">
      <span className="font-semibold text-slate-700">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className={`font-semibold ${valueClass ?? ""}`}>{value}</span></div>;
}

/** Add a supplier on the spot with just the basics; GST, bank and other details can be filled in later. */
function QuickSupplierDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (s: Supplier) => void }) {
  const blank = { name: "", phone: "", contactPerson: "", city: "", gstin: "" };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Enter the supplier's name."); return; }
    setSaving(true);
    try {
      const created = await purchaseApi.createSupplier({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        city: form.city.trim() || undefined,
        gstin: form.gstin.trim() || undefined,
      });
      toast.success(`${created.name} added — fill in the rest later from Suppliers.`);
      onCreated(created);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Could not add the supplier."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-emerald-600" /> New supplier</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Field label="Name" required><Input autoFocus value={form.name} onChange={set("name")} placeholder="Business name" /></Field></div>
          <Field label="Phone"><Input type="tel" value={form.phone} onChange={set("phone")} placeholder="Mobile number" /></Field>
          <Field label="Contact person"><Input value={form.contactPerson} onChange={set("contactPerson")} /></Field>
          <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={set("gstin")} placeholder="Optional" /></Field>
        </div>
        <p className="text-xs text-slate-400">Only the name is needed now — add address, bank and other details later from Purchasing › Suppliers.</p>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}><Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Add supplier"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Add a material to the catalogue from the order line — just a name, unit and buying rate; the rest later. */
function QuickMaterialDialog({ draft, rate, onClose, onCreated }: {
  draft: { lineKey: number; name: string } | null; rate: number; onClose: () => void; onCreated: (p: Product) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Nos");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (draft) { setName(draft.name); setUnit("Nos"); setPrice(rate ? String(rate) : ""); }
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!name.trim()) { toast.error("Enter the material name."); return; }
    setSaving(true);
    try {
      const created = await inventoryApi.createProduct({
        name: name.trim(), unit, purchasePrice: Number(price) || undefined,
      } as Partial<Product>);
      toast.success(`${created.name} added to materials.`);
      onCreated(created);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Could not add the material."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!draft} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-emerald-600" /> New material</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Name" required><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
          <Field label="Unit">
            <select value={unit} onChange={(e) => setUnit(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <UnitOptions value={unit} />
            </select>
          </Field>
          <Field label="Buying rate ₹"><Input type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Optional" /></Field>
        </div>
        <p className="text-xs text-slate-400">Saved to Inventory › Materials. Add category, code and stock levels there later.</p>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={save}><Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Add material"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
