import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  bundleApi, extractBundleCode, BUNDLE_FLOW, BUNDLE_STATUS_LABELS, BUNDLE_STATUS_STYLES, BUNDLE_NEXT_ACTION,
  type Bundle, type BundleSummary,
} from "@/api/bundleApi";
import BarcodeScanner from "@/pages/inventory/components/BarcodeScanner";
import { apiError } from "@/lib/apiError";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { BaseInput, Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { Camera, ScanLine, LayoutGrid, List, AlertTriangle, Search, ChevronRight } from "lucide-react";

const VIEW_KEY = "bundles.view";
const BOARD_COLUMNS = [...BUNDLE_FLOW.filter((s) => s !== "DELIVERED"), "ON_HOLD"];

function readView(): "board" | "list" {
  try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board"; } catch { return "board"; }
}

/**
 * Bundles home: a always-focused "scan or enter code" box (USB scanner, phone camera or typing),
 * summary chips, and a board (one column per work step) / list of every bundle.
 */
export default function BundlesPage() {
  const navigate = useNavigate();
  const { hasAuthority } = useAuth();
  const canMove = hasAuthority("BUNDLE_MOVE") || hasAuthority("BUNDLE_WRITE");

  const [code, setCode] = useState("");
  const [looking, setLooking] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"board" | "list">(readView);
  const [summary, setSummary] = useState<BundleSummary | null>(null);
  const [rows, setRows] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // list filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    bundleApi.summary().then(setSummary).catch(() => {});
    const params = view === "board"
      ? { openOnly: true, size: 300 }
      : { q: q.trim() || undefined, status: status || undefined, overdue: overdueOnly, openOnly: !showClosed && !status, size: 200 };
    bundleApi.search(params)
      .then((r) => setRows(r.content ?? []))
      .catch((e) => toast.error(apiError(e, "Could not load bundles.")))
      .finally(() => setLoading(false));
  }, [view, q, status, overdueOnly, showClosed]);

  useEffect(() => {
    const t = setTimeout(load, view === "list" ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, view]);

  useEffect(() => { scanRef.current?.focus(); }, []);

  const switchView = (v: "board" | "list") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  const openCode = async (raw: string) => {
    const c = extractBundleCode(raw);
    if (!c) return;
    setLooking(true);
    try {
      const b = await bundleApi.byCode(c);
      navigate(`/bundles/${b.id}`);
    } catch (e) {
      toast.error(apiError(e, `No bundle found for ${c}`));
      setCode("");
      scanRef.current?.focus();
    } finally {
      setLooking(false);
    }
  };

  const quickMove = async (b: Bundle) => {
    if (!b.nextStatus || b.nextStatus === "DELIVERED") { navigate(`/bundles/${b.id}`); return; }
    try {
      await bundleApi.move(b.id, { status: b.nextStatus });
      toast.success(`${b.code} → ${BUNDLE_STATUS_LABELS[b.nextStatus]}`);
      load();
    } catch (e) {
      toast.error(apiError(e, "Could not move the bundle."));
    }
  };

  const chip = (label: string, value: number | undefined, active: boolean, onClick: () => void, tone = "") => (
    <button onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left min-w-[96px] transition ${active ? "border-slate-800 bg-slate-800 text-white" : `bg-white hover:bg-slate-50 ${tone}`}`}>
      <div className={`text-[11px] uppercase tracking-wide ${active ? "text-white/70" : "text-slate-500"}`}>{label}</div>
      <div className="text-xl font-bold leading-tight">{value ?? "–"}</div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bundles</h1>
          <p className="text-sm text-slate-500">Stitching &amp; making work — scan a sticker to see the items and move it on.</p>
        </div>
        <div className="inline-flex rounded-lg border bg-white p-0.5">
          <button onClick={() => switchView("board")} className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${view === "board" ? "bg-slate-800 text-white" : "text-slate-600"}`}><LayoutGrid className="w-4 h-4" /> Board</button>
          <button onClick={() => switchView("list")} className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${view === "list" ? "bg-slate-800 text-white" : "text-slate-600"}`}><List className="w-4 h-4" /> List</button>
        </div>
      </div>

      {/* scan / enter code */}
      <form onSubmit={(e) => { e.preventDefault(); openCode(code); }}
        className="flex gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-2 focus-within:border-primary">
        <div className="flex flex-1 items-center gap-2 px-2">
          <ScanLine className="w-5 h-5 text-slate-400 shrink-0" />
          <BaseInput ref={scanRef} value={code} onChange={(e) => setCode(e.target.value)} disabled={looking}
            placeholder="Scan sticker or type bundle code (e.g. JB-0042)…" autoComplete="off" spellCheck={false}
            className="h-11 flex-1 bg-transparent text-lg font-mono uppercase outline-none placeholder:normal-case placeholder:font-sans placeholder:text-base" />
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={() => setCameraOpen(true)} title="Scan with camera">
          <Camera className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Camera</span>
        </Button>
        <Button type="submit" className="h-11" disabled={looking || !code.trim()}>{looking ? "Opening…" : "Open"}</Button>
      </form>
      <BarcodeScanner open={cameraOpen} onClose={() => setCameraOpen(false)} onDetect={(t) => openCode(t)} />

      {/* summary */}
      <div className="flex flex-wrap gap-2">
        {chip("In work", summary?.inWork, view === "list" && !status && !overdueOnly && !showClosed, () => { switchView("list"); setStatus(""); setOverdueOnly(false); setShowClosed(false); })}
        {chip("Ready", summary?.ready, view === "list" && status === "READY", () => { switchView("list"); setOverdueOnly(false); setStatus("READY"); })}
        {chip("Overdue", summary?.overdue, view === "list" && overdueOnly, () => { switchView("list"); setStatus(""); setOverdueOnly(true); }, summary?.overdue ? "border-red-200 text-red-700" : "")}
        {chip("On hold", summary?.onHold, view === "list" && status === "ON_HOLD", () => { switchView("list"); setOverdueOnly(false); setStatus("ON_HOLD"); })}
      </div>

      {view === "board" ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {BOARD_COLUMNS.map((col) => {
              const cards = rows.filter((b) => b.status === col);
              return (
                <div key={col} className="w-64 shrink-0 rounded-xl bg-slate-50 border">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-semibold text-slate-700">{BUNDLE_STATUS_LABELS[col]}</span>
                    <span className="text-xs text-slate-500">{cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                    {cards.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{loading ? "Loading…" : "Empty"}</p>}
                    {cards.map((b) => (
                      <BundleCard key={b.id} b={b} canMove={canMove && col !== "ON_HOLD"} onMove={() => quickMove(b)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, customer or phone" className="h-9 pl-8" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-white px-2 text-sm">
              <option value="">All open</option>
              {[...BUNDLE_FLOW, "ON_HOLD", "CANCELLED"].map((s) => <option key={s} value={s}>{BUNDLE_STATUS_LABELS[s]}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <BaseInput type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="w-4 h-4" /> Overdue
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <BaseInput type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="w-4 h-4" /> Include delivered
            </label>
          </div>
          {/* desktop table */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Tailor</th><th className="px-4 py-2.5">Ready by</th><th className="px-4 py-2.5">Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/bundles/${b.id}`)}>
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{b.code}</td>
                  <td className="px-4 py-2.5">{b.customerName || "Walk-in"}<div className="text-xs text-slate-400">{b.customerPhone}</div></td>
                  <td className="px-4 py-2.5 text-slate-600">{b.itemCount}</td>
                  <td className="px-4 py-2.5"><StatusPill status={b.status} /></td>
                  <td className="px-4 py-2.5 text-slate-600">{b.assigneeName || <span className="text-slate-400">—</span>}</td>
                  <td className={`px-4 py-2.5 ${b.overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>{b.dueDate || "—"}{b.overdue && " · overdue"}</td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {b.invoiceId ? <Link className="text-slate-600 hover:underline" to={`/billing/invoices/${b.invoiceId}`}>{b.invoiceNumber}</Link> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* mobile cards */}
          <div className="md:hidden divide-y">
            {rows.map((b) => (
              <Link key={b.id} to={`/bundles/${b.id}`} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="font-mono font-bold">{b.code}</span><StatusPill status={b.status} /></div>
                  <div className="text-sm text-slate-600 truncate">{b.customerName || "Walk-in"} · {b.itemCount} item{b.itemCount === 1 ? "" : "s"}</div>
                  <div className={`text-xs ${b.overdue ? "text-red-600" : "text-slate-400"}`}>{b.dueDate ? `Ready by ${b.dueDate}` : "No due date"}{b.assigneeName ? ` · ${b.assigneeName}` : ""}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
          {!loading && rows.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No bundles match.</p>}
        </div>
      )}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${BUNDLE_STATUS_STYLES[status] ?? ""}`}>
      {BUNDLE_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function BundleCard({ b, canMove, onMove }: { b: Bundle; canMove: boolean; onMove: () => void }) {
  return (
    <div className={`rounded-lg border bg-white p-2.5 shadow-sm ${b.overdue ? "border-red-300" : ""}`}>
      <Link to={`/bundles/${b.id}`} className="block">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold text-slate-800">{b.code}</span>
          {(b.priority === "HIGH" || b.priority === "URGENT") && (
            <span className="text-[10px] font-semibold uppercase text-red-600">{b.priority}</span>
          )}
        </div>
        <div className="text-sm text-slate-700 truncate">{b.customerName || "Walk-in"}</div>
        <div className="text-xs text-slate-500">{b.itemCount} item{b.itemCount === 1 ? "" : "s"} · {b.assigneeName || "unassigned"}</div>
        {b.status === "ON_HOLD" && b.holdReason && <div className="text-xs text-orange-700 mt-1 line-clamp-2">{b.holdReason}</div>}
        {b.dueDate && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${b.overdue ? "text-red-600 font-medium" : "text-slate-400"}`}>
            {b.overdue && <AlertTriangle className="w-3 h-3" />} Ready by {b.dueDate}
          </div>
        )}
      </Link>
      {canMove && b.nextStatus && (
        <button onClick={onMove}
          className="mt-2 w-full rounded-md border border-slate-200 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
          {BUNDLE_NEXT_ACTION[b.nextStatus] ?? BUNDLE_STATUS_LABELS[b.nextStatus]} →
        </button>
      )}
    </div>
  );
}
