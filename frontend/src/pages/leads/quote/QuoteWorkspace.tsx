import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, ExternalLink, FileText, Loader2, Lock, Pencil, Ruler, Sparkles, Wand2,
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
 * The combined "Measurement & Quotation" stage: measure → price → quote on one screen.
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

  const step = !boq ? 0 : !quotedThisBoq ? 1 : 3;
  const shownId = (shownQuoteId && quotations.some((q) => q.id === shownQuoteId) ? shownQuoteId : null)
    ?? activeQuote?.id ?? latestQuote?.id ?? null;
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

  const startButton = canPrice && (
    <Button size="sm" disabled={busy === "start"} onClick={startPricing}>
      {busy === "start" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
      Start pricing
    </Button>
  );

  // ---------------- Render ----------------

  return (
    <div className="space-y-5">
      <ProgressStrip step={step} />

      {/* ============ A. Site & room sizes ============ */}
      <Section n={1} title="Site & room sizes" done={!!boq} icon={Ruler}
        right={measurement && (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyle(measurement.status)}`}>{measurement.status}</span>
            <Link to={`/measurements/${measurement.id}`} state={{ from: `/leads/${leadId}` }}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              Drawings & photos <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}>
        {!boq ? (
          <div className="space-y-3">
            {!measurement && <SiteVisitsTab leadId={leadId} onChanged={refreshAll} />}
            <div className="rounded-lg border border-dashed p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{measurement ? "Measurement recorded" : "Ready to measure & price"}</p>
                <p className="text-xs text-muted-foreground">
                  Rooms, sizes and items go straight into the pricing sheet — they're saved to the measurement too.
                </p>
              </div>
              {startButton}
            </div>
          </div>
        ) : editMeasurement && measurement ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
              Room sizes and scope here update the pricing automatically.
              {syncing && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Updating pricing…</span>}
              {boqLocked && <span className="text-amber-700">Pricing is locked — open a new revision for these changes to reach it.</span>}
            </p>
            <RoomsTab measurementId={measurement.id} canWrite={canMeasure} onChanged={onMeasurementChanged} />
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditMeasurement(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {measurement ? (measurement.measurementNumber || `Measurement #${measurement.id}`) : "Measurement"}
              {measurement?.totalArea ? ` · ${measurement.totalArea} sq.ft` : ""}
              {measurement?.measurementDate ? ` · ${formatDate(measurement.measurementDate)}` : ""}
              {" "}— items you add below are saved to it automatically.
            </span>
            {canMeasure && measurement && (
              <Button size="sm" variant="outline" onClick={() => setEditMeasurement(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Room sizes & scope
              </Button>
            )}
          </div>
        )}
      </Section>

      {/* ============ B. Price ============ */}
      <Section n={2} title="Price — items, material & labour" done={!!boq && boqLocked} icon={Sparkles}
        right={boq && (isAdmin ? (
          // The full BOQ page (revisions, reports, partial quotes) is admin-only now.
          <Link to={`/boq/${boq.id}`} state={{ from: `/leads/${leadId}` }}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            {boq.boqNumber} · Rev {boq.revisionNumber ?? 1} <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">{boq.boqNumber} · Rev {boq.revisionNumber ?? 1}</span>
        ))}>
        {!boq ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">No pricing yet. Start it, then add rooms, items, material and labour.</p>
            {startButton}
          </div>
        ) : (
          <div className="space-y-3">
            {boqLocked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Lock className="h-4 w-4" /> Pricing is approved and locked.</span>
                {canPrice && (
                  <Button size="sm" variant="outline" disabled={busy === "revise"} onClick={reopenPricing}>
                    {busy === "revise" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
                    Change pricing (new revision)
                  </Button>
                )}
              </div>
            )}
            <BoqSheet boq={boq} canEdit={canPrice && !boqLocked} onBoqChanged={setBoq} />
          </div>
        )}
      </Section>

      {/* ============ C. Quote ============ */}
      <Section n={3} title="Quote" done={quotedThisBoq} icon={FileText}>
        {!boq ? (
          <p className="text-sm text-muted-foreground">Totals and the quotation appear once pricing has started.</p>
        ) : (
          <div className="space-y-4">
            {!activeQuote?.id && <TotalsPanel boq={boq} editable={canPrice && !boqLocked} onSave={saveTotals} />}

            {!quotedThisBoq && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/[0.03] p-3">
                <div className="text-sm">
                  <span>Ready? This locks the pricing and creates the customer quotation.</span>
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
            )}

            {/* Older quotations (earlier pricing revisions) — opened in place, not on another page. */}
            {quotations.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground mr-1">Quotations:</span>
                {[...quotations].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).map((q) => (
                  <button key={q.id} type="button" onClick={() => setShownQuoteId(q.id)}
                    className={`rounded-full border px-2.5 py-1 flex items-center gap-1.5 ${q.id === shownId ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
                    {q.quotationNumber}
                    <span className="tabular-nums text-muted-foreground">{inr(q.grandTotal ?? q.totalAmount)}</span>
                    {q.id === latestQuote?.id && <span className="text-[10px] uppercase">· latest</span>}
                  </button>
                ))}
              </div>
            )}

            {shownId && (
              <div className="rounded-lg border p-3 sm:p-4 bg-background">
                {shownQuote && shownQuote.id !== activeQuote?.id && (
                  <p className="mb-3 text-xs text-amber-700">
                    {activeQuote
                      ? `Showing an older quotation — the current pricing is quoted as ${activeQuote.quotationNumber}.`
                      : "The pricing has changed since this quotation — generate a new quotation to quote it."}
                  </p>
                )}
                <QuotationWorkbench key={shownId} quotationId={shownId} embedded
                  pricingSheetTotal={shownQuote && (shownQuote.boq?.id ?? shownQuote.boqId) === boq.id ? boq.grandTotal : undefined}
                  onOpenQuotation={(id) => { setShownQuoteId(id); load(); }}
                  onChanged={() => { load(); onChanged(); }} />
              </div>
            )}
          </div>
        )}
      </Section>

      <Dialog open={confirmQuote} onOpenChange={setConfirmQuote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate quotation?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p>Grand total <span className="font-semibold">{inr(boq?.grandTotal)}</span> across {boq?.items?.filter((i) => i.isActive !== false).length ?? 0} item(s).</p>
            <p className="text-muted-foreground">This finishes the measurement, approves and locks the pricing, and creates the quotation in one step. You can still change the pricing later by opening a new revision.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmQuote(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy === "quote"} onClick={generateQuotation}>
              {busy === "quote" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressStrip({ step }: { step: number }) {
  const labels = ["Measure", "Price", "Quote"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const done = step > i;
        const current = step === i;
        return (
          <div key={l} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              done ? "bg-green-500 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium truncate ${current ? "text-foreground" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && <div className={`h-0.5 flex-1 rounded ${done ? "bg-green-500" : "bg-muted"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Section({ n, title, done, icon: Icon, right, children }: {
  n: number; title: string; done?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <span className={`h-5 w-5 rounded-full text-[11px] flex items-center justify-center ${done ? "bg-green-500 text-white" : "bg-primary/10 text-primary"}`}>
            {done ? <Check className="h-3 w-3" /> : n}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </h3>
        {right}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
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
