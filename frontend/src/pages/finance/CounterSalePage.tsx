import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import { inventoryApi } from "@/api/inventoryApi";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchableSelect from "@/components/ui/searchable-select";
import { currency } from "./helpers";
import { Plus, Minus, Search, Trash2, Wrench } from "lucide-react";

interface CustomerLite { id: number; name: string; phone?: string }
interface ProductLite { id: number; name?: string; sku?: string; materialCode?: string; unit?: string; hsnCode?: string; gstPercent?: number; price?: number; sellingPrice?: number }
interface WarehouseLite { id: number; name: string }
interface EmployeeLite { id: number; name: string }
interface Line { key: number; productId: number | null; name: string; hsnCode: string; unit: string; qty: number; rate: number; gst: number }

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

  // charges / tax
  const [gstType, setGstType] = useState<"CGST_SGST" | "IGST">("CGST_SGST");
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

  // payment
  const [collectNow, setCollectNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  // bill print — auto-opens the chosen format right after checkout
  const [printFormat, setPrintFormat] = useState<"receipt" | "invoice" | "none">("receipt");

  const [saving, setSaving] = useState(false);

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
        key: keySeed++, productId: p.id ?? null, name: p.name ?? "Item",
        hsnCode: p.hsnCode ?? "", unit: p.unit ?? "Nos",
        qty: 1, rate: Number(p.sellingPrice ?? p.price ?? 0), gst: Number(p.gstPercent ?? 18),
      }];
    });
  };
  const addCustomLine = () =>
    setLines((ls) => [...ls, { key: keySeed++, productId: null, name: "", hsnCode: "", unit: "Nos", qty: 1, rate: 0, gst: 18 }]);
  const patchLine = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: number) => setLines((ls) => ls.filter((l) => l.key !== key));

  const totals = useMemo(() => {
    const productSub = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const install = installOn ? Number(installCharge) || 0 : 0;
    const subTotal = productSub + install;
    let discount = discountType === "PERCENTAGE" ? subTotal * (Number(discountValue) || 0) / 100 : (Number(discountValue) || 0);
    if (discount > subTotal) discount = subTotal;
    const taxable = subTotal - discount;
    const taxLines = [
      ...lines.map((l) => ({ base: l.qty * l.rate, rate: l.gst })),
      ...(install > 0 ? [{ base: install, rate: 18 }] : []),
    ];
    const gst = taxLines.reduce((s, l) => (subTotal === 0 ? s : s + (taxable * (l.base / subTotal)) * (l.rate || 0) / 100), 0);
    const grand = Math.round(taxable + gst);
    return { productSub, install, subTotal, discount, gst, grand };
  }, [lines, installOn, installCharge, discountType, discountValue]);

  const itemCount = lines.reduce((s, l) => s + (l.name.trim() ? l.qty : 0), 0);
  // A walk-in needs no name — a nameless sale bills the canonical "Walk-in Customer".
  const canSave = lines.some((l) => l.name.trim() && l.qty > 0) || (installOn && Number(installCharge) > 0);

  const save = async () => {
    const validItems = lines.filter((l) => l.name.trim() && l.qty > 0);
    if (validItems.length === 0 && !(installOn && Number(installCharge) > 0)) { toast.error("Add at least one item."); return; }
    setSaving(true);
    try {
      // A walk-in phone that already exists reuses that customer (phone is unique) — never a duplicate.
      const reuseId = adopted?.id ?? phoneMatch?.id ?? null;
      const created = await financeApi.createCounterSale({
        customerId: reuseId,
        customerName: reuseId ? null : custName.trim(),
        customerPhone: reuseId ? null : (custPhone.trim() || null),
        gstType, discountType, discountValue: Number(discountValue) || 0,
        deductStock, warehouseId: deductStock && warehouseId ? Number(warehouseId) : null,
        items: validItems.map((l) => ({
          productId: l.productId, description: l.name.trim(), hsnCode: l.hsnCode || null,
          unit: l.unit || null, quantity: l.qty, unitPrice: l.rate, gstRate: l.gst || 0,
        })),
        installation: installOn ? {
          enabled: true, charge: Number(installCharge) || 0, gstRate: 18,
          employeeId: installEmployeeId ? Number(installEmployeeId) : null,
          scheduledDate: installDate || null, notes: installNotes || null,
        } : { enabled: false },
        collectNow, paymentMethod: collectNow ? paymentMethod : null,
      });
      toast.success(`${created.invoiceNumber} saved${collectNow ? " · paid" : ""}.`);
      const printQ = printFormat === "none" ? "" : `?print=${printFormat}`;
      navigate(`/billing/invoices/${created.id}${printQ}`);
    } catch (e) {
      toast.error(apiError(e, "Could not complete the sale."));
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row bg-white border rounded-xl overflow-hidden">
        {/* LEFT — cart */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3">
          <ProductAdd onPick={addProduct} onCustom={addCustomLine} />

          {lines.length === 0 ? (
            <div className="border border-dashed rounded-xl bg-white py-16 text-center text-slate-400">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Search a product above to start billing.</p>
            </div>
          ) : (
            <div className="bg-white border rounded-xl overflow-hidden">
              {/* header row (desktop) */}
              <div className="hidden md:grid grid-cols-[1fr_auto_120px_70px_110px_36px] gap-3 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-400 border-b">
                <span>Item</span><span className="text-center">Qty</span><span className="text-right">Rate</span>
                <span className="text-right">GST%</span><span className="text-right">Amount</span><span />
              </div>
              {lines.map((l) => (
                <div key={l.key} className="grid grid-cols-2 md:grid-cols-[1fr_auto_120px_70px_110px_36px] gap-2 md:gap-3 items-center px-3 py-2.5 border-b last:border-0">
                  <div className="col-span-2 md:col-span-1 min-w-0">
                    {l.productId ? (
                      <>
                        <div className="text-sm font-medium text-slate-800 truncate">{l.name}</div>
                        <div className="text-[11px] text-slate-400">{l.hsnCode ? `HSN ${l.hsnCode} · ` : ""}{l.unit}</div>
                      </>
                    ) : (
                      <Input value={l.name} placeholder="Item name" onChange={(e) => patchLine(l.key, { name: e.target.value })} className="h-9" />
                    )}
                  </div>
                  {/* qty stepper */}
                  <div className="flex items-center justify-center">
                    <div className="inline-flex items-center rounded-md border">
                      <button className="px-2 py-1.5 text-slate-500 hover:bg-slate-50" onClick={() => patchLine(l.key, { qty: Math.max(1, l.qty - 1) })}><Minus className="w-3.5 h-3.5" /></button>
                      <input value={l.qty} onChange={(e) => patchLine(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })} className="w-10 text-center text-sm outline-none" />
                      <button className="px-2 py-1.5 text-slate-500 hover:bg-slate-50" onClick={() => patchLine(l.key, { qty: l.qty + 1 })}><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <Input type="number" min={0} value={l.rate} onChange={(e) => patchLine(l.key, { rate: Number(e.target.value) })} className="h-9 md:text-right" />
                  </div>
                  <div className="md:text-right">
                    <Input type="number" min={0} value={l.gst} onChange={(e) => patchLine(l.key, { gst: Number(e.target.value) })} className="h-9 md:text-right" />
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-800">{currency(l.qty * l.rate)}</div>
                  <button className="text-slate-300 hover:text-red-500 justify-self-end" onClick={() => removeLine(l.key)}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          {/* installation add-on */}
          <div className="bg-white border rounded-xl">
            <label className="flex items-center gap-2.5 px-3 py-3 cursor-pointer">
              <input type="checkbox" checked={installOn} onChange={(e) => setInstallOn(e.target.checked)} className="w-4 h-4" />
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
        </div>

        {/* RIGHT — bill */}
        <div className="lg:w-[360px] shrink-0 border-t lg:border-t-0 lg:border-l bg-slate-50/60 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <span className="text-sm font-bold text-slate-800">Bill</span>
            <div className="flex items-center rounded-md border bg-slate-50 text-[11px]">
              <button onClick={() => setGstType("CGST_SGST")} className={`px-2 py-1 rounded-l-md ${gstType === "CGST_SGST" ? "bg-slate-800 text-white" : "text-slate-600"}`}>Same state</button>
              <button onClick={() => setGstType("IGST")} className={`px-2 py-1 rounded-r-md ${gstType === "IGST" ? "bg-slate-800 text-white" : "text-slate-600"}`}>Other state</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* customer */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</span>
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
                    <Input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone (optional)" className="h-9" />
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
                  ) : null}
                </div>
              )}
            </div>

            {/* totals */}
            <div className="space-y-1.5 text-sm border-t pt-3">
              <Row label={`Items (${itemCount})`} value={currency(totals.productSub)} />
              {installOn && totals.install > 0 && <Row label="Installation" value={currency(totals.install)} />}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-slate-500">
                  <span>Discount</span>
                  <div className="inline-flex rounded border text-[11px] overflow-hidden">
                    <button onClick={() => setDiscountType("FLAT")} className={`px-1.5 ${discountType === "FLAT" ? "bg-slate-700 text-white" : "text-slate-500"}`}>₹</button>
                    <button onClick={() => setDiscountType("PERCENTAGE")} className={`px-1.5 ${discountType === "PERCENTAGE" ? "bg-slate-700 text-white" : "text-slate-500"}`}>%</button>
                  </div>
                </div>
                <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-24 h-8 rounded-md border px-2 text-right text-sm" />
              </div>
              {totals.discount > 0 && <Row label="Discount applied" value={`− ${currency(totals.discount)}`} valueClass="text-red-600" />}
              <Row label="GST" value={currency(totals.gst)} />
              <div className="flex justify-between items-baseline border-t pt-2 mt-1">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-2xl font-black text-slate-900">{currency(totals.grand)}</span>
              </div>
            </div>

            {/* stock */}
            <label className="flex items-center gap-2 text-xs text-slate-600 border-t pt-3">
              <input type="checkbox" checked={deductStock} onChange={(e) => setDeductStock(e.target.checked)} className="w-3.5 h-3.5" />
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
                <input type="checkbox" checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} className="w-4 h-4" />
                Collect payment now
              </label>
              {collectNow && (
                <div className="flex flex-wrap gap-1.5">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m.v} onClick={() => setPaymentMethod(m.v)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border ${paymentMethod === m.v ? "bg-primary text-white border-primary" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* checkout */}
          <div className="border-t p-3 space-y-2.5">
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
            <Button className="w-full h-12 text-base" onClick={save} disabled={saving || !canSave}>
              {saving ? "Saving…" : collectNow ? `Charge ${currency(totals.grand)}` : `Save Bill · ${currency(totals.grand)}`}
            </Button>
          </div>
        </div>
    </div>
  );
}

/** Single search box that appends a product to the cart on select (barcode/name/code). */
function ProductAdd({ onPick, onCustom }: { onPick: (p: ProductLite) => void; onCustom: () => void }) {
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
          <input
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="Scan or search product by name, code, barcode…"
            value={search}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && results[0]) pick(results[0]); }}
          />
        </div>
        {open && results.length > 0 && (
          <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border rounded-lg shadow-lg divide-y">
            {results.map((p) => (
              <button key={p.id} type="button" onMouseDown={() => pick(p)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">{p.materialCode || p.sku || "—"} · {p.unit || "Nos"}</span>
                </span>
                <span className="text-sm font-semibold text-slate-700 shrink-0">{currency(Number(p.sellingPrice ?? p.price ?? 0))}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button variant="outline" className="h-11 shrink-0" onClick={onCustom}><Plus className="w-4 h-4 mr-1" /> Custom</Button>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return <div className="flex justify-between"><span className="text-slate-500">{label}</span><span className={`font-medium ${valueClass ?? ""}`}>{value}</span></div>;
}
