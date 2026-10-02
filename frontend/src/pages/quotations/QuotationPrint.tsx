import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2, Pencil, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import { NumCell } from "@/pages/leads/quote/cells";
import {
  buildCategoryBlocks, lineDiscountAmount, quoteCharges, type Quotation, type QuotationItem,
} from "@/types/quotation";
import { resolveFileUrl } from "@/lib/uploadFile";
import { colorsOf, useLineProducts } from "@/pages/leads/quote/productCells";
import { lineTotal, pricingPatch, quoteTotals, readPricing, type QuotePricing } from "./quotationPricing";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Print-optimised quotation, grouped Category → Product (photo, colour, location, qty, rate,
 * discount, amount), then labour / shipping / discount / GST. Rendered as a full-screen overlay on screen (covers the
 * dashboard chrome), and isolated for printing via the visibility technique in the injected <style>
 * so it prints cleanly regardless of the surrounding layout. No PDF library — the browser's
 * "Save as PDF" produces the file.
 *
 * "Edit" turns the sheet into a form right before printing: item prices, customer discount, GST,
 * dates and terms. Edits save to the quotation itself; the editing controls never print.
 * Items the customer dropped (REJECTED) are left off.
 */
export default function QuotationPrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <QuotationPrintView quotationId={Number(id)} onClose={() => navigate(`/quotations/${id}`)} />;
}

