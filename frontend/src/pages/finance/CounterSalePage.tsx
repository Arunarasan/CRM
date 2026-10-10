import { useEffect, useMemo, useRef, useState } from "react";
import GstModeToggle from "@/components/ui/gst-mode-toggle";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import { inventoryApi } from "@/api/inventoryApi";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input, BaseInput } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { currency } from "./helpers";
import BundleWorkEditor, { defaultWorkHeader, type WorkHeader, type WorkLine } from "@/components/bundles/BundleWorkEditor";
import { specToJson } from "@/components/bundles/workSpec";
import { resolveFileUrl } from "@/lib/uploadFile";
import BillItemDialog, { type BillItem } from "./BillItemDialog";
import { Plus, Search, Trash2, Wrench, Scissors, Receipt, RotateCcw, Banknote, ImageIcon, Pencil } from "lucide-react";

interface CustomerLite { id: number; name: string; phone?: string }
interface ProductLite { id: number; name?: string; sku?: string; materialCode?: string; unit?: string; hsnCode?: string; gstPercent?: number; price?: number; sellingPrice?: number; imageUrl?: string }
interface WarehouseLite { id: number; name: string }
interface EmployeeLite { id: number; name: string }
type Line = BillItem;

const PAYMENT_METHODS = [
  { v: "CASH", label: "Cash" },
  { v: "UPI", label: "UPI" },
  { v: "CARD", label: "Card" },
  { v: "BANK_TRANSFER", label: "Bank" },
  { v: "CHEQUE", label: "Cheque" },
];

let keySeed = 1;

