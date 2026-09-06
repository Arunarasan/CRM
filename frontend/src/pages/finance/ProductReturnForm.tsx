import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { financeApi } from "@/api/financeApi";
import { inventoryApi } from "@/api/inventoryApi";
import { useGoBack } from "@/hooks/useGoBack";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Invoice, ReturnableInvoice } from "@/types/finance";
import { currency } from "./helpers";
import { ArrowLeft, Search, Undo2, PackageCheck, AlertTriangle, X } from "lucide-react";

interface CustomerLite { id: number; name: string }
interface WarehouseLite { id: number; name: string }
type Cond = "GOOD" | "DAMAGED";
interface LineState { qty: number; condition: Cond; rate: number }
const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"];

export default function ProductReturnForm() {
  const navigate = useNavigate();
  const goBack = useGoBack("/billing/returns");
  const [params] = useSearchParams();

  // sale selector
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<Invoice[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);

  // selected sale
  const [invoiceId, setInvoiceId] = useState(params.get("invoiceId") ?? "");
  const [detail, setDetail] = useState<ReturnableInvoice | null>(null);
  const [entry, setEntry] = useState<Record<number, LineState>>({});

  // settlement + inventory
  const [warehouses, setWarehouses] = useState<WarehouseLite[]>([]);
  const [settlement, setSettlement] = useState<"CREDIT_NOTE" | "REFUND">("CREDIT_NOTE");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [updateInventory, setUpdateInventory] = useState(true);
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/customers?size=500").then((r) => setCustomers(r.data?.content ?? r.data ?? [])).catch(() => {});
    inventoryApi.getWarehouses().then((w) => setWarehouses(w ?? [])).catch(() => {});
  }, []);

  // Load matching sales whenever the filters change (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      financeApi.getInvoices({
        size: 20, search: search || undefined,
        customerId: customerId ? Number(customerId) : undefined,
        from: from || undefined, to: to || undefined,
      })
        .then((r) => setResults((r.content ?? []).filter((i) => !["DRAFT", "CANCELLED"].includes(i.status ?? ""))))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, customerId, from, to]);

  useEffect(() => {
    if (!invoiceId) { setDetail(null); return; }
    financeApi.getReturnableItems(Number(invoiceId))
      .then((d) => {
        setDetail(d);
        setEntry(Object.fromEntries(d.items.map((l) => [l.invoiceItemId, { qty: 0, condition: "GOOD" as Cond, rate: l.unitPrice }])));
      })
      .catch((e) => { toast.error(apiError(e, "Could not load the sale.")); setDetail(null); });
  }, [invoiceId]);

  const patch = (id: number, p: Partial<LineState>) => setEntry((e) => ({ ...e, [id]: { ...e[id], ...p } }));

  const pickSale = (i: Invoice) => { setInvoiceId(String(i.id)); setShowResults(false); setSearch(""); };
  const clearSale = () => { setInvoiceId(""); setDetail(null); };

  const summary = useMemo(() => {
    if (!detail) return { total: 0, good: 0, damaged: 0 };
    let total = 0, good = 0, damaged = 0;
    for (const l of detail.items) {
      const st = entry[l.invoiceItemId];
      const n = st?.qty || 0;
      if (n <= 0) continue;
      const base = n * (st.rate || 0);
      total += base + base * (l.gstRate || 0) / 100;
      if (st.condition === "DAMAGED") damaged += n; else good += n;
    }
    return { total, good, damaged };
  }, [detail, entry]);

  const damagedNoReason = summary.damaged > 0 && !reason.trim();

  const save = async () => {
    if (!detail) { toast.error("Select a sale first."); return; }
    const items = detail.items
      .filter((l) => (entry[l.invoiceItemId]?.qty || 0) > 0)
      .map((l) => ({ invoiceItemId: l.invoiceItemId, quantity: entry[l.invoiceItemId].qty, condition: entry[l.invoiceItemId].condition, unitPrice: entry[l.invoiceItemId].rate }));
    if (items.length === 0) { toast.error("Enter a quantity to return for at least one item."); return; }
    if (damagedNoReason) { toast.error("Add a reason — some items are marked damaged."); return; }
    setSaving(true);
    try {
      const created = await financeApi.createSalesReturn({
        invoiceId: detail.invoiceId, reason: reason || null,
        settlementMode: settlement, refundMethod: settlement === "REFUND" ? refundMethod : null,
        restock: updateInventory, warehouseId: updateInventory && warehouseId ? Number(warehouseId) : null,
        items,
      });
      toast.success(`${created.returnNumber} recorded${settlement === "REFUND" ? " · refund paid" : " · credit note issued"}.`);
      navigate("/billing/returns");
    } catch (e) {
      toast.error(apiError(e, "Could not record the return."));
      setSaving(false);
    }
  };

  return (
    <div className="pb-24">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Undo2 className="w-5 h-5 text-primary" /> New Product Return</h1>
            <p className="text-sm text-muted-foreground">Find the sale, pick the items coming back, and settle — all on one screen.</p>
          </div>
        </div>

        {/* Sale selector */}
        <section className="bg-white border rounded-xl shadow-sm p-3 space-y-2.5">
          {!detail ? (
            <>
              <div className="relative">
                <div className="flex items-center bg-white border rounded-lg px-3 h-11">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input className="flex-1 outline-none text-sm" placeholder="Search bill by invoice # or customer…"
                    value={search} onFocus={() => setShowResults(true)}
                    onChange={(e) => { setSearch(e.target.value); setShowResults(true); }} />
                </div>
                {showResults && results.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border rounded-lg shadow-lg divide-y">
                    {results.map((i) => (
                      <button key={i.id} onMouseDown={() => pickSale(i)} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-800">{i.invoiceNumber}</span>
                          <span className="block text-xs text-slate-500 truncate">{i.customer?.name ?? "—"} · {i.date}</span>
                        </span>
                        <span className="text-sm font-semibold text-slate-700 shrink-0">{currency(i.totalAmount)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                  <option value="">All customers</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">{detail.invoiceNumber.replace(/[^0-9]/g, "").slice(-2) || "#"}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">{detail.invoiceNumber}</div>
                <div className="text-xs text-slate-500 truncate">{detail.customerName ?? "—"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={clearSale}><X className="w-4 h-4 mr-1" /> Change</Button>
            </div>
          )}
        </section>

        {!detail ? (
          <div className="border border-dashed rounded-xl bg-white py-16 text-center text-slate-400">
            <Undo2 className="w-6 h-6 mx-auto mb-2 opacity-60" />
            <p className="text-sm">Search and select a sale above to load its items.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
            {/* Items */}
            <section className="space-y-2">
              {detail.items.map((l) => {
                const st = entry[l.invoiceItemId] ?? { qty: 0, condition: "GOOD" as Cond, rate: l.unitPrice };
                const disabled = l.returnableQty <= 0;
                const damaged = st.condition === "DAMAGED";
                const active = st.qty > 0;
                return (
                  <div key={l.invoiceItemId}
                    className={`rounded-lg border p-3 ${active ? (damaged ? "border-amber-300 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/30") : "border-slate-200 bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{l.description}</div>
                        <div className="text-[11px] text-slate-400">Sold {l.soldQty} · {l.returnableQty} left{l.hsnCode ? ` · HSN ${l.hsnCode}` : ""}</div>
                      </div>
                      <div className="text-sm font-bold text-slate-900 shrink-0">{currency(st.qty * st.rate)}</div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-end gap-3">
                      <label className="text-[11px] text-slate-500">
                        <span>Qty</span>
                        <div className="mt-1 inline-flex items-center rounded-md border bg-white">
                          <button className="px-2 py-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={disabled} onClick={() => patch(l.invoiceItemId, { qty: Math.max(0, st.qty - 1) })}>−</button>
                          <input type="number" min={0} max={l.returnableQty} disabled={disabled} value={st.qty}
                            onChange={(e) => patch(l.invoiceItemId, { qty: Math.max(0, Math.min(Number(e.target.value) || 0, l.returnableQty)) })}
                            className="w-12 text-center text-sm outline-none disabled:opacity-40" />
                          <button className="px-2 py-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-40" disabled={disabled || st.qty >= l.returnableQty} onClick={() => patch(l.invoiceItemId, { qty: Math.min(l.returnableQty, st.qty + 1) })}>+</button>
                        </div>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        <span>Refund rate ₹</span>
                        <Input type="number" min={0} step="0.01" value={st.rate} disabled={disabled}
                          onChange={(e) => patch(l.invoiceItemId, { rate: Number(e.target.value) })} className="mt-1 h-9 w-28 text-right bg-white" />
                        {st.rate !== l.unitPrice && <span className="block text-[10px] text-slate-400">sold at {currency(l.unitPrice)}</span>}
                      </label>
                      <div className="text-[11px] text-slate-500">
                        <span className="block mb-1">Condition</span>
                        <div className="inline-flex rounded-md border overflow-hidden bg-white">
                          <button disabled={disabled || st.qty <= 0} onClick={() => patch(l.invoiceItemId, { condition: "GOOD" })}
                            className={`px-2.5 py-1.5 flex items-center gap-1 text-xs ${!damaged ? "bg-emerald-600 text-white" : "text-slate-500"} disabled:opacity-40`}><PackageCheck className="w-3.5 h-3.5" /> Good</button>
                          <button disabled={disabled || st.qty <= 0} onClick={() => patch(l.invoiceItemId, { condition: "DAMAGED" })}
                            className={`px-2.5 py-1.5 flex items-center gap-1 text-xs ${damaged ? "bg-amber-600 text-white" : "text-slate-500"} disabled:opacity-40`}><AlertTriangle className="w-3.5 h-3.5" /> Damaged</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Summary rail */}
            <aside className="lg:sticky lg:top-4 space-y-3 bg-white border rounded-xl shadow-sm p-4">
              <div>
                <span className="text-sm font-semibold text-slate-700">Reason {summary.damaged > 0 && <span className="text-red-500">*</span>}</span>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong item, damaged, changed mind…" className={`mt-1 ${damagedNoReason ? "border-red-300" : ""}`} />
                {summary.damaged > 0 && <span className="text-[11px] text-amber-700">Also used as the damage note.</span>}
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-700">Settle as</span>
                <div className="mt-1.5 flex gap-2">
                  <button onClick={() => setSettlement("CREDIT_NOTE")} className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${settlement === "CREDIT_NOTE" ? "border-primary bg-primary/5 text-primary" : "text-slate-600"}`}>Credit note</button>
                  <button onClick={() => setSettlement("REFUND")} className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium ${settlement === "REFUND" ? "border-primary bg-primary/5 text-primary" : "text-slate-600"}`}>Refund now</button>
                </div>
                {settlement === "REFUND" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((m) => (
                      <button key={m} onClick={() => setRefundMethod(m)} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${refundMethod === m ? "bg-primary text-white border-primary" : "bg-white text-slate-600"}`}>{m.replace("_", " ")}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={updateInventory} onChange={(e) => setUpdateInventory(e.target.checked)} className="w-4 h-4" /> Update inventory
                </label>
                {updateInventory && (
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-2 h-9 w-full rounded-md border px-2 text-xs">
                    <option value="">Auto (original / default)</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
              </div>
              <div className="border-t pt-3 space-y-1.5 text-sm">
                {summary.good > 0 && <div className="flex items-center gap-2 text-emerald-700"><PackageCheck className="w-4 h-4" /> {summary.good} back to stock</div>}
                {summary.damaged > 0 && <div className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-4 h-4" /> {summary.damaged} damaged</div>}
                <div className="flex justify-between items-baseline border-t pt-2 mt-1">
                  <span className="font-bold text-slate-800">Return total</span>
                  <span className="text-2xl font-black text-slate-900">{currency(summary.total)}</span>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-white/95 backdrop-blur px-4 md:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {detail ? <>{summary.good + summary.damaged} item(s) · <span className="font-semibold text-slate-800">{currency(summary.total)}</span></> : "No sale selected"}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={goBack}>Cancel</Button>
            <Button onClick={save} disabled={saving || !detail || summary.total <= 0 || damagedNoReason}>
              <Undo2 className="w-4 h-4 mr-2" /> {saving ? "Saving…" : settlement === "REFUND" ? `Refund ${currency(summary.total)}` : `Credit ${currency(summary.total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