/** The print sheet as an overlay — also opened in place from the lead's Sales Journey (no route change). */
export function QuotationPrintView({ quotationId, onClose, onSaved, readOnly }: {
  quotationId: number;
  onClose: () => void;
  /** No Edit button — used where prices are typed on the price sheet, not on the printout. */
  readOnly?: boolean;
  /** Called after an edit is saved, so the screen underneath can refresh. */
  onSaved?: (q: Quotation) => void;
}) {
  const { hasAuthority, isAdmin } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState<Record<number, number | null | undefined>>({});
  const [pricing, setPricing] = useState<QuotePricing>({ mode: "PERCENT", value: 0, gst: 0 });
  const [fields, setFields] = useState({ quotationDate: "", expiryDate: "", termsAndConditions: "" });

  const adopt = (q: Quotation) => {
    setQuotation(q);
    setRates({});
    setPricing(readPricing(q));
    setFields({ quotationDate: q.quotationDate || "", expiryDate: q.expiryDate || "", termsAndConditions: q.termsAndConditions || "" });
  };

  useEffect(() => {
    quotationApi.get(quotationId).then(adopt).catch(console.error).finally(() => setLoading(false));
  }, [quotationId]);

  const status = quotation?.status || "DRAFT";
  const isManager = isAdmin || hasAuthority("ROLE_MANAGER") || hasAuthority("ROLE_PROJECT_MANAGER");
  // Same rule as the server: approved quotations are repriced by managers only; converted never.
  const canEdit = !readOnly && (hasAuthority("QUOTATION_WRITE") || isAdmin) && status !== "CONVERTED"
    && (status !== "APPROVED" || isManager);

  const items = useMemo(() => (quotation?.items || []).filter((i) => i.status !== "REJECTED"), [quotation]);
  const rateOf = (it: QuotationItem) => (rates[it.id!] !== undefined ? rates[it.id!] ?? 0 : it.rate);
  // Live lines while editing: totals, and the material/labour split scaled to the new price
  // (the server does the same on save).
  const liveItems = useMemo(() => items.map((it) => {
    const total = lineTotal(it, rateOf(it));
    if (!editing || rates[it.id!] === undefined) return it;
    return { ...it, rate: rateOf(it), totalAmount: total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, rates, editing]);
  const blocks = useMemo(() => buildCategoryBlocks(liveItems), [liveItems]);
  const { products } = useLineProducts(items.map((i) => i.productId).filter((x): x is number => x != null));
  const swatchOf = (it: QuotationItem) =>
    it.productId != null && it.color
      ? colorsOf(products[it.productId]).find((c) => c.name.toLowerCase() === it.color!.toLowerCase())?.hex
      : undefined;
  const hasPhotos = items.some((i) => i.imageUrl);
  const hasDiscounts = items.some((i) => lineDiscountAmount(i) > 0);
  const totals = useMemo(
    () => (quotation ? quoteTotals(quotation, { items, rateDrafts: rates, pricing }) : null),
    [quotation, items, rates, pricing],
  );
  const client = quotation?.customer?.name || quotation?.lead?.name;

  const saveEdits = async () => {
    if (!quotation) return;
    setSaving(true);
    try {
      const saved = await quotationApi.update(quotationId, {
        ...quotation,
        ...fields,
        quotationDate: fields.quotationDate || undefined,
        expiryDate: fields.expiryDate || undefined,
        items: (quotation.items || []).map((i) => (i.id != null && rates[i.id] !== undefined ? { ...i, rate: rates[i.id] ?? 0 } : i)),
        ...pricingPatch(pricing),
      } as Quotation);
      adopt(saved);
      onSaved?.(saved);
      setEditing(false);
      toast.success("Quotation updated");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save the changes.");
    } finally { setSaving(false); }
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-slate-500">Loading…</div>;
  if (!quotation || !totals) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-red-600">Failed to load quotation.</div>;

  const charges = quoteCharges(quotation);
  const itemsTotal = liveItems.reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
  const shown = editing ? totals : {
    discount: quotation.discount, gst: quotation.gst, grand: quotation.grandTotal,
  };
  // Columns before Amount (#, photo?, product, qty, rate, discount?) — the total row spans them.
  const cols = 4 + (hasPhotos ? 1 : 0) + (hasDiscounts ? 1 : 0);
  const inputCls = "no-print-border rounded border border-slate-300 bg-amber-50 px-1.5 py-0.5 text-xs";

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-neutral-100">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #quotation-print, #quotation-print * { visibility: visible !important; }
          #quotation-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
          @page { margin: 16mm; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white border-b px-4 py-2 shadow-sm">
        <span className="text-sm font-medium text-slate-600">
          {editing ? "Editing — prices, discount, GST, dates and terms" : `Print preview — ${quotation.quotationNumber}`}
        </span>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" variant="outline" disabled={saving} onClick={() => { adopt(quotation); setEditing(false); }}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={saveEdits} className="bg-green-600 hover:bg-green-700 text-white">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onClose}>
                <X className="mr-1.5 h-4 w-4" /> Close
              </Button>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Edit
                </Button>
              )}
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div id="quotation-print" className="mx-auto my-6 max-w-4xl bg-white p-10 text-slate-800 shadow-lg print:my-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QUOTATION</h1>
            <p className="text-sm text-slate-500">{quotation.quotationNumber}{quotation.revisionNumber ? ` · v${quotation.revisionNumber}` : ""}</p>
          </div>
          <div className="text-right text-sm space-y-0.5">
            {client && <p className="font-semibold">{client}</p>}
            {editing ? (
              <>
                <label className="block text-slate-500">Date: <input type="date" className={inputCls} value={fields.quotationDate}
                  onChange={(e) => setFields((f) => ({ ...f, quotationDate: e.target.value }))} /></label>
                <label className="block text-slate-500">Valid until: <input type="date" className={inputCls} value={fields.expiryDate}
                  onChange={(e) => setFields((f) => ({ ...f, expiryDate: e.target.value }))} /></label>
              </>
            ) : (
              <>
                {quotation.quotationDate && <p className="text-slate-500">Date: {quotation.quotationDate}</p>}
                {quotation.expiryDate && <p className="text-slate-500">Valid until: {quotation.expiryDate}</p>}
              </>
            )}
          </div>
        </div>

        {/* Category → products */}
        {blocks.map((block) => (
          <section key={block.category} className="mt-6">
            <h2 className="flex justify-between bg-slate-800 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white"
              style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
              <span>{block.category}</span>
              <span>{formatCurrency(block.total)}</span>
            </h2>
            <table className="mt-1 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-1 pr-1 w-6 font-medium">#</th>
                  {hasPhotos && <th className="py-1 px-1 w-16 font-medium" />}
                  <th className="py-1 px-2 font-medium">Product</th>
                  <th className="py-1 px-2 text-right font-medium">Qty</th>
                  <th className="py-1 px-2 text-right font-medium">Rate</th>
                  {hasDiscounts && <th className="py-1 px-2 text-right font-medium">Discount</th>}
                  <th className="py-1 pl-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {block.items.map((it, idx) => {
                  const disc = lineDiscountAmount(it);
                  const hex = swatchOf(it);
                  const where = it.location || it.roomName;
                  return (
                    <tr key={it.id} className="border-b border-slate-100 align-top" style={{ breakInside: "avoid" }}>
                      <td className="py-1.5 pr-1 text-slate-400">{idx + 1}</td>
                      {hasPhotos && (
                        <td className="py-1.5 px-1">
                          {it.imageUrl && (
                            <img src={resolveFileUrl(it.imageUrl)} alt="" className="h-14 w-14 rounded border border-slate-200 object-cover"
                              onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                          )}
                        </td>
                      )}
                      <td className="py-1.5 px-2">
                        <p className="font-semibold text-slate-800">{it.itemName}</p>
                        {(it.color || where) && (
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-600">
                            {it.color && (
                              <span className="inline-flex items-center gap-1">
                                {hex && (
                                  <span className="inline-block h-2.5 w-2.5 rounded-full border border-slate-300"
                                    style={{ background: hex, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }} />
                                )}
                                Colour: {it.color}
                              </span>
                            )}
                            {where && <span>{it.color ? "· " : ""}{where}</span>}
                          </p>
                        )}
                        {it.description && <p className="mt-0.5 whitespace-pre-line text-[10px] text-slate-500">{it.description}</p>}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        {editing ? (
                          <span className="block w-24 ml-auto">
                            <NumCell value={rateOf(it) != null ? Math.round(Number(rateOf(it)) * 100) / 100 : null} col="printRate" className="h-7 text-xs border-slate-300 bg-amber-50"
                              onCommit={(v) => setRates((r) => ({ ...r, [it.id!]: v ?? 0 }))} />
                          </span>
                        ) : formatCurrency(it.rate)}
                      </td>
                      {hasDiscounts && (
                        <td className="py-1.5 px-2 text-right whitespace-nowrap text-emerald-700">
                          {disc > 0 ? `−${formatCurrency(disc)}` : ""}
                          {disc > 0 && Number(it.discountPercentage ?? 0) > 0 && <span className="block text-[10px]">({it.discountPercentage}%)</span>}
                        </td>
                      )}
                      <td className="py-1.5 pl-2 text-right whitespace-nowrap font-semibold">{formatCurrency(it.totalAmount)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-300 font-semibold">
                  <td className="py-1 pr-2" colSpan={cols}>{block.category} total</td>
                  <td className="py-1 pl-2 text-right">{formatCurrency(block.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}

        {/* Summary */}
        <section className="mt-8 ml-auto max-w-sm text-sm" style={{ breakInside: "avoid" }}>
          {blocks.length > 1 && blocks.map((b) => (
            <div key={b.category} className="flex justify-between py-0.5 text-xs text-slate-500">
              <span>{b.category}</span><span>{formatCurrency(b.total)}</span>
            </div>
          ))}
          <div className={`flex justify-between py-0.5 font-medium ${blocks.length > 1 ? "mt-1 border-t border-slate-200 pt-1" : ""}`}>
            <span>Products total</span><span>{formatCurrency(itemsTotal)}</span>
          </div>
          {(editing || Number(shown.discount ?? 0) > 0) && (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-slate-500 flex items-center gap-1">
                Discount
                {editing && (
                  <>
                    <select className={inputCls} value={pricing.mode}
                      onChange={(e) => setPricing((p) => ({ ...p, mode: e.target.value as QuotePricing["mode"], value: 0 }))}>
                      <option value="PERCENT">%</option>
                      <option value="FLAT">₹</option>
                    </select>
                    <span className="w-16"><NumCell value={pricing.value} className="h-6 text-xs border-slate-300 bg-amber-50"
                      onCommit={(v) => setPricing((p) => ({ ...p, value: v ?? 0 }))} /></span>
                  </>
                )}
                {!editing && pricing.mode === "PERCENT" && pricing.value > 0 && <span>({pricing.value}%)</span>}
              </span>
              <span className="text-emerald-700">−{formatCurrency(shown.discount)}</span>
            </div>
          )}
          {charges.map((c, i) => (
            <div key={i} className="flex justify-between gap-2 py-0.5">
              <span className="text-slate-500">
                {c.label}{c.note && <span className="text-[11px] text-slate-400"> · {c.note}</span>}
              </span>
              <span>+{formatCurrency(c.amount)}</span>
            </div>
          ))}
          {(editing || pricing.gst > 0) && (
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-slate-500 flex items-center gap-1">
                GST
                {editing ? (
                  <span className="w-16 flex items-center gap-0.5"><NumCell value={pricing.gst} className="h-6 text-xs border-slate-300 bg-amber-50"
                    onCommit={(v) => setPricing((p) => ({ ...p, gst: v ?? 0 }))} />%</span>
                ) : <span>({pricing.gst}%)</span>}
              </span>
              <span>+{formatCurrency(shown.gst)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold"><span>Grand Total</span><span>{formatCurrency(shown.grand)}</span></div>
        </section>

        {/* Terms */}
        {editing ? (
          <section className="mt-8 border-t pt-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Terms &amp; Conditions</h2>
            <textarea rows={4} className="mt-1 w-full rounded border border-slate-300 bg-amber-50 p-2 text-xs"
              value={fields.termsAndConditions} placeholder="Payment terms, validity, warranty…"
              onChange={(e) => setFields((f) => ({ ...f, termsAndConditions: e.target.value }))} />
          </section>
        ) : quotation.termsAndConditions && (
          <section className="mt-8 border-t pt-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Terms &amp; Conditions</h2>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{quotation.termsAndConditions}</p>
          </section>
        )}
      </div>
    </div>
  );
}
