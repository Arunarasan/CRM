import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2, Pencil, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import { NumCell } from "@/pages/leads/quote/cells";
import { buildQuotationTree, type Quotation, type QuotationItem } from "@/types/quotation";
import { lineTotal, pricingPatch, quoteTotals, readPricing, type QuotePricing } from "./quotationPricing";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Print-optimised, floor-grouped quotation. Rendered as a full-screen overlay on screen (covers the
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
    const m = Number(it.materialCost ?? 0), l = Number(it.labourCost ?? 0);
    const base = Number(rateOf(it) ?? 0) * Number(it.quantity ?? 0) * (1 - Number(it.discountPercentage ?? 0) / 100);
    const share = m + l > 0 ? m / (m + l) : 1;
    return { ...it, totalAmount: total, materialCost: base * share, labourCost: base * (1 - share) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items, rates, editing]);
  const tree = useMemo(() => buildQuotationTree(liveItems), [liveItems]);
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

  const shown = editing ? totals : {
    material: quotation.materialTotal, labour: quotation.labourTotal, discount: quotation.discount,
    gst: quotation.gst, grand: quotation.grandTotal,
  };
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

        {/* Floors */}
        {tree.floors.map((floor) => (
          <section key={floor.floor} className="mt-6">
            <h2 className="bg-slate-800 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-white">{floor.floor}</h2>
            {floor.rooms.map((room) => (
              <div key={room.room} className="mt-3">
                <h3 className="text-sm font-semibold text-slate-700">{room.room}</h3>
                <table className="mt-1 w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-y border-slate-300 text-left text-slate-500">
                      <th className="py-1 pr-2 font-medium">Item</th>
                      <th className="py-1 px-2 font-medium">Specification</th>
                      <th className="py-1 px-2 text-right font-medium">Qty</th>
                      {editing && <th className="py-1 px-2 text-right font-medium">Rate</th>}
                      <th className="py-1 px-2 text-right font-medium">Material</th>
                      <th className="py-1 px-2 text-right font-medium">Labour</th>
                      <th className="py-1 pl-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.categories.flatMap((cat) =>
                      cat.items.map((it) => (
                        <tr key={it.id} className="border-b border-slate-100 align-top">
                          <td className="py-1 pr-2">
                            {it.itemName}
                            {it.description && <p className="mt-0.5 whitespace-pre-line text-[10px] text-slate-500">{it.description}</p>}
                          </td>
                          <td className="py-1 px-2 text-slate-500">{it.specification || it.brand || "—"}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                          {editing && (
                            <td className="py-0.5 px-1 w-28">
                              <NumCell value={rateOf(it)} col="printRate" className="h-7 text-xs border-slate-300 bg-amber-50"
                                onCommit={(v) => setRates((r) => ({ ...r, [it.id!]: v ?? 0 }))} />
                            </td>
                          )}
                          <td className="py-1 px-2 text-right whitespace-nowrap">{formatCurrency(it.materialCost)}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{formatCurrency(it.labourCost)}</td>
                          <td className="py-1 pl-2 text-right whitespace-nowrap font-medium">{formatCurrency(it.totalAmount)}</td>
                        </tr>
                      )),
                    )}
                    <tr className="border-t border-slate-300 font-semibold">
                      <td className="py-1 pr-2" colSpan={editing ? 6 : 5}>{room.room} Total</td>
                      <td className="py-1 pl-2 text-right">{formatCurrency(room.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t-2 border-slate-800 pt-1 text-sm font-bold">
              <span>{floor.floor} Total</span>
              <span>{formatCurrency(floor.total)}</span>
            </div>
          </section>
        ))}

        {/* Floor summary */}
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Floor Summary</h2>
          <table className="mt-1 w-full text-sm">
            <tbody>
              {tree.floors.map((floor) => (
                <tr key={floor.floor} className="border-b border-slate-100">
                  <td className="py-1">{floor.floor}</td>
                  <td className="py-1 text-right">{formatCurrency(floor.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Grand summary */}
        <section className="mt-6 ml-auto max-w-xs text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Material Total</span><span>{formatCurrency(shown.material)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Labour Total</span><span>{formatCurrency(shown.labour)}</span></div>
          {Number(quotation.additionalChargesTotal ?? 0) > 0 && (
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Additional Charges</span><span>{formatCurrency(quotation.additionalChargesTotal)}</span></div>
          )}
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
            <span>-{formatCurrency(shown.discount)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-slate-500 flex items-center gap-1">
              GST
              {editing ? (
                <span className="w-16 flex items-center gap-0.5"><NumCell value={pricing.gst} className="h-6 text-xs border-slate-300 bg-amber-50"
                  onCommit={(v) => setPricing((p) => ({ ...p, gst: v ?? 0 }))} />%</span>
              ) : pricing.gst > 0 && <span>({pricing.gst}%)</span>}
            </span>
            <span>+{formatCurrency(shown.gst)}</span>
          </div>
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