export default function CounterSalePage() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);

  // customer — walk-in by default; a phone hit adopts an existing record (phone is unique)
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [adopted, setAdopted] = useState<CustomerLite | null>(null);
  // walk-in phone → existing-customer lookup (phone is unique; reuse, never duplicate)
  const [phoneMatch, setPhoneMatch] = useState<CustomerLite | null>(null);
  const [phoneChecking, setPhoneChecking] = useState(false);

  // cart
  const [lines, setLines] = useState<Line[]>([]);
  /** The add-new-item / item-details dialog: a fresh custom line, or the line being edited. */
  const [editing, setEditing] = useState<Line | null>(null);

  // charges / tax
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
  // Shop prices usually include GST — when on, GST is worked out of the prices instead of added.
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FLAT">("FLAT");
  const [discountValue, setDiscountValue] = useState("0");

  // stock
  const [deductStock, setDeductStock] = useState(true);
  const [warehouseId, setWarehouseId] = useState("");

  // installation
  const [installOn, setInstallOn] = useState(false);
  const [installCharge, setInstallCharge] = useState("");
  const [installEmployeeId, setInstallEmployeeId] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [installNotes, setInstallNotes] = useState("");

  // stitching / making work → stickered bundles
  const [workOn, setWorkOn] = useState(false);
  const [workHeader, setWorkHeader] = useState<WorkHeader>(defaultWorkHeader);
  const [workLines, setWorkLines] = useState<Record<number, WorkLine>>({});
  const patchWorkHeader = (patch: Partial<WorkHeader>) => setWorkHeader((h) => ({ ...h, ...patch }));
  const patchWorkLine = (key: number, patch: Partial<WorkLine>) =>
    setWorkLines((m) => ({ ...m, [key]: { ...(m[key] ?? { on: false, bundleNo: 1, spec: {} }), ...patch } }));

  // payment
  const [collectNow, setCollectNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  // Advance: take part now, the rest is collected at pickup (bundle handover)
  const [payMode, setPayMode] = useState<"FULL" | "ADVANCE">("FULL");
  const [advance, setAdvance] = useState("");

  // bill print — auto-opens the chosen format right after checkout
  const [printFormat, setPrintFormat] = useState<"receipt" | "invoice" | "none">("receipt");

  const [saving, setSaving] = useState(false);
  // Cash handed over → change to give back (shown only; not stored on the bill).
  const [cashGiven, setCashGiven] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inventoryApi.getWarehouses().then((w) => {
      setWarehouses(w ?? []);
      if (w?.length) setWarehouseId(String(w[0].id));
    }).catch(() => {});
    financeApi.getAssignableEmployees().then(setEmployees).catch(() => {});
  }, []);

  // Look up an existing customer by phone as the biller types (walk-in only).
  // Phone is treated as unique: a hit means we reuse that customer instead of creating a new one.
  useEffect(() => {
    if (adopted) { setPhoneMatch(null); return; }
    const phone = custPhone.trim();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) { setPhoneMatch(null); setPhoneChecking(false); return; }
    setPhoneChecking(true);
    const t = setTimeout(() => {
      api.get("/customers", { params: { phone, size: 5 } })
        .then((r) => {
          const list: CustomerLite[] = r.data?.content ?? r.data ?? [];
          const norm = (s?: string) => (s ?? "").replace(/\D/g, "");
          const hit = list.find((c) => norm(c.phone) === digits) ?? null;
          setPhoneMatch(hit);
        })
        .catch(() => setPhoneMatch(null))
        .finally(() => setPhoneChecking(false));
    }, 300);
    return () => clearTimeout(t);
  }, [custPhone, adopted]);

  // Adopt the matched existing customer (reuse the record, don't create/modify one).
  const adoptCustomer = () => {
    if (!phoneMatch) return;
    setAdopted(phoneMatch);
    setCustName(phoneMatch.name);
    setCustPhone(phoneMatch.phone ?? custPhone);
    setPhoneMatch(null);
  };
  // Back to entering a fresh walk-in.
  const clearAdopted = () => { setAdopted(null); setCustName(""); setCustPhone(""); };

  const addProduct = (p: ProductLite) => {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const next = [...ls];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...ls, {
        key: keySeed++, productId: p.id ?? null, name: p.name ?? "Item", notes: "", imageUrl: p.imageUrl ?? "",
        hsnCode: p.hsnCode ?? "", unit: p.unit ?? "Nos",
        qty: 1, rate: Number(p.sellingPrice ?? p.price ?? 0), gst: Number(p.gstPercent ?? 18),
      }];
    });
  };
  const addCustomLine = () =>
    setEditing({ key: keySeed++, productId: null, name: "", notes: "", imageUrl: "", hsnCode: "", unit: "Nos", qty: 1, rate: 0, gst: 18 });
  /** Dialog saved: replace the edited line, or append a new one. */
  const saveLine = (item: Line) => {
    setLines((ls) => (ls.some((l) => l.key === item.key) ? ls.map((l) => (l.key === item.key ? item : l)) : [...ls, item]));
    setEditing(null);
  };
  const patchLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  const totals = useMemo(() => {
    const productSub = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const install = installOn ? Number(installCharge) || 0 : 0;
    const work = workOn ? Number(workHeader.charge) || 0 : 0;
    // Same maths as the server (FinanceService.computeTotals): with GST-inclusive prices each line's
    // before-GST base is worked out first, and a flat discount comes off the with-GST amount.
    const gross = productSub + install + work;
    const taxLines = [
      ...lines.map((l) => ({ amount: l.qty * l.rate, rate: l.gst || 0 })),
      ...(install > 0 ? [{ amount: install, rate: 18 }] : []),
      ...(work > 0 ? [{ amount: work, rate: 5 }] : []),
    ].map((l) => ({ ...l, base: taxInclusive ? l.amount / (1 + l.rate / 100) : l.amount }));
    const subTotal = taxLines.reduce((s, l) => s + l.base, 0);
    const flat = Number(discountValue) || 0;
    let discount = discountType === "PERCENTAGE" ? subTotal * flat / 100
      : taxInclusive && gross > 0 ? flat * subTotal / gross : flat;
    if (discount > subTotal) discount = subTotal;
    const taxable = subTotal - discount;
    const gst = taxLines.reduce((s, l) => (subTotal === 0 ? s : s + (taxable * (l.base / subTotal)) * l.rate / 100), 0);
    const grand = Math.round(taxable + gst);
    const discountShown = taxInclusive ? Math.max(0, gross - (taxable + gst)) : discount;
    return { productSub, install, work, subTotal, discount: discountShown, gst, grand };
  }, [lines, installOn, installCharge, workOn, workHeader.charge, discountType, discountValue, taxInclusive]);

  const itemCount = lines.reduce((s, l) => s + (l.name.trim() ? l.qty : 0), 0);
  // A walk-in needs no name — a nameless sale bills the canonical "Walk-in Customer".
  const advanceAmt = Math.max(0, Number(advance) || 0);
  const isAdvance = collectNow && payMode === "ADVANCE" && advanceAmt > 0 && advanceAmt < totals.grand;
  const canSave = lines.some((l) => l.name.trim() && l.qty > 0) || (installOn && Number(installCharge) > 0);

  const save = async () => {
    if (saving) return;
    const validItems = lines.filter((l) => l.name.trim() && l.qty > 0);
    if (validItems.length === 0 && !(installOn && Number(installCharge) > 0)) { toast.error("Add at least one item."); return; }
    const workItems = workOn ? validItems.filter((l) => workLines[l.key]?.on) : [];
    if (workOn && workItems.length === 0) { toast.error("Tick the items that need stitching / work."); return; }
    setSaving(true);
    try {
      // A walk-in phone that already exists reuses that customer (phone is unique) — never a duplicate.
      const reuseId = adopted?.id ?? phoneMatch?.id ?? null;
      const created = await financeApi.createCounterSale({
        customerId: reuseId,
        customerName: reuseId ? null : custName.trim(),
        customerPhone: reuseId ? null : (custPhone.trim() || null),
        gstType, taxInclusive, discountType, discountValue: Number(discountValue) || 0,
        deductStock, warehouseId: deductStock && warehouseId ? Number(warehouseId) : null,
        items: validItems.map((l) => {
          const w = workOn ? workLines[l.key] : undefined;
          return {
            productId: l.productId, description: l.name.trim(), hsnCode: l.hsnCode || null,
            notes: l.notes.trim() || null, imageUrl: l.imageUrl || null,
            unit: l.unit || null, quantity: l.qty, unitPrice: l.rate, gstRate: l.gst || 0,
            needsWork: !!w?.on, bundleNo: w?.on ? Math.min(w.bundleNo, workHeader.bundleCount) : null,
            workSpec: w?.on ? specToJson(w.spec) : null,
          };
        }),
        work: workOn ? {
          enabled: true, charge: Number(workHeader.charge) || 0, gstRate: 5,
          workType: workHeader.workType, bundleCount: workHeader.bundleCount,
          dueDate: workHeader.dueDate || null, priority: workHeader.priority,
          resourceType: workHeader.resource?.resourceType ?? null, resourceId: workHeader.resource?.resourceId ?? null,
          handoverMode: workHeader.handoverMode, notes: workHeader.notes || null,
        } : { enabled: false },
        installation: installOn ? {
          enabled: true, charge: Number(installCharge) || 0, gstRate: 18,
          employeeId: installEmployeeId ? Number(installEmployeeId) : null,
          scheduledDate: installDate || null, notes: installNotes || null,
        } : { enabled: false },
        collectNow, paymentMethod: collectNow ? paymentMethod : null,
        paidAmount: isAdvance ? advanceAmt : null,
      });
      toast.success(`${created.invoiceNumber} saved${isAdvance ? ` · advance ${currency(advanceAmt)}, balance ${currency(totals.grand - advanceAmt)}` : collectNow ? " · paid" : ""}.`);
      const q = new URLSearchParams();
      if (printFormat !== "none") q.set("print", printFormat);
      if (workOn) q.set("stickers", "1"); // invoice page offers / opens the bundle stickers
      navigate(`/billing/invoices/${created.id}${q.toString() ? `?${q}` : ""}`);
    } catch (e) {
      toast.error(apiError(e, "Could not complete the sale."));
      setSaving(false);
    }
  };

  /** Start a fresh bill (keeps the tax, stock and print settings). */
  const clearBill = () => {
    setLines([]); setCustName(""); setCustPhone(""); setAdopted(null); setPhoneMatch(null);
    setDiscountValue("0"); setInstallOn(false); setInstallCharge(""); setInstallEmployeeId(""); setInstallDate(""); setInstallNotes("");
    setWorkOn(false); setWorkHeader(defaultWorkHeader); setWorkLines({}); setCashGiven("");
    searchRef.current?.focus();
  };

  // Keyboard-first billing: F2 product search, F4 customer phone, F9 charge.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "F4") { e.preventDefault(); phoneRef.current?.focus(); }
      else if (e.key === "F9") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { searchRef.current?.focus(); }, []);

  const cash = Number(cashGiven) || 0;
  const showCash = collectNow && paymentMethod === "CASH";
  const payingNow = isAdvance ? advanceAmt : totals.grand; // what the cash has to cover
  const change = cash - payingNow;
  const blocker = saving ? null
    : !canSave ? "Add an item to charge"
    : workOn && !lines.some((l) => l.name.trim() && workLines[l.key]?.on) ? "Tick the items that need stitching / work"
    : null;
  const quickCash = Array.from(new Set([
    Math.ceil(payingNow),
    Math.ceil(payingNow / 100) * 100,
    Math.ceil(payingNow / 500) * 500,
    Math.ceil(payingNow / 2000) * 2000,
  ])).filter((v) => v > 0).slice(0, 4);

  return (
    <div className="h-full flex flex-col lg:flex-row bg-white border rounded-xl overflow-hidden">
        {/* LEFT — cart */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          <ProductAdd onPick={addProduct} onCustom={addCustomLine} inputRef={searchRef} />

          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">Scan a barcode or search a product to start the bill</p>
              <p className="mt-1 text-xs text-slate-400">Enter adds the top match · use <span className="font-semibold text-slate-500">New item</span> for anything not in stock</p>
              <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Kbd>F2</Kbd> Search</span>
                <span className="inline-flex items-center gap-1"><Kbd>F4</Kbd> Customer</span>
                <span className="inline-flex items-center gap-1"><Kbd>F9</Kbd> Charge</span>
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              {/* header row (desktop) */}
              <div className="hidden md:grid grid-cols-[28px_1fr_auto_120px_70px_110px_36px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b bg-slate-50/60">
                <span>#</span><span>Item</span><span className="text-center">Quantity</span><span className="text-right">Rate ₹{taxInclusive ? " (incl.)" : ""}</span>
                <span className="text-right">GST%</span><span className="text-right">Amount</span><span />
              </div>
              {lines.map((l, idx) => (
                <div key={l.key} className="grid grid-cols-2 md:grid-cols-[28px_1fr_auto_120px_70px_110px_36px] gap-2 md:gap-3 items-center px-3 py-2.5 border-b last:border-0 hover:bg-slate-50/50">
                  <span className="hidden md:block text-xs font-semibold tabular-nums text-slate-400">{idx + 1}</span>
                  {/* item: photo + name + description — click to edit the details */}
                  <button type="button" onClick={() => setEditing(l)} title="Edit description / photo"
                    className="group col-span-2 md:col-span-1 min-w-0 flex items-center gap-2.5 text-left">
                    {l.imageUrl ? (
                      <img src={resolveFileUrl(l.imageUrl)} alt="" className="h-11 w-11 shrink-0 rounded-md border object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed text-slate-300 group-hover:border-slate-400 group-hover:text-slate-500">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <span className="truncate">{l.name || "Unnamed item"}</span>
                        <Pencil className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-slate-500" />
                      </span>
                      {l.notes
                        ? <span className="block text-xs text-slate-500 line-clamp-2">{l.notes}</span>
                        : <span className="block text-[11px] text-slate-400 group-hover:text-primary">+ Add description / photo</span>}
                      {l.hsnCode && <span className="block text-[11px] text-slate-400">HSN {l.hsnCode}</span>}
                    </span>
                  </button>
                  {/* quantity — typed in */}
                  <div className="flex items-center justify-center gap-1.5">
                    <Input type="number" inputMode="numeric" min={1} step={1} aria-label="Quantity"
                      value={l.qty || ""} onFocus={(e) => e.target.select()}
                      onChange={(e) => patchLine(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      onBlur={() => { if (!l.qty) patchLine(l.key, { qty: 1 }); }}
                      className="h-9 w-20 text-center text-sm font-semibold tabular-nums" />
                    <span className="text-xs text-slate-400">{l.unit}</span>
                  </div>
                  <div className="md:text-right">
                    <Input type="number" min={0} value={l.rate} onChange={(e) => patchLine(l.key, { rate: Number(e.target.value) })} className="h-9 md:text-right" />
                  </div>
                  <div className="md:text-right">
                    <Input type="number" min={0} value={l.gst} onChange={(e) => patchLine(l.key, { gst: Number(e.target.value) })} className="h-9 md:text-right" />
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums text-slate-800">{currency(l.qty * l.rate)}</div>
                  <button aria-label="Remove item" className="text-slate-300 hover:text-red-500 justify-self-end" onClick={() => removeLine(l.key)}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* installation add-on */}
          <div className="bg-white border rounded-xl">
            <label className="flex items-center gap-2.5 px-3 py-3 cursor-pointer">
              <BaseInput type="checkbox" checked={installOn} onChange={(e) => setInstallOn(e.target.checked)} className="w-4 h-4" />
              <Wrench className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Add installation</span>
              <span className="text-xs text-slate-400">creates a task for an employee</span>
            </label>
            {installOn && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 pb-3">
                <label className="text-xs col-span-2 md:col-span-1"><span className="text-slate-500">Charge ₹</span>
                  <Input type="number" min={0} value={installCharge} onChange={(e) => setInstallCharge(e.target.value)} className="h-9 mt-1" /></label>
                <label className="text-xs col-span-2 md:col-span-1"><span className="text-slate-500">Assign to</span>
                  <SearchableSelect value={installEmployeeId} onChange={setInstallEmployeeId}
                    options={employees.map((e) => ({ value: String(e.id), label: e.name }))}
                    placeholder="Anyone (pool)" clearLabel="Anyone (pool)" /></label>
                <label className="text-xs"><span className="text-slate-500">Date</span>
                  <Input type="date" value={installDate} onChange={(e) => setInstallDate(e.target.value)} className="h-9 mt-1" /></label>
                <label className="text-xs"><span className="text-slate-500">Notes</span>
                  <Input value={installNotes} onChange={(e) => setInstallNotes(e.target.value)} className="h-9 mt-1" placeholder="Optional" /></label>
              </div>
            )}
          </div>

          {/* stitching / making work add-on → stickered bundles */}
          <div className="bg-white border rounded-xl">
            <label className="flex items-center gap-2.5 px-3 py-3 cursor-pointer">
              <BaseInput type="checkbox" checked={workOn} onChange={(e) => setWorkOn(e.target.checked)} className="w-4 h-4" />
              <Scissors className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Needs stitching / work</span>
              <span className="text-xs text-slate-400">prints a sticker for each order</span>
            </label>
            {workOn && (
              <div className="px-3 pb-3">
                <BundleWorkEditor
                  lines={lines.map((l) => ({ key: l.key, label: l.name, sub: `${l.qty} ${l.unit}` }))}
                  header={workHeader} onHeader={patchWorkHeader}
                  lineState={workLines} onLine={patchWorkLine} showCharge installing={installOn} />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — bill */}
        <div className="lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l bg-slate-50/60 flex flex-col">
          <div className="border-b bg-white px-4 pt-3 pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-700" />
                <span className="text-sm font-bold text-slate-800">Current bill</span>
                {lines.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">{lines.length} product{lines.length === 1 ? "" : "s"}</span>}
              </div>
              <button type="button" onClick={clearBill} disabled={lines.length === 0 && !custName && !custPhone && !adopted}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40">
                <RotateCcw className="h-3.5 w-3.5" /> New bill
              </button>
            </div>
            {/* Tax settings — label left, choice right */}
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Prices</span>
                <GstModeToggle size="sm" inclusive={taxInclusive} onChange={setTaxInclusive} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Customer is in</span>
                <div role="radiogroup" aria-label="Place of supply" className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
                  {([["CGST_SGST", "Same state"], ["IGST", "Other state"]] as const).map(([v, label]) => (
                    <button key={v} type="button" role="radio" aria-checked={gstType === v} onClick={() => setGstType(v)}
                      className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold transition active:scale-[0.98] ${
                        gstType === v ? "bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:text-slate-700"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* customer */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</span>
                <span className="text-[10px] text-slate-400"><Kbd>F4</Kbd></span>
              </div>
              {adopted ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-emerald-800 truncate">{adopted.name}</span>
                    <span className="block text-[11px] text-emerald-600">{adopted.phone || "existing customer"}</span>
                  </span>
                  <button type="button" onClick={clearAdopted} className="text-xs text-emerald-600 hover:text-emerald-800 hover:underline shrink-0">Change</button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Name (optional)" className="h-9" />
                    <Input ref={phoneRef} type="tel" inputMode="tel" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone (optional)" className="h-9" />
                  </div>
                  {phoneMatch ? (
                    <button type="button" onClick={adoptCustomer}
                      className="w-full flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-left hover:bg-emerald-100/70">
                      <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-emerald-800 truncate">{phoneMatch.name}</span>
                        <span className="block text-[11px] text-emerald-600">already has this number — tap to bill this customer</span>
                      </span>
                    </button>
                  ) : phoneChecking ? (
                    <p className="text-[11px] text-slate-400 px-0.5">Checking this number…</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 px-0.5">Leave blank for a walk-in. A known number picks up the customer.</p>
                  )}
                </div>
              )}
            </div>

            {/* totals */}
            <div className="space-y-1.5 text-sm border-t pt-3">
              <Row label={`Items (${itemCount} qty)`} value={currency(totals.productSub)} />
              {installOn && totals.install > 0 && <Row label="Installation" value={currency(totals.install)} />}
              {workOn && totals.work > 0 && <Row label="Stitching / work" value={currency(totals.work)} />}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-slate-500">
                  <span>Discount</span>
                  <div className="inline-flex rounded border text-[11px] overflow-hidden">
                    <button onClick={() => setDiscountType("FLAT")} className={`px-1.5 ${discountType === "FLAT" ? "bg-slate-700 text-white" : "text-slate-500"}`}>₹</button>
                    <button onClick={() => setDiscountType("PERCENTAGE")} className={`px-1.5 ${discountType === "PERCENTAGE" ? "bg-slate-700 text-white" : "text-slate-500"}`}>%</button>
                  </div>
                </div>
                <BaseInput type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-24 h-8 rounded-md border px-2 text-right text-sm" />
              </div>
              {totals.discount >= 0.5 && <Row label="Discount applied" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />}
              <Row label={taxInclusive ? "GST (included)" : "GST"} value={currency(totals.gst)} />
              <div className="mt-1 flex items-baseline justify-between rounded-xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-100">
                <span className="text-sm font-bold text-emerald-900">Total</span>
                <span className="text-[28px] font-black leading-none tabular-nums tracking-tight text-slate-900">{currency(totals.grand)}</span>
              </div>
            </div>

            {/* stock */}
            <label className="flex items-center gap-2 text-xs text-slate-600 border-t pt-3">
              <BaseInput type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="w-3.5 h-3.5" />
              Reduce stock
              {deductStock && (
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="ml-auto h-8 rounded-md border px-2 text-xs max-w-[150px]">
                  <option value="">Auto</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
            </label>

            {/* payment */}
            <div className="border-t pt-3">
              <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                <BaseInput type="checkbox" checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} className="w-4 h-4" />
                Collect payment now
              </label>
              {collectNow && (
                <div className="mb-2 space-y-2">
                  <div className="inline-flex rounded-md border overflow-hidden text-xs">
                    {([["FULL", "Full"], ["ADVANCE", "Advance"]] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setPayMode(v)}
                        className={`px-3 py-1 ${payMode === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {payMode === "ADVANCE" && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 shrink-0">Paying now ₹</span>
                        <BaseInput type="number" min={0} inputMode="decimal" value={advance} onChange={(e) => setAdvance(e.target.value)}
                          placeholder="0" className="h-8 w-full rounded-md border px-2 text-sm" />
                      </div>
                      {advanceAmt > 0 && advanceAmt < totals.grand ? (
                        <p className="text-xs font-medium text-amber-700">Balance {currency(totals.grand - advanceAmt)} due at pickup</p>
                      ) : advanceAmt >= totals.grand && totals.grand > 0 ? (
                        <p className="text-xs text-slate-500">That covers the full bill — it will be paid in full.</p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
              {collectNow && (
                <div className="grid grid-cols-5 gap-1">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.v} onClick={() => setPaymentMethod(m.v)}
                      className={`rounded-lg border py-1.5 text-xs font-semibold transition active:scale-[0.97] ${paymentMethod === m.v ? "bg-primary text-white border-primary" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
              {showCash && totals.grand > 0 && (
                <div className="mt-3 rounded-xl border bg-white p-3">
                  <label className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Banknote className="h-3.5 w-3.5 text-emerald-700" /> Cash given</span>
                    <BaseInput type="number" min={0} inputMode="decimal" value={cashGiven} onChange={(e) => setCashGiven(e.target.value)} placeholder="0"
                      className="h-9 w-28 rounded-md border px-2 text-right text-sm font-semibold tabular-nums" />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {quickCash.map((v) => (
                      <button key={v} type="button" onClick={() => setCashGiven(String(v))}
                        className="rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 active:scale-95">
                        {currency(v)}
                      </button>
                    ))}
                  </div>
                  {cash > 0 && (
                    <div className={`mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm font-bold ${change >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                      <span>{change >= 0 ? "Change to return" : "Short by"}</span>
                      <span className="tabular-nums">{currency(Math.abs(change))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* checkout */}
          <div className="border-t p-3 space-y-2.5">
            {showCash && cash > 0 && totals.grand > 0 && (
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${change >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                <span>{change >= 0 ? `Change to return · cash ${currency(cash)}` : `Short by · cash ${currency(cash)}`}</span>
                <span className="tabular-nums text-base">{currency(Math.abs(change))}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="shrink-0">Print bill</span>
              <div className="ml-auto inline-flex rounded-md border overflow-hidden text-[11px]">
                {([["receipt", "Receipt"], ["invoice", "A4"], ["none", "Off"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPrintFormat(v)}
                    className={`px-2.5 py-1 ${printFormat === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full h-12 text-base active:scale-[0.99]" onClick={save} disabled={saving || !!blocker}>
              {saving ? "Saving…" : isAdvance ? `Take advance ${currency(advanceAmt)}` : collectNow ? `Charge ${currency(totals.grand)}` : `Save Bill · ${currency(totals.grand)}`}
              {!saving && <span className="ml-2 rounded border border-white/30 px-1.5 py-px text-[10px] font-semibold opacity-80">F9</span>}
            </Button>
            {blocker && <p className="text-center text-[11px] text-slate-400">{blocker}</p>}
          </div>
        </div>
        {editing && <BillItemDialog item={editing} taxInclusive={taxInclusive} onClose={() => setEditing(null)} onSave={saveLine} />}
    </div>
  );
}

/** Single search box that appends a product to the cart on select (barcode/name/code). */
function ProductAdd({ onPick, onCustom, inputRef }: {
  onPick: (p: ProductLite) => void; onCustom: () => void; inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      inventoryApi.getProducts({ search, size: 12 }).then((r) => setResults(r.content || [])).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  const pick = (p: ProductLite) => { onPick(p); setSearch(""); setResults([]); setOpen(false); };

  return (
    <div className="flex gap-2">
      <div ref={boxRef} className="relative flex-1">
        <div className="flex items-center bg-white border rounded-lg px-3 h-11 focus-within:ring-2 focus-within:ring-primary/30">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <BaseInput
            ref={inputRef}
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="Scan or search product by name, code, barcode…"
            value={search}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) pick(results[0]);
              if (e.key === "Escape") { setSearch(""); setResults([]); }
            }}
          />
          <Kbd>F2</Kbd>
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border rounded-lg shadow-lg divide-y">
            {results.map((p) => (
              <button key={p.id} type="button" onMouseDown={() => pick(p)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2.5">
                {p.imageUrl
                  ? <img src={resolveFileUrl(p.imageUrl)} alt="" className="h-9 w-9 shrink-0 rounded border object-cover" />
                  : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-slate-50 text-slate-300"><ImageIcon className="h-4 w-4" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">{p.materialCode || p.sku || "—"} · {p.unit || "Nos"}</span>
                </span>
                <span className="text-sm font-semibold text-slate-700 shrink-0">{currency(Number(p.sellingPrice ?? p.price ?? 0))}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button variant="outline" className="h-11 shrink-0" onClick={onCustom}><Plus className="w-4 h-4 mr-1" /> New item</Button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-slate-200 bg-white px-1 py-px font-sans text-[10px] font-semibold text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.08)]">{children}</kbd>;
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className={`font-medium tabular-nums ${valueClass ?? ""}`}>{value}</span></div>;
}
