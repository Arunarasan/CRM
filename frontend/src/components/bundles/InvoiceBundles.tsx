import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bundleApi, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_STYLES, type Bundle } from "@/api/bundleApi";
import type { InvoiceItem } from "@/types/finance";
import type { CompanyProfile } from "@/lib/companyProfile";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BundleWorkEditor, { defaultWorkHeader, type WorkHeader, type WorkLine } from "./BundleWorkEditor";
import { specToJson } from "./workSpec";
import { printBundleStickers, getLabelSize, setLabelSize, LABEL_SIZES, type LabelSize } from "./printStickers";
import HandoverDialog from "./HandoverDialog";
import { useAuth } from "@/hooks/useAuth";
import { Package, Printer, Plus, HandCoins } from "lucide-react";

/**
 * "Bundles" card on a bill: the stickered work bundles raised for it, a sticker print (size picker),
 * and "Create bundle" for bills raised without one. {@code autoStickers} (after a counter sale with
 * work) opens the sticker print once the bundles load.
 */
export default function InvoiceBundles({
  invoiceId, items, cancelled, company, autoStickers, onAutoDone, onChanged, paidKey,
}: {
  invoiceId: number;
  items: InvoiceItem[];
  cancelled: boolean;
  company?: CompanyProfile;
  autoStickers?: boolean;
  onAutoDone?: () => void;
  /** After a handover (it may have collected a payment) — lets the bill page reload its totals. */
  onChanged?: () => void;
  /** Changes when a payment lands on the bill — reloads so stickers print the current balance. */
  paidKey?: string;
}) {
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [size, setSize] = useState<LabelSize>(getLabelSize);
  const [createOpen, setCreateOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const autoDone = useRef(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const { hasAnyAuthority } = useAuth();
  const canMove = hasAnyAuthority(["BUNDLE_MOVE", "BUNDLE_WRITE"]);

  const load = useCallback(() => {
    bundleApi.forInvoice(invoiceId).then(setBundles).catch(() => setBundles([]));
  }, [invoiceId]);
  useEffect(() => { load(); }, [load, paidKey]);

  const print = useCallback((list: Bundle[], quiet = false) => {
    const ok = printBundleStickers(list, size, company);
    setBlocked(!ok);
    if (!ok && !quiet) toast.error("Allow pop-ups for this site to print stickers.");
  }, [size, company]);

  // After a counter sale with work: open the sticker print once (after the bill print has opened).
  useEffect(() => {
    if (!autoStickers || autoDone.current || !bundles || !company) return;
    autoDone.current = true;
    onAutoDone?.();
    if (bundles.length === 0) return;
    const t = setTimeout(() => print(bundles, true), 1500);
    return () => clearTimeout(t);
  }, [autoStickers, bundles, company, print, onAutoDone]);

  const changeSize = (v: LabelSize) => { setSize(v); setLabelSize(v); };

  if (bundles === null) return null;
  if (bundles.length === 0 && cancelled) return null;

  return (
    <div className={`bg-white border rounded-2xl shadow-sm p-5 ${blocked ? "ring-2 ring-amber-300" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Package className="w-4 h-4 text-slate-500" /> Work bundles</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {bundles.length > 0 && (
            <>
              <select value={size} onChange={(e) => changeSize(e.target.value as LabelSize)}
                className="h-9 rounded-md border bg-white px-2 text-xs" title="Sticker size">
                {LABEL_SIZES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
              {canMove && bundles.some((b) => b.status === "READY") && (
                <Button size="sm" variant="outline" onClick={() => setHandoverOpen(true)}><HandCoins className="w-4 h-4 mr-1" /> Hand over</Button>
              )}
              <Button size="sm" onClick={() => print(bundles)}><Printer className="w-4 h-4 mr-1" /> Print {bundles.length > 1 ? `${bundles.length} stickers` : "sticker"}</Button>
            </>
          )}
          {!cancelled && (
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> {bundles.length ? "Add bundle" : "Create bundle"}</Button>
          )}
        </div>
      </div>
      {blocked && <p className="text-xs text-amber-700 mb-2">The sticker window was blocked — click <b>Print</b> above (and allow pop-ups for this site).</p>}
      {bundles.length === 0 ? (
        <p className="text-sm text-slate-500">No stitching / work bundles on this bill. Create one to print a sticker and track the work.</p>
      ) : (
        <ul className="divide-y text-sm">
          {bundles.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <Link to={`/bundles/${b.id}`} className="font-mono font-bold text-slate-800 hover:underline">{b.code}</Link>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${BUNDLE_STATUS_STYLES[b.status] ?? ""}`}>{BUNDLE_STATUS_LABELS[b.status] ?? b.status}</span>
              <span className="text-slate-500">{b.itemCount} item{b.itemCount === 1 ? "" : "s"}</span>
              <span className="text-slate-500">{b.assigneeName ? `· ${b.assigneeName}` : "· unassigned"}</span>
              {b.dueDate && <span className={b.overdue ? "text-red-600 font-medium" : "text-slate-500"}>· due {b.dueDate}</span>}
              <button className="ml-auto text-xs text-slate-500 hover:text-slate-800 hover:underline" onClick={() => print([b])}>Sticker</button>
            </li>
          ))}
        </ul>
      )}
      {handoverOpen && (
        <HandoverDialog bundles={bundles} onClose={() => setHandoverOpen(false)}
          onDone={() => { setHandoverOpen(false); load(); onChanged?.(); }} />
      )}
      {createOpen && (
        <CreateBundleDialog invoiceId={invoiceId} items={items} onClose={() => setCreateOpen(false)}
          onCreated={(created) => { setCreateOpen(false); load(); print(created); }} />
      )}
    </div>
  );
}

