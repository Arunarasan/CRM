import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, ChevronDown, ChevronRight, ExternalLink, FileText, Loader2, Lock, Pencil, Ruler, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { boqApi, quoteWorkspaceApi } from "@/api/boqApi";
import type { Boq } from "@/types/boq";
import { leadApi } from "../leadApi";
import { formatDate, statusStyle } from "../constants";
import { ListSkeleton } from "../tabs/shared";
import SiteVisitsTab from "../tabs/SiteVisitsTab";
import RoomsTab from "@/pages/measurements/tabs/RoomsTab";
import BoqSheet from "./BoqSheet";
import { QuotationWorkbench } from "@/pages/quotations/QuotationDetails";
import { NumCell } from "./cells";

/**
 * The combined "Measurement & Quotation" stage as ONE card: rooms, sizes, items, material and labour
 * are entered once on the item sheet (saved to the measurement too); generating the quotation folds
 * that sheet away and the quotation (scope, discount, GST, PDF/print, create project) takes over.
 * Measurement, BOQ and Quotation stay separate records underneath (project conversion, material
 * requirements and progress tracking all depend on them) — this just removes the page-hopping.
 */

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;

export default function QuoteWorkspace({ leadId, onChanged }: { leadId: string; onChanged: () => void }) {
  const { hasAuthority, isAdmin } = useAuth();
  const canMeasure = hasAuthority("MEASUREMENT_WRITE") || isAdmin;
  const canPrice = hasAuthority("BOQ_WRITE") || isAdmin;

  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [boq, setBoq] = useState<Boq | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editMeasurement, setEditMeasurement] = useState(false);
  const [confirmQuote, setConfirmQuote] = useState(false);
  /** Quotation opened in place below (a revision / older version); default = the live one. */
  const [shownQuoteId, setShownQuoteId] = useState<number | null>(null);
  /** Once quoted, the (locked) item sheet folds away — the quotation is the working copy. */
  const [showSheet, setShowSheet] = useState(false);

  const load = useCallback(async () => {
    const [m, b, q] = await Promise.all([
      leadApi.getMeasurements(leadId).catch(() => ({ data: [] })),
      leadApi.getBoqs(leadId).catch(() => ({ data: [] })),
      leadApi.getQuotations(leadId).catch(() => ({ data: [] })),
    ]);
    setMeasurements(m.data || []);
    const list: Boq[] = b.data || [];
    setQuotations(q.data || []);
    // Work on the latest revision only — older ones are history.
    const current = [...list].filter((x) => x.isLatestVersion !== false).sort((x, y) => (y.id ?? 0) - (x.id ?? 0))[0]
      ?? [...list].sort((x, y) => (y.id ?? 0) - (x.id ?? 0))[0];
    setBoq(current?.id ? await boqApi.get(current.id).catch(() => current) : null);
  }, [leadId]);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load]);

  const refreshAll = async () => { await load(); onChanged(); };

  // The pricing sheet's own measurement wins; otherwise the lead's latest one.
  const measurement = useMemo(() => {
    const list = [...measurements].filter((m) => m.status !== "Cancelled").sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return (boq?.measurement?.id && list.find((m) => m.id === boq.measurement!.id)) || list[0];
  }, [measurements, boq]);
  const boqLocked = boq?.status === "APPROVED";
  const latestQuote = useMemo(
    () => [...quotations].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0],
    [quotations],
  );
  // Has the current pricing already been quoted? (Quotation carries its source BOQ.)
  const quotedThisBoq = !!boq && quotations.some((q) => q.boq?.id === boq.id || q.boqId === boq.id);
  // The live quotation for the current pricing (newest one raised from it).
  const activeQuote = useMemo(
    () => (boq ? [...quotations].filter((q) => q.boq?.id === boq.id || q.boqId === boq.id)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] : undefined),
    [quotations, boq],
  );

  const shownId = (shownQuoteId && quotations.some((q) => q.id === shownQuoteId) ? shownQuoteId : null)
    ?? (quotedThisBoq ? activeQuote?.id : null) ?? null;
  const shownQuote = quotations.find((q) => q.id === shownId);

  // ---------------- Actions ----------------

  /** One click: creates the measurement (if needed) and the pricing sheet — no completion gate. */
  const startPricing = async () => {
    setBusy("start");
    try {
      const res = await quoteWorkspaceApi.startPricing(leadId);
      toast.success(res.boqCreated ? "Pricing sheet ready — add rooms and items below" : "Pricing sheet opened");
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not start pricing."));
    } finally { setBusy(null); }
  };

  // Room-size / scope edits on the measurement flow into the pricing automatically (debounced), so
  // there is no separate "sync" step. Items added on the pricing sheet are saved to the measurement
  // by the backend, so both directions stay one list.
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const onMeasurementChanged = () => {
    if (!boq?.id || boqLocked || !canPrice) { load(); return; }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const boqId = boq.id;
    syncTimer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        await boqApi.syncFromMeasurement(boqId);
        await load();
      } catch (e) {
        toast.error(errMsg(e, "Measurement saved, but pricing could not be updated."));
      } finally { setSyncing(false); }
    }, 800);
  };
  useEffect(() => () => { if (syncTimer.current) clearTimeout(syncTimer.current); }, []);

  /** Approved pricing is locked server-side; editing means starting a new revision. */
  const reopenPricing = async () => {
    if (!boq?.id) return;
    setBusy("revise");
    try {
      await boqApi.createRevision(boq.id, "Edited from lead quotation workspace");
      toast.success("New pricing revision opened for editing");
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not open a new revision."));
    } finally { setBusy(null); }
  };

  const saveTotals = async (patch: Parameters<typeof boqApi.updateTotals>[1]) => {
    if (!boq?.id) return;
    try {
      const fresh = await boqApi.updateTotals(boq.id, {
        discountType: boq.discountType === "FLAT" ? "FLAT" : "PERCENT",
        discount: boq.discount ?? 0,
        taxPercent: boq.taxPercent ?? 0,
        ...patch,
      });
      setBoq((b) => (b ? { ...b, ...fresh, items: fresh.items ?? b.items } : fresh));
    } catch (e) {
      toast.error(errMsg(e, "Could not update the totals."));
    }
  };

  /** Server does it in one transaction: finish measurement → approve pricing → create quotation. */
  const generateQuotation = async () => {
    if (!boq?.id) return;
    setBusy("quote");
    try {
      const q: any = await quoteWorkspaceApi.generateQuotation(boq.id);
      toast.success(`Quotation ${q?.quotationNumber ?? ""} created`);
      setConfirmQuote(false);
      setShownQuoteId(q?.id ?? null);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not generate the quotation."));
      await load();
    } finally { setBusy(null); }
  };

  if (loading) return <ListSkeleton rows={5} />;

  const reviseButton = (
    <Button size="sm" variant="outline" disabled={busy === "revise"} onClick={reopenPricing}>
      {busy === "revise" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
      Change prices (new revision)
    </Button>
  );

  // ---------------- Render ----------------

  // One flow, one strip: the quote's own status drives the later steps.
  const currentQuote = activeQuote ?? latestQuote;
  const qStatus = currentQuote?.status;
  const done = [
    quotedThisBoq,
    quotedThisBoq,
    quotedThisBoq && (qStatus === "APPROVED" || qStatus === "CONVERTED"),
    quotedThisBoq && qStatus === "CONVERTED",
  ];
  const boqRef = boq && (isAdmin ? (
    // The full BOQ page (revisions, reports, partial quotes) is admin-only now.
    <Link to={`/boq/${boq.id}`} state={{ from: `/leads/${leadId}` }}
      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
      {boq.boqNumber} · Rev {boq.revisionNumber ?? 1} <ExternalLink className="h-3 w-3" />
    </Link>
  ) : (
    <span className="text-xs text-muted-foreground">{boq.boqNumber} · Rev {boq.revisionNumber ?? 1}</span>
  ));

  return (
    <section className="rounded-xl border bg-card">
      <header className="space-y-3 px-4 py-3 border-b">
        <ProgressStrip done={done} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 min-w-0">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            {measurement ? (
              <span className="truncate">
                {measurement.measurementNumber || `Measurement #${measurement.id}`}
                {measurement.totalArea ? ` · ${measurement.totalArea} sq.ft` : ""}
                {measurement.measurementDate ? ` · ${formatDate(measurement.measurementDate)}` : ""}
              </span>
            ) : <span>No measurement yet</span>}
            {measurement && <span className={`px-1.5 py-0.5 rounded-full font-medium ${statusStyle(measurement.status)}`}>{measurement.status}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-3">
            {boq && canMeasure && measurement && (
              <button type="button" onClick={() => setEditMeasurement((v) => !v)}
                className={`flex items-center gap-1 hover:text-primary ${editMeasurement ? "text-primary font-medium" : ""}`}>
                <Pencil className="h-3 w-3" /> Room details
              </button>
            )}
            {measurement && (
              <Link to={`/measurements/${measurement.id}`} state={{ from: `/leads/${leadId}` }}
                className="hover:text-primary flex items-center gap-1">
                Drawings & photos <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {boqRef}
          </span>
        </div>
      </header>

      <div className="p-3 sm:p-4 space-y-4">
        {/* Room details (ceiling height, doors/windows, scope ticks) — rooms and items themselves are
            added once, on the item sheet, and saved to the measurement automatically. */}
        {boq && editMeasurement && measurement && (
          <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
              Room sizes, doors/windows and scope. Rooms and items are added on the item sheet; size changes update prices automatically.
              {syncing && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Updating prices…</span>}
              {boqLocked && <span className="text-amber-700">Prices are locked — change pricing (new revision) for size changes to reach them.</span>}
            </p>
            <RoomsTab measurementId={measurement.id} canWrite={canMeasure} onChanged={onMeasurementChanged} roomsOnly />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditMeasurement(false)}>Done</Button>
            </div>
          </div>
        )}

        {!boq ? (
          // ---- Nothing yet: visit/measure, then one click opens the item sheet ----
          <div className="space-y-3">
            {!measurement && <SiteVisitsTab leadId={leadId} onChanged={refreshAll} />}
            <div className="rounded-lg border border-dashed p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{measurement ? "Measurement recorded" : "Ready to measure & price"}</p>
                <p className="text-xs text-muted-foreground">
                  Add rooms, sizes, items, material and labour in one sheet — it's saved to the measurement too.
                </p>
              </div>
              {canPrice && (
                <Button size="sm" disabled={busy === "start"} onClick={startPricing}>
                  {busy === "start" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Start
                </Button>
              )}
            </div>
          </div>
        ) : !quotedThisBoq ? (
          // ---- Measuring & pricing: one item sheet, one set of totals ----
          <>
            {boqLocked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Prices are approved and locked.</span>
                {canPrice && reviseButton}
              </div>
            )}
            <BoqSheet boq={boq} canEdit={canPrice && !boqLocked} onBoqChanged={setBoq} />
            <TotalsPanel boq={boq} editable={canPrice && !boqLocked} onSave={saveTotals} />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/[0.03] p-3">
              <div className="text-sm">
                <span>Ready? This creates the customer quotation from the items above.</span>
                {isAdmin && (
                  <Link to={`/boq/${boq.id}`} state={{ from: `/leads/${leadId}` }} className="block text-xs text-muted-foreground hover:text-primary mt-0.5">
                    Need a partial or budget quotation? Open advanced options
                  </Link>
                )}
              </div>
              {canPrice && (
                <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || (boq.items?.length ?? 0) === 0}
                  onClick={() => setConfirmQuote(true)}>
                  <FileText className="h-4 w-4 mr-2" /> Generate Quotation
                </Button>
              )}
            </div>
          </>
        ) : (
          // ---- Quoted: the quotation is the working copy; the item sheet folds away ----
          <div className="rounded-lg border flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <button type="button" onClick={() => setShowSheet((v) => !v)} className="flex items-center gap-2 hover:text-primary">
              {showSheet ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium">Items, material & labour</span>
              <span className="text-muted-foreground tabular-nums">· {boq.items?.filter((i) => i.isActive !== false).length ?? 0} items · {inr(boq.grandTotal)}</span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {canPrice && reviseButton}
          </div>
        )}
        {boq && quotedThisBoq && showSheet && <BoqSheet boq={boq} canEdit={false} onBoqChanged={setBoq} />}

        {/* Quotations — switch in place */}
        {quotations.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1">Quotations:</span>
            {[...quotations].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).map((q) => (
              <button key={q.id} type="button" onClick={() => setShownQuoteId(q.id === shownId ? null : q.id)}
                className={`rounded-full border px-2.5 py-1 flex items-center gap-1.5 ${q.id === shownId ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
                {q.quotationNumber}
                <span className="tabular-nums text-muted-foreground">{inr(q.grandTotal ?? q.totalAmount)}</span>
                {q.id === latestQuote?.id && <span className="text-[10px] uppercase">· latest</span>}
              </button>
            ))}
          </div>
        )}

        {boq && shownId && (
          <div className={quotedThisBoq && shownId === activeQuote?.id ? "" : "rounded-lg border p-3 sm:p-4 bg-background"}>
            {shownQuote && shownQuote.id !== activeQuote?.id && (
              <p className="mb-3 text-xs text-amber-700">
                {activeQuote
                  ? `Showing an older quotation — the current prices are quoted as ${activeQuote.quotationNumber}.`
                  : "Prices have changed since this quotation — generate a new quotation to quote them."}
              </p>
            )}
            <QuotationWorkbench key={shownId} quotationId={shownId} embedded
              pricingSheetTotal={shownQuote && (shownQuote.boq?.id ?? shownQuote.boqId) === boq.id ? boq.grandTotal : undefined}
              onOpenQuotation={(id) => { setShownQuoteId(id); load(); }}
              onChanged={() => { load(); onChanged(); }} />
          </div>
        )}
      </div>

      <Dialog open={confirmQuote} onOpenChange={setConfirmQuote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate quotation?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p>Grand total <span className="font-semibold">{inr(boq?.grandTotal)}</span> across {boq?.items?.filter((i) => i.isActive !== false).length ?? 0} item(s).</p>
            <p className="text-muted-foreground">This finishes the measurement, locks the prices, and creates the quotation in one step. You can still change prices later (new revision).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmQuote(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy === "quote"} onClick={generateQuotation}>
              {busy === "quote" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ProgressStrip({ done }: { done: boolean[] }) {
  const labels = ["Measure & price", "Quote", "Customer approves", "Project"];
  const current = done.findIndex((d) => !d);
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const isDone = done[i];
        const isCurrent = current === i;
        return (
          <div key={l} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              isDone ? "bg-green-500 text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium truncate ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && <div className={`h-0.5 flex-1 rounded ${isDone ? "bg-green-500" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function TotalsPanel({ boq, editable, onSave }: {
  boq: Boq;
  editable: boolean;
  onSave: (patch: { discountType?: "PERCENT" | "FLAT"; discount?: number | null; taxPercent?: number | null }) => void;
}) {
  const flat = boq.discountType === "FLAT";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border p-3 space-y-1.5 text-sm">
        <Row label="Material" value={inr(boq.materialTotal)} />
        <Row label="Labour" value={inr(boq.labourTotal)} />
        <Row label="Subtotal" value={inr(boq.subtotal)} strong />
      </div>
      <div className="rounded-lg border p-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground flex items-center gap-1">
            Discount
            {editable ? (
              <select className="h-7 rounded border bg-background px-1 text-xs" value={flat ? "FLAT" : "PERCENT"}
                onChange={(e) => onSave({ discountType: e.target.value as "PERCENT" | "FLAT" })}>
                <option value="PERCENT">%</option>
                <option value="FLAT">₹</option>
              </select>
            ) : <span className="text-xs">({flat ? "₹" : "%"})</span>}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24"><NumCell value={boq.discount ?? 0} disabled={!editable} className="h-7 border-border" onCommit={(v) => onSave({ discount: v ?? 0 })} /></div>
            <span className="w-24 text-right tabular-nums text-muted-foreground">−{inr(boq.discountAmount)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">GST %</span>
          <div className="flex items-center gap-2">
            <div className="w-24"><NumCell value={boq.taxPercent ?? 0} disabled={!editable} className="h-7 border-border" onCommit={(v) => onSave({ taxPercent: v ?? 0 })} /></div>
            <span className="w-24 text-right tabular-nums text-muted-foreground">+{inr(boq.taxAmount)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5">
          <span className="font-semibold">Grand Total</span>
          <span className="font-bold text-base tabular-nums text-primary">{inr(boq.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
