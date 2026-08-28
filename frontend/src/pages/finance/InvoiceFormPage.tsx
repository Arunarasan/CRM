import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { currency } from "./helpers";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

interface CustomerLite { id: number; name: string }
interface ProjectLite { id: number; projectName?: string }
interface Line { key: number; description: string; hsnCode: string; unit: string; quantity: number; unitPrice: number; gstRate: number }

const INVOICE_TYPES = ["QUOTATION", "ADVANCE", "PROGRESS", "FINAL", "PROFORMA"];

let keySeed = 1;
const blankLine = (): Line => ({ key: keySeed++, description: "", hsnCode: "", unit: "Nos", quantity: 1, unitPrice: 0, gstRate: 18 });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const goBack = useGoBack("/finance/invoices");

  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [invoiceType, setInvoiceType] = useState("PROGRESS");
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("0");
  const [retentionPercent, setRetentionPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers?size=500").then((r) => setCustomers(r.data?.content ?? r.data ?? [])).catch(() => toast.error("Could not load customers."));
    api.get("/projects?size=200").then((r) => setProjects(r.data?.content ?? r.data ?? [])).catch(() => {});
  }, []);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const totals = useMemo(() => {
    const subTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    let discount = discountType === "PERCENTAGE" ? subTotal * (Number(discountValue) || 0) / 100 : (Number(discountValue) || 0);
    if (discount > subTotal) discount = subTotal;
    const taxable = subTotal - discount;
    const gst = lines.reduce((s, l) => {
      const lineTotal = l.quantity * l.unitPrice;
      const share = subTotal === 0 ? 0 : lineTotal / subTotal;
      return s + taxable * share * (l.gstRate || 0) / 100;
    }, 0);
    const grand = Math.round(taxable + gst);
    const retention = grand * (Number(retentionPercent) || 0) / 100;
    return { subTotal, discount, gst, grand, retention, balanceDue: grand - retention };
  }, [lines, discountType, discountValue, retentionPercent]);

  const validItems = lines.filter((l) => l.description.trim() && l.quantity > 0);

  const save = async () => {
    if (!customerId) { toast.error("Please choose a customer."); return; }
    if (validItems.length === 0) { toast.error("Add at least one line item with a description and quantity."); return; }
    setSaving(true);
    try {
      const invoice: Record<string, unknown> = {
        customer: { id: Number(customerId) },
        project: projectId ? { id: Number(projectId) } : null,
        invoiceType, gstType, date, dueDate: dueDate || null,
        placeOfSupply: placeOfSupply || null,
        discountType, discountValue: Number(discountValue) || 0,
        retentionPercent: Number(retentionPercent) || 0,
        notes: notes || null, terms: terms || null,
      };
      const items = validItems.map((l) => ({
        description: l.description, hsnCode: l.hsnCode || null, unit: l.unit || null,
        quantity: l.quantity, unitPrice: l.unitPrice, gstRate: l.gstRate || 0,
      }));
      const created = await financeApi.createInvoice(invoice, items);
      toast.success(`${created.invoiceNumber} created as a draft.`);
      navigate(`/finance/invoices/${created.id}`);
    } catch (e) {
      toast.error(apiError(e, "Could not create the invoice."));
      setSaving(false);
    }
  };

  const customerOptions = customers.map((c) => ({ value: String(c.id), label: c.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.projectName || `Project #${p.id}` }));

  return (
    <div className="pb-24">
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Invoice</h1>
            <p className="text-sm text-muted-foreground">Create a GST invoice — it's saved as a draft you can review and issue.</p>
          </div>
        </div>

        {/* Step 1 — customer & terms */}
        <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">1 · Customer &amp; terms</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Customer" required>
              <SearchableSelect value={customerId} onChange={setCustomerId} options={customerOptions} placeholder="Search customer…" />
            </Field>
            <Field label="Project">
              <SearchableSelect value={projectId} onChange={setProjectId} options={projectOptions} placeholder="Search project…" clearLabel="— none —" />
            </Field>
            <Field label="Invoice type">
              <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
                {INVOICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            <Field label="GST type">
              <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={gstType} onChange={(e) => setGstType(e.target.value as "CGST_SGST" | "IGST")}>
                <option value="CGST_SGST">CGST + SGST (intra-state)</option>
                <option value="IGST">IGST (inter-state)</option>
              </select>
            </Field>
            <Field label="Place of supply"><Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} /></Field>
            <Field label="Retention %"><Input type="number" min={0} value={retentionPercent} onChange={(e) => setRetentionPercent(e.target.value)} /></Field>
          </div>
        </section>

        {/* Step 2 — line items */}
        <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">2 · Line items</h2>
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blankLine()])}><Plus className="w-4 h-4 mr-1" /> Add item</Button>
          </div>
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs uppercase text-slate-400 px-1">
            <div className="col-span-4">Description</div>
            <div className="col-span-2">HSN / Unit</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Rate ₹</div>
            <div className="col-span-1 text-right">GST %</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1" />
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b pb-3 last:border-0 last:pb-0">
              <div className="md:col-span-4"><Input placeholder="Item / work description" value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} /></div>
              <div className="md:col-span-2 flex gap-1">
                <Input placeholder="HSN" value={l.hsnCode} onChange={(e) => setLine(l.key, { hsnCode: e.target.value })} />
                <Input placeholder="Unit" value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} />
              </div>
              <div className="md:col-span-1"><Input type="number" min={0} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: Number(e.target.value) })} /></div>
              <div className="md:col-span-2"><Input type="number" min={0} value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: Number(e.target.value) })} /></div>
              <div className="md:col-span-1"><Input type="number" min={0} value={l.gstRate} onChange={(e) => setLine(l.key, { gstRate: Number(e.target.value) })} /></div>
              <div className="md:col-span-1 text-right text-sm font-semibold text-slate-700">{currency(l.quantity * l.unitPrice)}</div>
              <div className="md:col-span-1 text-right">
                <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)} disabled={lines.length === 1}><Trash2 className="w-4 h-4 text-slate-400" /></Button>
              </div>
            </div>
          ))}
        </section>

        {/* Step 3 — discount + totals */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount type">
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FLAT")}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FLAT">Flat ₹</option>
                </select>
              </Field>
              <Field label="Discount value"><Input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /></Field>
            </div>
            <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <Field label="Terms"><Input value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
          </div>
          <div className="bg-white border rounded-2xl shadow-sm p-5 space-y-2 text-sm">
            <Row label="Subtotal" value={currency(totals.subTotal)} />
            <Row label="Discount" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />
            <Row label="GST" value={currency(totals.gst)} />
            <div className="flex justify-between border-t pt-2 mt-1 text-base"><span className="font-bold text-slate-800">Grand Total</span><span className="font-black text-slate-900">{currency(totals.grand)}</span></div>
            {totals.retention > 0 && (
              <>
                <Row label="Retention held" value={`− ${currency(totals.retention)}`} valueClass="text-amber-700" />
                <Row label="Balance due now" value={currency(totals.balanceDue)} />
              </>
            )}
            <p className="text-xs text-slate-400 pt-1">Final figures are recomputed and locked on save.</p>
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
            <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Create Invoice"}</Button>
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
