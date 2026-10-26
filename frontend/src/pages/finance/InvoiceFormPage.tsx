import { useEffect, useMemo, useState } from "react";
import GstModeToggle from "@/components/ui/gst-mode-toggle";
import { useNavigate, useSearchParams } from "react-router-dom";
import { quotationApi } from "@/api/quotationApi";
import { buildQuoteLines } from "./quoteBilling";
import type { CustomerPayment } from "@/types/finance";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { currency } from "./helpers";
import BillToPanel from "@/components/BillToPanel";
import { gstinError, resolveBillTo, saveBillToToCustomer, type BillTo } from "@/lib/billTo";
import { fetchCompanyProfile, type CompanyProfile } from "@/lib/companyProfile";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { UNIT_DATALIST_ID } from "@/components/UnitOptions";

interface CustomerLite { id: number; name: string; [k: string]: any }
interface ProjectLite { id: number; projectName?: string }
interface Line { key: number; description: string; hsnCode: string; unit: string; quantity: number; unitPrice: number; gstRate: number }

const METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE", "NEFT", "OTHER"];
const INVOICE_TYPES = ["QUOTATION", "ADVANCE", "PROGRESS", "FINAL", "PROFORMA"];

let keySeed = 1;
const blankLine = (): Line => ({ key: keySeed++, description: "", hsnCode: "", unit: "Nos", quantity: 1, unitPrice: 0, gstRate: 18 });

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const goBack = useGoBack("/billing/invoices");

  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  const [customerId, setCustomerId] = useState(sp.get("customerId") || "");
  // Customer's company details printed on the invoice — prefilled from the customer, editable here.
  const [billTo, setBillTo] = useState<BillTo>({});
  const [billToEdited, setBillToEdited] = useState(false);
  const [saveToCustomer, setSaveToCustomer] = useState(false);
  const [company, setCompany] = useState<CompanyProfile>({ name: "JB Decor" });
  useEffect(() => { fetchCompanyProfile().then(setCompany); }, []);
  const [projectId, setProjectId] = useState(sp.get("projectId") || "");
  const [invoiceType, setInvoiceType] = useState("PROGRESS");
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  // Rates typed with GST already in them (GST is worked out, not added).
  const [taxInclusive, setTaxInclusive] = useState(false);
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

  // Bill from the project's quotation: an advance % of everything, or only the items you tick.
  const [quote, setQuote] = useState<{ id: number; number: string } | null>(null);
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const [billPct, setBillPct] = useState(100);
  const [advanceAmt, setAdvanceAmt] = useState<number | "">("");
  const [pick, setPick] = useState<{ q: any; lines: { description: string; quantity: number; unitPrice: number }[]; picked: Set<number> } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setQuote(null); setQuoteId(null); setPick(null);
    if (!projectId) return;
    api.get(`/projects/${projectId}`).then((r) => {
      const pr = r.data;
      if (pr?.quotation?.id) setQuote({ id: pr.quotation.id, number: pr.quotation.quotationNumber });
      if (pr?.customer?.id) setCustomerId((c) => c || String(pr.customer.id));
    }).catch(() => {});
  }, [projectId]);

  const applyLines = (q: any, chosen: { description: string; quantity: number; unitPrice: number }[], k: number, pricing: any, append: boolean) => {
    const mapped = chosen.map((c) => ({ ...blankLine(), description: c.description, quantity: c.quantity, unitPrice: c.unitPrice, gstRate: pricing.gst }));
    setLines((ls) => {
      const blank = ls.length === 1 && !ls[0].description.trim() && !ls[0].unitPrice;
      return append && !blank ? [...ls, ...mapped] : mapped;
    });
    setTaxInclusive(!!pricing.inclusive);
    setQuoteId(q.id);
    if (k < 1) setInvoiceType("ADVANCE");
  };
  const fillAll = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const q = await quotationApi.get(quote.id);
      const { built, pricing, k } = buildQuoteLines(q, billPct);
      if (!built.length) { toast.error("The quotation has no priced items to bill."); return; }
      applyLines(q, built, k, pricing, false);
      setPick(null);
    } catch (e) { toast.error(apiError(e, "Could not read the quotation.")); } finally { setBusy(false); }
  };
  const openPick = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const q = await quotationApi.get(quote.id);
      const { built } = buildQuoteLines(q, billPct);
      if (!built.length) { toast.error("The quotation has no priced items to bill."); return; }
      setPick({ q, lines: built, picked: new Set() });
    } catch (e) { toast.error(apiError(e, "Could not read the quotation.")); } finally { setBusy(false); }
  };
  const addPicked = () => {
    if (!pick || pick.picked.size === 0) return;
    const { pricing, k } = buildQuoteLines(pick.q, billPct);
    applyLines(pick.q, pick.lines.filter((_, i) => pick.picked.has(i)), k, pricing, true);
    setPick(null);
  };
  const addAdvance = () => {
    const a = Number(advanceAmt) || 0;
    if (a <= 0) return;
    setLines([{ ...blankLine(), description: "Advance payment", unitPrice: a }]);
    setInvoiceType("ADVANCE");
    setAdvanceAmt("");
  };

  // Has the customer already paid this? NONE = unpaid; RECORDED = link payments already in the project; NEW = record now.
  const [payMode, setPayMode] = useState<"NONE" | "RECORDED" | "NEW">("NONE");
  const [unlinked, setUnlinked] = useState<CustomerPayment[] | null>(null);
  const [linkIds, setLinkIds] = useState<Set<number>>(new Set());
  const [newMethod, setNewMethod] = useState("UPI");
  const [newRef, setNewRef] = useState("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  useEffect(() => { setUnlinked(null); setLinkIds(new Set()); }, [customerId, projectId]);
  useEffect(() => {
    if (payMode !== "RECORDED" || unlinked || !customerId) return;
    financeApi.getPayments({ ...(projectId ? { projectId: Number(projectId) } : { customerId: Number(customerId) }), size: 100 } as any)
      .then((r) => setUnlinked((r.content || []).filter((p) => p.status === "CONFIRMED" && !p.invoice)))
      .catch(() => setUnlinked([]));
  }, [payMode, unlinked, customerId, projectId]);
  const linkedTotal = (unlinked || []).filter((p) => linkIds.has(p.id)).reduce((a, p) => a + Number(p.amount || 0), 0);

  useEffect(() => {
    api.get("/customers?size=500").then((r) => setCustomers(r.data?.content ?? r.data ?? [])).catch(() => toast.error("Could not load customers."));
    api.get("/projects?size=200").then((r) => setProjects(r.data?.content ?? r.data ?? [])).catch(() => {});
  }, []);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  // Same maths as the server (FinanceService.computeTotals).
  const totals = useMemo(() => {
    const exRate = (l: Line) => (taxInclusive ? l.unitPrice / (1 + (l.gstRate || 0) / 100) : l.unitPrice);
    const gross = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0); // as typed
    const subTotal = lines.reduce((s, l) => s + l.quantity * exRate(l), 0); // before GST
    const flat = Number(discountValue) || 0;
    let discount = discountType === "PERCENTAGE" ? subTotal * flat / 100
      : taxInclusive && gross > 0 ? flat * subTotal / gross : flat;
    if (discount > subTotal) discount = subTotal;
    const taxable = subTotal - discount;
    const gst = lines.reduce((s, l) => {
      const lineTotal = l.quantity * exRate(l);
      const share = subTotal === 0 ? 0 : lineTotal / subTotal;
      return s + taxable * share * (l.gstRate || 0) / 100;
    }, 0);
    const grand = Math.round(taxable + gst);
    const retention = grand * (Number(retentionPercent) || 0) / 100;
    const discountShown = taxInclusive ? Math.max(0, gross - (taxable + gst)) : discount;
    const pre = lines.reduce((s, l) => s + l.quantity * l.unitPrice * (taxInclusive ? 1 : 1 + (l.gstRate || 0) / 100), 0);
    return { gross, subTotal, discount: discountShown, taxable, gst, grand, retention, balanceDue: grand - retention, pre };
  }, [lines, discountType, discountValue, retentionPercent, taxInclusive]);

  const validItems = lines.filter((l) => l.description.trim() && l.quantity > 0);

  useEffect(() => {
    if (billToEdited) return;
    setBillTo(resolveBillTo(customers.find((c) => String(c.id) === customerId)));
  }, [customerId, customers, billToEdited]);
  const save = async () => {
    if (!customerId) { toast.error("Please choose a customer."); return; }
    const gErr = gstinError(billTo.gstin);
    if (gErr) { toast.error(gErr); return; }
    if (validItems.length === 0) { toast.error("Add at least one line item with a description and quantity."); return; }
    const settling = payMode !== "NONE";
    if (payMode === "RECORDED" && linkIds.size === 0) { toast.error("Tick the recorded payment(s) this invoice was paid with, or choose another option."); return; }
    if (payMode === "NEW" && !(Number(newAmount || totals.grand) > 0)) { toast.error("Enter the amount that was paid."); return; }
    setSaving(true);
    try {
      const invoice: Record<string, unknown> = {
        ...(quoteId ? { quotation: { id: quoteId } } : {}),
        customer: { id: Number(customerId) },
        project: projectId ? { id: Number(projectId) } : null,
        invoiceType, gstType, taxInclusive, date, dueDate: dueDate || null,
        placeOfSupply: placeOfSupply || null,
        discountType, discountValue: Number(discountValue) || 0,
        retentionPercent: Number(retentionPercent) || 0,
        notes: notes || null, terms: terms || null,
        billTo,
      };
      const items = validItems.map((l) => ({
        description: l.description, hsnCode: l.hsnCode || null, unit: l.unit || null,
        quantity: l.quantity, unitPrice: l.unitPrice, gstRate: l.gstRate || 0,
        unitPriceIncl: taxInclusive ? l.unitPrice : null,
      }));
      const created = await financeApi.createInvoice(invoice, items);
      if (saveToCustomer) {
        try { await saveBillToToCustomer(Number(customerId), billTo); }
        catch { toast.error("Invoice created, but the customer profile could not be updated."); }
      }
      if (settling) {
        await financeApi.issueInvoice(created.id);
        if (payMode === "RECORDED") {
          for (const p of (unlinked || []).filter((x) => linkIds.has(x.id))) {
            await financeApi.updatePayment(p.id, { amount: p.amount, invoice: { id: created.id } });
          }
        } else {
          await financeApi.markInvoicePaid(created.id, [{ method: newMethod, amount: Number(newAmount || totals.grand), referenceNumber: newRef || undefined }]);
        }
      }
      toast.success(settling ? `${created.invoiceNumber} issued & payment settled.` : `${created.invoiceNumber} created as a draft.`);
      navigate(`/billing/invoices/${created.id}`);
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
            <Field label="Prices">
              <GstModeToggle inclusive={taxInclusive} onChange={setTaxInclusive} />
            </Field>
            <Field label="Place of supply"><Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} /></Field>
            <Field label="Retention %"><Input type="number" min={0} value={retentionPercent} onChange={(e) => setRetentionPercent(e.target.value)} /></Field>
          </div>
        </section>

        {customerId && (
          <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Company details on the invoice</h2>
            <BillToPanel company={company} value={billTo} editing label="Bill To"
              onChange={(b) => { setBillTo(b); setBillToEdited(true); }}
              canSaveToCustomer saveToCustomer={saveToCustomer} onSaveToCustomerChange={setSaveToCustomer} />
          </section>
        )}

        {/* Bill from the project's quotation: advance % / chosen items / a plain advance amount */}
        {projectId && (
          <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Quick fill</h2>
            <div className="flex flex-wrap items-center gap-2">
              {quote && (
                <>
                  <span className="text-sm font-medium text-emerald-900">From quotation {quote.number}</span>
                  <span className="text-xs text-slate-500">Bill</span>
                  <Input type="number" min={1} max={100} value={billPct} onChange={(e) => setBillPct(Number(e.target.value))} className="h-9 w-20 text-right" />
                  <span className="text-xs text-slate-500">%</span>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={fillAll}>Fill all</Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={openPick}>Pick items</Button>
                  <span className="mx-2 hidden h-5 w-px bg-slate-200 sm:block" />
                </>
              )}
              <span className="text-xs text-slate-500">Advance ₹</span>
              <Input type="number" min={0} value={advanceAmt} onChange={(e) => setAdvanceAmt(e.target.value === "" ? "" : Number(e.target.value))} className="h-9 w-32 text-right" placeholder="Amount" />
              <Button type="button" size="sm" variant="outline" onClick={addAdvance} disabled={!(Number(advanceAmt) > 0)}>Use as advance</Button>
            </div>
            {pick && (
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Select items to bill</span>
                  <button type="button" className="font-medium normal-case text-emerald-600 hover:underline"
                    onClick={() => setPick((pl) => pl && ({ ...pl, picked: pl.picked.size === pl.lines.length ? new Set() : new Set(pl.lines.map((_, i) => i)) }))}>
                    {pick.picked.size === pick.lines.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <div className="max-h-56 divide-y overflow-y-auto">
                  {pick.lines.map((l, i) => (
                    <label key={i} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={pick.picked.has(i)} className="h-4 w-4 accent-emerald-600"
                        onChange={() => setPick((pl) => { if (!pl) return pl; const n = new Set(pl.picked); if (n.has(i)) n.delete(i); else n.add(i); return { ...pl, picked: n }; })} />
                      <span className="min-w-0 flex-1 truncate">{l.description}</span>
                      <span className="shrink-0 font-medium tabular-nums">{currency(l.unitPrice)}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2 border-t px-3 py-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setPick(null)}>Cancel</Button>
                  <Button type="button" size="sm" disabled={pick.picked.size === 0} onClick={addPicked}>Add {pick.picked.size || ""} selected</Button>
                </div>
              </div>
            )}
          </section>
        )}

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
            <div className="col-span-2 text-right">Rate ₹{taxInclusive ? " (incl. GST)" : ""}</div>
            <div className="col-span-1 text-right">GST %</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1" />
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border-b pb-3 last:border-0 last:pb-0">
              <div className="md:col-span-4"><Input placeholder="Item / work description" value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} /></div>
              <div className="md:col-span-2 flex gap-1">
                <Input placeholder="HSN" value={l.hsnCode} onChange={(e) => setLine(l.key, { hsnCode: e.target.value })} />
                <Input placeholder="Unit" list={UNIT_DATALIST_ID} value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} />
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
            {taxInclusive ? (
              <>
                <Row label="Total (incl. GST)" value={currency(totals.gross)} />
                <Row label="Discount" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />
                <Row label="Taxable value" value={currency(totals.taxable)} />
                <Row label="GST (included)" value={currency(totals.gst)} />
              </>
            ) : (
              <>
                <Row label="Subtotal" value={currency(totals.subTotal)} />
                <Row label="Discount" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />
                <Row label="GST" value={currency(totals.gst)} />
              </>
            )}
            <div className="flex justify-between border-t pt-2 mt-1 text-base"><span className="font-bold text-slate-800">Grand Total</span><span className="font-black text-slate-900">{currency(totals.grand)}</span></div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-slate-500">Set final total ₹</span>
              <Input type="number" min={0} className="h-8 w-32 text-right" placeholder={String(totals.grand)}
                onChange={(e) => {
                  if (e.target.value === "") { setDiscountValue("0"); return; }
                  const off = Math.max(0, totals.pre - Number(e.target.value));
                  setDiscountType("FLAT");
                  setDiscountValue(String(Math.round(off * 100) / 100));
                }} />
            </div>
            {totals.retention > 0 && (
              <>
                <Row label="Retention held" value={`− ${currency(totals.retention)}`} valueClass="text-amber-700" />
                <Row label="Balance due now" value={currency(totals.balanceDue)} />
              </>
            )}
            <p className="text-xs text-slate-400 pt-1">Final figures are recomputed and locked on save.</p>
          </div>
        </section>

        {/* Has the customer already paid? */}
        <section className="bg-white border rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Payment</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([["NONE", "Not paid yet"], ["RECORDED", "Paid · already recorded"], ["NEW", "Paid · not recorded"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPayMode(k)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${payMode === k ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          {payMode === "RECORDED" && (
            !customerId ? <p className="text-xs text-amber-700">Choose a customer first.</p>
            : unlinked === null ? <p className="text-xs text-slate-500">Loading recorded payments…</p>
            : unlinked.length === 0 ? <p className="text-xs text-amber-700">No unlinked payments found — choose “Paid · not recorded” to record it now.</p>
            : (
              <div className="divide-y rounded-md border">
                {unlinked.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={linkIds.has(p.id)}
                      onChange={() => setLinkIds((x) => { const n = new Set(x); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
                    <span className="min-w-0 flex-1 truncate">{p.paymentNumber} · {(p.paymentMethod || "").replace("_", " ")} · {p.paymentDate}</span>
                    <span className="shrink-0 font-medium tabular-nums">{currency(p.amount)}</span>
                  </label>
                ))}
              </div>
            )
          )}
          {payMode === "RECORDED" && linkIds.size > 0 && (
            <p className="text-xs text-slate-500">Linked {currency(linkedTotal)} of {currency(totals.grand)} — {linkedTotal >= totals.grand - 0.01 ? "invoice will be marked paid." : "invoice will be partly paid."}</p>
          )}
          {payMode === "NEW" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select value={newMethod} onChange={(e) => setNewMethod(e.target.value)} className="h-10 rounded-md border border-input px-3 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <Input type="number" min={0} value={newAmount === "" ? "" : newAmount} placeholder={`Paid ${Math.round(totals.grand)}`}
                onChange={(e) => setNewAmount(e.target.value === "" ? "" : Number(e.target.value))} />
              <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Ref / Txn" />
            </div>
          )}
          {payMode !== "NONE" && <p className="text-xs text-slate-500">The invoice is issued and the payment settled on save. Recorded payments are linked, not duplicated.</p>}
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
