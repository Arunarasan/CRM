import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCategoryBlocks, type Quotation } from "@/types/quotation";
import { downloadQuotationPdf, loadPdfImages, quotationPdfUrl, selectionTotals } from "@/lib/quotationPdf";

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Pick which items go into the quotation PDF and preview it before downloading. Grouped Floor → Room
 * like the PDF itself; ticking a floor/room ticks everything under it. The preview re-renders a moment
 * after the selection changes.
 */
export default function QuotationPdfDialog({
  quotation, open, onOpenChange, defaultSelectedIds,
}: {
  quotation: Quotation;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Items ticked when the dialog opens (e.g. the customer's scope); default = every item in scope. */
  defaultSelectedIds?: number[];
}) {
  const allIds = useMemo(
    () => (quotation.items || []).map((i) => i.id).filter((id): id is number => id != null),
    [quotation.items],
  );
  const initialIds = useMemo(
    () => defaultSelectedIds ?? (quotation.items || [])
      .filter((i) => i.status !== "REJECTED").map((i) => i.id).filter((id): id is number => id != null),
    [defaultSelectedIds, quotation.items],
  );
  const blocks = useMemo(() => buildCategoryBlocks(quotation.items || []), [quotation.items]);
  // Line photos for the PDF, loaded once per open (jsPDF needs them as data URLs).
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadPdfImages(quotation).then((m) => alive && setImages(m));
    return () => { alive = false; };
  }, [open, quotation]);

  const [selected, setSelected] = useState<Set<number>>(new Set(initialIds));
  const [includeExtras, setIncludeExtras] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Fresh dialog → start from the default selection.
  useEffect(() => {
    if (open) { setSelected(new Set(initialIds)); setIncludeExtras(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sel = useMemo(() => ({ itemIds: selected, includeExtras, images }), [selected, includeExtras, images]);
  const totals = useMemo(() => selectionTotals(quotation, sel), [quotation, sel]);

  // Debounced preview render; revoke the previous blob URL so they don't pile up.
  useEffect(() => {
    if (!open) return;
    setRendering(true);
    const t = setTimeout(() => {
      try {
        const url = selected.size ? quotationPdfUrl(quotation, sel) : null;
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreviewUrl(url);
      } finally { setRendering(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [open, quotation, sel, selected.size]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const setMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const idsOf = (items: { id?: number }[]) => items.map((i) => i.id).filter((id): id is number => id != null);
  const stateOf = (ids: number[]) => {
    const n = ids.filter((id) => selected.has(id)).length;
    return n === 0 ? "none" : n === ids.length ? "all" : "some";
  };

  const allState = stateOf(allIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Quotation PDF — choose items</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)] min-h-0 flex-1">
          {/* ---- Item picker ---- */}
          <div className="flex flex-col min-h-0 border rounded-lg">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
              <TriCheck state={allState} label={`All items (${selected.size}/${allIds.length})`}
                onChange={(on) => setMany(allIds, on)} bold />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMany(allIds, true)}>All</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMany(allIds, false)}>None</Button>
              </div>
            </div>
            <div className="overflow-y-auto p-2 space-y-2 max-h-[38vh] md:max-h-none md:flex-1">
              {blocks.map((b) => {
                const ids = idsOf(b.items);
                return (
                  <div key={b.category}>
                    <TriCheck state={stateOf(ids)} label={b.category} onChange={(on) => setMany(ids, on)} bold upper />
                    <div className="ml-5 mt-0.5">
                      {b.items.map((it) => (
                        <label key={it.id ?? it.itemName} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded px-1">
                          <input type="checkbox" className="h-4 w-4 accent-primary"
                            checked={it.id != null && selected.has(it.id)}
                            disabled={it.id == null}
                            onChange={(e) => it.id != null && setMany([it.id], e.target.checked)} />
                          <span className="flex-1 min-w-0 truncate">{it.itemName}{it.color ? ` · ${it.color}` : ""}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{inr(it.totalAmount)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {totals.extras > 0 && (
              <label className="flex items-center gap-2 px-3 py-2 border-t text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={includeExtras}
                  onChange={(e) => setIncludeExtras(e.target.checked)} />
                <span className="flex-1">Quotation-level charges & labour</span>
                <span className="text-xs tabular-nums text-muted-foreground">{inr(totals.extras)}</span>
              </label>
            )}
            <div className="border-t px-3 py-2 text-sm space-y-0.5 bg-muted/20">
              <Row label="Discount" value={`− ${inr(totals.discount)}`} />
              <Row label="GST" value={`+ ${inr(totals.gst)}`} />
              <Row label="Grand total" value={inr(totals.grandTotal)} strong />
              {totals.isPartial && (
                <p className="text-[11px] text-muted-foreground pt-1">
                  Partial selection — discount and GST are applied at the quotation's overall rate.
                </p>
              )}
            </div>
          </div>

          {/* ---- Preview ---- */}
          <div className="flex flex-col min-h-0 gap-2">
            <div className="relative flex-1 min-h-[40vh] md:min-h-[60vh] rounded-lg border bg-muted/30 overflow-hidden">
              {previewUrl ? (
                // Phones don't render PDFs inside a frame — "Open preview" below covers them.
                <iframe title="Quotation PDF preview" src={`${previewUrl}#toolbar=0&view=FitH`} className="absolute inset-0 h-full w-full hidden sm:block" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Select at least one item to preview.
                </div>
              )}
              {previewUrl && (
                <div className="sm:hidden absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  Tap “Open preview” to view the PDF.
                </div>
              )}
              {rendering && (
                <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs shadow">
                  <Loader2 className="h-3 w-3 animate-spin" /> Updating preview…
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={!previewUrl} onClick={() => previewUrl && window.open(previewUrl, "_blank")}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open preview
              </Button>
              <Button disabled={selected.size === 0} onClick={() => downloadQuotationPdf(quotation, sel)}>
                <FileDown className="mr-2 h-4 w-4" /> Download PDF{totals.isPartial ? ` (${selected.size} item${selected.size === 1 ? "" : "s"})` : ""}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TriCheck({ state, label, onChange, bold, upper }: {
  state: "none" | "some" | "all"; label: string; onChange: (on: boolean) => void; bold?: boolean; upper?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = state === "some"; }, [state]);
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input ref={ref} type="checkbox" className="h-4 w-4 accent-primary" checked={state === "all"}
        onChange={() => onChange(state !== "all")} />
      <span className={`${bold ? "font-semibold" : ""} ${upper ? "uppercase text-xs tracking-wide text-primary" : ""}`}>{label}</span>
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold text-primary" : ""}`}>{value}</span>
    </div>
  );
}
