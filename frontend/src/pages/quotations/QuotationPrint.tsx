import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quotationApi } from "@/api/quotationApi";
import { buildQuotationTree, type Quotation } from "@/types/quotation";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Print-optimised, floor-grouped quotation. Rendered as a full-screen overlay on screen (covers the
 * dashboard chrome), and isolated for printing via the visibility technique in the injected <style>
 * so it prints cleanly regardless of the surrounding layout. No PDF library — the browser's
 * "Save as PDF" produces the file.
 */
export default function QuotationPrint() {
  const { id } = useParams<{ id: string }>();
  const quotationId = Number(id);
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quotationApi.get(quotationId).then(setQuotation).catch(console.error).finally(() => setLoading(false));
  }, [quotationId]);

  const tree = useMemo(() => buildQuotationTree(quotation?.items || []), [quotation]);
  const client = quotation?.customer?.name || quotation?.lead?.name;

  if (loading) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-slate-500">Loading…</div>;
  if (!quotation) return <div className="fixed inset-0 z-50 bg-white flex items-center justify-center text-red-600">Failed to load quotation.</div>;

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
      <div className="no-print sticky top-0 flex items-center justify-between gap-2 bg-white border-b px-4 py-2 shadow-sm">
        <span className="text-sm font-medium text-slate-600">Print preview — {quotation.quotationNumber}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/quotations/${quotationId}`)}>
            <X className="mr-1.5 h-4 w-4" /> Close
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div id="quotation-print" className="mx-auto my-6 max-w-4xl bg-white p-10 text-slate-800 shadow-lg print:my-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QUOTATION</h1>
            <p className="text-sm text-slate-500">{quotation.quotationNumber}{quotation.revisionNumber ? ` · v${quotation.revisionNumber}` : ""}</p>
          </div>
          <div className="text-right text-sm">
            {client && <p className="font-semibold">{client}</p>}
            {quotation.quotationDate && <p className="text-slate-500">Date: {quotation.quotationDate}</p>}
            {quotation.expiryDate && <p className="text-slate-500">Valid until: {quotation.expiryDate}</p>}
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
                      <th className="py-1 px-2 text-right font-medium">Material</th>
                      <th className="py-1 px-2 text-right font-medium">Labour</th>
                      <th className="py-1 pl-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.categories.flatMap((cat) =>
                      cat.items.map((it) => (
                        <tr key={it.id} className="border-b border-slate-100 align-top">
                          <td className="py-1 pr-2">{it.itemName}</td>
                          <td className="py-1 px-2 text-slate-500">{it.specification || it.brand || "—"}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{it.quantity} {it.unit}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{formatCurrency(it.materialCost)}</td>
                          <td className="py-1 px-2 text-right whitespace-nowrap">{formatCurrency(it.labourCost)}</td>
                          <td className="py-1 pl-2 text-right whitespace-nowrap font-medium">{formatCurrency(it.totalAmount)}</td>
                        </tr>
                      )),
                    )}
                    <tr className="border-t border-slate-300 font-semibold">
                      <td className="py-1 pr-2" colSpan={5}>{room.room} Total</td>
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
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Material Total</span><span>{formatCurrency(quotation.materialTotal)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Labour Total</span><span>{formatCurrency(quotation.labourTotal)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Additional Charges</span><span>{formatCurrency(quotation.additionalChargesTotal)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Discount</span><span>-{formatCurrency(quotation.discount)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">GST</span><span>+{formatCurrency(quotation.gst)}</span></div>
          <div className="mt-1 flex justify-between border-t-2 border-slate-800 pt-1 text-base font-bold"><span>Grand Total</span><span>{formatCurrency(quotation.grandTotal)}</span></div>
        </section>

        {/* Terms */}
        {quotation.termsAndConditions && (
          <section className="mt-8 border-t pt-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Terms &amp; Conditions</h2>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{quotation.termsAndConditions}</p>
          </section>
        )}
      </div>
    </div>
  );
}
