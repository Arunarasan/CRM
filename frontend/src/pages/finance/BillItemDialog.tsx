import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ImageCaptureField from "@/components/ImageCaptureField";
import { UnitOptions } from "@/components/UnitOptions";
import { currency } from "./helpers";

/** One bill line as the counter-sale screen keeps it. */
export interface BillItem {
  key: number;
  productId: number | null;
  name: string;
  notes: string;
  imageUrl: string;
  hsnCode: string;
  unit: string;
  qty: number;
  rate: number;
  gst: number;
}

const GST_RATES = [0, 5, 12, 18, 28];

/**
 * Add a new (non-catalogue) item to the bill, or edit a line's details: name, description, photo,
 * quantity, unit, rate and GST — with the line amount worked out as you type. A catalogue item keeps
 * its name; its description and photo can still be changed.
 */
export default function BillItemDialog({ item, taxInclusive, onClose, onSave }: {
  /** The line to edit; a fresh custom line when adding. */
  item: BillItem;
  taxInclusive: boolean;
  onClose: () => void;
  onSave: (item: BillItem) => void;
}) {
  const adding = !item.name && item.productId == null;
  const [f, setF] = useState(() => ({
    ...item,
    qty: String(item.qty || 1),
    rate: item.rate ? String(item.rate) : "",
  }));
  const [error, setError] = useState("");
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  useEffect(() => setError(""), [f.name, f.qty]);

  const qty = Math.floor(Number(f.qty) || 0);
  const rate = Math.max(0, Number(f.rate) || 0);

  const save = () => {
    if (!f.name.trim()) { setError("Enter the item name."); return; }
    if (qty < 1) { setError("Enter a quantity of 1 or more."); return; }
    onSave({ ...f, name: f.name.trim(), notes: f.notes.trim(), qty, rate });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{adding ? "Add new item" : "Item details"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save(); }}
          className="grid gap-5 sm:grid-cols-[200px_1fr]">
          {/* photo */}
          <div>
            <ImageCaptureField module="INVOICE" value={f.imageUrl} onChange={(r) => set({ imageUrl: r.url })}
              label="Photo (optional)" allowEdit />
            {f.imageUrl && (
              <button type="button" onClick={() => set({ imageUrl: "" })}
                className="mt-1.5 text-xs text-slate-500 hover:text-red-600 hover:underline">Remove photo</button>
            )}
          </div>

          {/* details */}
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Item name <span className="text-red-500">*</span></span>
              {item.productId != null ? (
                <div className="mt-1 rounded-md border bg-slate-50 px-3 py-2 text-slate-800">{f.name}</div>
              ) : (
                <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })}
                  placeholder="e.g. Blackout curtain fabric" className="mt-1 h-10" />
              )}
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Description</span>
              <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} rows={3}
                placeholder="Colour, size, design, any detail for the bill"
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-[11px] text-slate-400">Printed under the item name on the bill.</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Quantity <span className="text-red-500">*</span></span>
                <Input type="number" inputMode="numeric" min={1} step={1} value={f.qty}
                  onChange={(e) => set({ qty: e.target.value })} onFocus={(e) => e.target.select()}
                  className="mt-1 h-10 text-base font-semibold tabular-nums" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Unit</span>
                <select value={f.unit} onChange={(e) => set({ unit: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm">
                  <UnitOptions value={f.unit} />
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Rate ₹{taxInclusive ? " (incl. GST)" : ""}</span>
                <Input type="number" inputMode="decimal" min={0} value={f.rate} placeholder="0"
                  onChange={(e) => set({ rate: e.target.value })} onFocus={(e) => e.target.select()}
                  className="mt-1 h-10 tabular-nums" />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">HSN code</span>
                <Input value={f.hsnCode} onChange={(e) => set({ hsnCode: e.target.value })} placeholder="Optional" className="mt-1 h-10" />
              </label>
            </div>

            <div className="text-sm">
              <span className="font-medium text-slate-700">GST</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {GST_RATES.map((g) => (
                  <button key={g} type="button" onClick={() => set({ gst: g })}
                    className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${f.gst === g ? "border-slate-800 bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {g}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="text-sm text-slate-500">{qty || 0} × {currency(rate)}</span>
              <span className="text-lg font-bold tabular-nums text-slate-900">{currency(qty * rate)}</span>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <button type="submit" className="hidden" />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{adding ? "Add to bill" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
