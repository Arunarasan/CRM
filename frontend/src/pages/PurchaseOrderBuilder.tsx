import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { purchaseApi } from "@/api/purchaseApi";
import { inventoryApi } from "@/api/inventoryApi";
import type { Supplier } from "@/types/purchase";
import type { Product, Warehouse } from "@/types/inventory";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import ProductSearchSelect from "@/pages/inventory/components/ProductSearchSelect";
import { ArrowLeft, Plus, Trash2, Save, PackageSearch } from "lucide-react";

interface ProjectLite { id: number; projectName?: string }
interface Line { key: number; product: Product | null; quantity: number; unitPrice: number }

const currency = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let keySeed = 1;
const blankLine = (): Line => ({ key: keySeed++, product: null, quantity: 1, unitPrice: 0 });

export default function PurchaseOrderBuilder() {
  const navigate = useNavigate();
  const goBack = useGoBack("/purchases/orders");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [transportationCost, setTransportationCost] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    purchaseApi.getSuppliers().then(setSuppliers).catch(() => toast.error("Could not load suppliers."));
    inventoryApi.getWarehouses().then(setWarehouses).catch(() => {});
    api.get("/projects?size=200").then((r) => setProjects(r.data?.content ?? r.data ?? [])).catch(() => {});
  }, []);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (l.product ? l.quantity * l.unitPrice : 0), 0);
    const tax = subtotal * (Number(taxPercent) || 0) / 100;
    const discount = Number(discountAmount) || 0;
    const transport = Number(transportationCost) || 0;
    const grand = subtotal + tax - discount + transport;
    return { subtotal, tax, discount, transport, grand };
  }, [lines, taxPercent, discountAmount, transportationCost]);

  const validItems = lines.filter((l) => l.product && l.quantity > 0);

  const save = async () => {
    if (!supplierId) { toast.error("Please choose a supplier."); return; }
    if (validItems.length === 0) { toast.error("Add at least one material with a quantity."); return; }
    setSaving(true);
    try {
      const po: Record<string, unknown> = {
        supplier: { id: Number(supplierId) },
        warehouse: warehouseId ? { id: Number(warehouseId) } : null,
        project: projectId ? { id: Number(projectId) } : null,
        expectedDeliveryDate: expectedDeliveryDate || null,
        deliveryAddress: deliveryAddress || null,
        paymentTerms: paymentTerms || null,
        taxPercent: Number(taxPercent) || 0,
        discountAmount: Number(discountAmount) || 0,
        transportationCost: Number(transportationCost) || 0,
        notes: notes || null,
      };
      const items = validItems.map((l) => ({ product: { id: l.product!.id }, quantity: l.quantity, unitPrice: l.unitPrice }));
      const created = await purchaseApi.createPurchaseOrder(po, items);
      toast.success(`${created.poNumber} created as a draft.`);
      navigate(`/purchases/orders/${created.id}`);
    } catch (e) {
      toast.error(apiError(e, "Could not create the purchase order."));
      setSaving(false);
    }
  };

  const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
  const warehouseOptions = warehouses.map((w) => ({ value: String(w.id), label: w.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.projectName || `Project #${p.id}` }));

  return (
    <div className="pb-24">
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
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
            <Field label="Supplier" required>
              <SearchableSelect value={supplierId} onChange={setSupplierId} options={supplierOptions} placeholder="Search supplier…" />
            </Field>
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
            <Field label="Delivery address">
              <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </Field>
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
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b pb-3 last:border-0 last:pb-0">
              <div className="md:col-span-6">
                <ProductSearchSelect value={l.product} onChange={(p) => setLine(l.key, {
                  product: p, unitPrice: l.unitPrice || p?.purchasePrice || p?.costPrice || 0,
                })} />
              </div>
              <div className="md:col-span-2">
                <Input type="number" min={0} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Input type="number" min={0} placeholder="Unit ₹" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-1 text-right text-sm font-semibold text-slate-700">{currency(l.product ? l.quantity * l.unitPrice : 0)}</div>
              <div className="md:col-span-1 text-right">
                <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)} disabled={lines.length === 1}>
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </Button>
              </div>
            </div>
          ))}
          {validItems.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-400 pt-1">
              <PackageSearch className="w-4 h-4" /> Search a material above to start the order.
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
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-white/95 backdrop-blur px-4 md:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {validItems.length} item{validItems.length === 1 ? "" : "s"} · <span className="font-semibold text-slate-800">{currency(totals.grand)}</span>
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={goBack}>Cancel</Button>
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Create Purchase Order"}</Button>
          </div>
        </div>
      </div>
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