function CreateBundleDialog({ invoiceId, items, onClose, onCreated }: {
  invoiceId: number; items: InvoiceItem[]; onClose: () => void; onCreated: (b: Bundle[]) => void;
}) {
  const [header, setHeader] = useState<WorkHeader>(defaultWorkHeader);
  const [lines, setLines] = useState<Record<number, WorkLine>>({});
  const [saving, setSaving] = useState(false);
  const billLines = items.filter((it) => it.id != null);

  const save = async () => {
    const picked = billLines.filter((it) => lines[it.id!]?.on);
    if (picked.length === 0) { toast.error("Tick the items that need work."); return; }
    const groups = Array.from({ length: header.bundleCount }, () => [] as { invoiceItemId: number; workSpec: string | null }[]);
    picked.forEach((it) => {
      const st = lines[it.id!];
      groups[Math.min(st.bundleNo, header.bundleCount) - 1].push({ invoiceItemId: it.id!, workSpec: specToJson(st.spec) });
    });
    setSaving(true);
    try {
      const created = await bundleApi.create({
        invoiceId, workType: header.workType, dueDate: header.dueDate || null, priority: header.priority,
        resourceType: header.resource?.resourceType ?? null, resourceId: header.resource?.resourceId ?? null,
        handoverMode: header.handoverMode, notes: header.notes || null,
        bundles: groups.filter((g) => g.length).map((g) => ({ items: g })),
      });
      toast.success(`${created.map((b) => b.code).join(", ")} created.`);
      onCreated(created);
    } catch (e) {
      toast.error(apiError(e, "Could not create the bundle."));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create work bundle</DialogTitle></DialogHeader>
        <BundleWorkEditor
          lines={billLines.map((it) => ({ key: it.id!, label: it.description, sub: `${it.quantity} ${it.unit ?? ""}` }))}
          header={header} onHeader={(p) => setHeader((h) => ({ ...h, ...p }))}
          lineState={lines} onLine={(key, p) => setLines((m) => ({ ...m, [key]: { ...(m[key] ?? { on: false, bundleNo: 1, spec: {} }), ...p } }))} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create & print sticker"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
