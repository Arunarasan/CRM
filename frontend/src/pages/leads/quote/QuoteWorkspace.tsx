import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, FileText, FileOutput, History, Loader2, Lock, Pencil, Printer, RotateCcw, Ruler, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BaseInput } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { boqApi, quoteWorkspaceApi } from "@/api/boqApi";
import { quotationApi } from "@/api/quotationApi";
import type { Boq } from "@/types/boq";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES, type Quotation } from "@/types/quotation";
import { leadApi } from "../leadApi";
import { formatDate } from "../constants";
import { ListSkeleton } from "../tabs/shared";
import { QuotationPrintView } from "@/pages/quotations/QuotationPrint";
import BoqSheet from "./BoqSheet";
import { NumCell } from "./cells";

/**
 * The combined Quote page — measure, price, quote, customer approval and later changes all happen
 * here, on one sheet, with no stages:
 *   - each item row carries its size, quantity, description, material/labour and amount;
 *   - the tick on each row is the customer's choice (unticked = not in the quote or its total);
 *   - discount, GST and the final price sit under the sheet;
 *   - Print / Customer approved / Create Project act on the sheet directly.
 * The quotation record is made on first use and the server keeps it identical to the sheet until the
 * customer approves; the sheet then locks. A change after approval opens a new sheet → new quotation.
 * Measurement, BOQ and Quotation stay separate records underneath — this only removes the re-entry.
 */

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;
const QUOTE_DONE = new Set(["APPROVED", "CONVERTED"]);

export default function QuoteWorkspace({ leadId, onChanged, fieldMode, onCreateProject }: {
  leadId: string;
  onChanged: () => void;
  /** Field employee's phone view: no desktop links; "Send to office" + employee Create Project. */
  fieldMode?: boolean;
  /** Field mode: open the employee Create Project sheet (it records the customer's approval too). */
  onCreateProject?: () => void;
}) {
  const { hasAuthority, isAdmin } = useAuth();
  const canPrice = hasAuthority("BOQ_WRITE") || isAdmin;
  const canApprove = isAdmin || (canPrice && hasAuthority("QUOTATION_APPROVE"));
  const canConvert = isAdmin || hasAuthority("QUOTATION_WRITE");

  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [boq, setBoq] = useState<Boq | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [printId, setPrintId] = useState<number | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [convertCfg, setConvertCfg] = useState<{ advanceAmount: string; advanceMethod: string } | null>(null);

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

  // The sheet's own measurement wins; otherwise the lead's latest one.
  const measurement = useMemo(() => {
    const list = [...measurements].filter((m) => m.status !== "Cancelled").sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    return (boq?.measurement?.id && list.find((m) => m.id === boq.measurement!.id)) || list[0];
  }, [measurements, boq]);

  // The quotation made from this sheet (newest), and the older ones for history.
  const quote = useMemo(
    () => (boq ? [...quotations].filter((q) => (q.boq?.id ?? q.boqId) === boq.id).sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] : undefined),
    [quotations, boq],
  );
  const history = useMemo(
    () => [...quotations].filter((q) => q.id !== quote?.id).sort((a, b) => (b.id ?? 0) - (a.id ?? 0)),
    [quotations, quote],
  );
  const approved = !!quote && QUOTE_DONE.has(quote.status);
  const converted = quote?.status === "CONVERTED";
  // Locked = the customer approved it (or the older flow approved the sheet before quoting).
  const locked = boq?.status === "APPROVED";
  const editable = canPrice && !locked;
  const inQuote = (boq?.items || []).filter((i) => i.isActive !== false);

  // ---------------- Actions ----------------

  /** One click: creates the measurement (if needed) and the sheet — no completion gate. */
  const startPricing = async () => {
    setBusy("start");
    try {
      const res = await quoteWorkspaceApi.startPricing(leadId);
      toast.success(res.boqCreated ? "Quote sheet ready — add rooms and items below" : "Quote sheet opened");
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not open the quote sheet."));
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
      toast.error(errMsg(e, "Could not update the price."));
    }
  };

  /**
   * The quotation for print: an approved or converted one as it is; otherwise made (first time)
   * or refreshed from the sheet by the server.
   */
  const currentQuotation = async (): Promise<Quotation> => {
    if (approved && quote?.id) return quotationApi.get(quote.id);
    const q = await quoteWorkspaceApi.liveQuote(boq!.id as number);
    if (!quote) load();
    return q;
  };

  const openPrint = async () => {
    setBusy("print");
    try { setPrintId((await currentQuotation()).id as number); } catch (e) { toast.error(errMsg(e, "Could not prepare the quotation.")); } finally { setBusy(null); }
  };

  const confirmApproval = async () => {
    if (!boq?.id) return;
    setBusy("approve");
    try {
      const q = await quoteWorkspaceApi.customerApproval(boq.id);
      toast.success(`Customer approved ${q.quotationNumber} — ${inr(q.grandTotal)}`);
      setApproveOpen(false);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the customer approval."));
    } finally { setBusy(null); }
  };

  // Field staff without approval rights hand the quote to the office (it stays live until approved).
  const sentToOffice = !!quote && !approved && quote.internalApprovalStatus === "PENDING" && !!quote.approvedBy;
  const sendToOffice = async () => {
    if (!boq?.id) return;
    setBusy("send");
    try {
      const q = await quoteWorkspaceApi.liveQuote(boq.id);
      await quotationApi.updateApprovalStatus(q.id as number, "PENDING");
      toast.success(`${q.quotationNumber} sent to the office for approval`);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not send the quote."));
    } finally { setBusy(null); }
  };

  const confirmChange = async () => {
    if (!boq?.id) return;
    setBusy("change");
    try {
      await quoteWorkspaceApi.reopen(boq.id);
      toast.success("Sheet opened for changes — the next quotation gets a new number");
      setChangeOpen(false);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not open the sheet for changes."));
    } finally { setBusy(null); }
  };

  const doConvert = async () => {
    if (!convertCfg || !quote?.id) return;
    setBusy("convert");
    try {
      await quotationApi.convertToProject(quote.id, undefined, {
        advanceAmount: convertCfg.advanceAmount || undefined,
        advancePaymentMethod: convertCfg.advanceMethod,
      });
      toast.success("Project created");
      setConvertCfg(null);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not create the project."));
    } finally { setBusy(null); }
  };

  if (loading) return <ListSkeleton rows={5} />;

  // ---------------- Render ----------------

  return (
    <section className="rounded-xl border bg-card">
      {/* ---- One header line: what this quote is and where it stands ---- */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b text-xs text-muted-foreground">
        <span className="flex flex-wrap items-center gap-2 min-w-0">
          <QuoteStatus quote={quote} locked={locked} />
          <span className="flex items-center gap-1.5">
            <Ruler className="h-3.5 w-3.5 shrink-0" />
            {measurement ? (
              <span className="truncate">
                {measurement.measurementNumber || `Measurement #${measurement.id}`}
                {measurement.totalArea ? ` · ${measurement.totalArea} sq.ft` : ""}
              </span>
            ) : <span>No measurement yet</span>}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {measurement && !fieldMode && leadId && (
            // Drawings & photos live in this lead's Documents tab.
            <Link to={`/leads/${leadId}?tab=documents`}
              className="hover:text-primary flex items-center gap-1">
              <FileText className="h-3 w-3" /> Drawings & photos
            </Link>
          )}
          {history.length > 0 && <HistoryMenu quotes={history} onOpen={(id) => setPrintId(id)} />}
        </span>
      </header>

      <div className="p-3 sm:p-4 space-y-4">
        {!boq ? (
          // ---- Nothing yet: visit/measure, then one click opens the sheet ----
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">Start the quote</p>
                <p className="text-xs text-muted-foreground">
                  One sheet for rooms, sizes, items, prices and the customer's choices — measure and price as you go.
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
        ) : (
          <>
            {/* ---- Approved / locked banner ---- */}
            {locked && (
              <div className={`rounded-lg border p-3 text-sm flex flex-wrap items-center justify-between gap-2 ${approved
                ? "border-green-300 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                <span className="flex items-center gap-2">
                  {approved ? <CheckCircle2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {converted
                    ? <>Project created from {quote?.quotationNumber}.</>
                    : approved
                      ? <>Customer approved {quote?.quotationNumber} · {inr(quote?.grandTotal)}{quote?.approvedDate ? ` on ${formatDate(quote.approvedDate)}` : ""}.</>
                      : <>Prices on this sheet are locked.</>}
                </span>
                {!converted && canPrice && (
                  <Button size="sm" variant="outline" className="bg-background" onClick={() => setChangeOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Make changes (new quotation)
                  </Button>
                )}
                {converted && quote?.project?.id && (
                  <Link to={`/projects/${quote.project.id}`}><Button size="sm" variant="outline" className="bg-background">Open project</Button></Link>
                )}
              </div>
            )}

            <BoqSheet boq={boq} canEdit={editable} onBoqChanged={setBoq} />
            <TotalsPanel boq={boq} editable={editable} onSave={saveTotals} />

            {/* ---- One action bar ---- */}
            <div className="sticky bottom-0 z-10 -mx-3 sm:-mx-4 -mb-3 sm:-mb-4 rounded-b-xl border-t bg-card/95 backdrop-blur px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="text-muted-foreground">{inQuote.length} item{inQuote.length === 1 ? "" : "s"} · </span>
                <span className="font-bold tabular-nums text-primary">{inr(boq.grandTotal)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={!!busy || inQuote.length === 0} onClick={openPrint}>
                  {busy === "print" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />} Print
                </Button>
                {fieldMode && !approved && (
                  <Button variant="outline" size="sm" disabled={!!busy || inQuote.length === 0 || sentToOffice} onClick={sendToOffice}>
                    {busy === "send" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {sentToOffice ? "Sent to office" : "Send to office"}
                  </Button>
                )}
                {fieldMode && !converted && onCreateProject && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || inQuote.length === 0}
                    onClick={onCreateProject}>
                    <FileOutput className="h-4 w-4 mr-2" /> {approved ? "Create Project" : "Customer agreed · Create Project"}
                  </Button>
                )}
                {!fieldMode && !approved && canApprove && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || inQuote.length === 0}
                    onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Customer approved
                  </Button>
                )}
                {!fieldMode && approved && !converted && canConvert && (
                  <Button size="sm" disabled={!!busy} onClick={() => setConvertCfg({ advanceAmount: "", advanceMethod: "Cash" })}>
                    <FileOutput className="h-4 w-4 mr-2" /> Create Project
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- Customer approval ---- */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Customer approved this quote?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p><span className="font-semibold">{inQuote.length}</span> ticked item(s) · final price <span className="font-semibold">{inr(boq?.grandTotal)}</span></p>
            {inQuote.length < (boq?.items?.length ?? 0) && (
              <p className="text-muted-foreground">{(boq?.items?.length ?? 0) - inQuote.length} unticked item(s) are left out.</p>
            )}
            <p className="text-muted-foreground">The sheet locks and you can create the project. Changes after this make a new quotation.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy === "approve"} onClick={confirmApproval}>
              {busy === "approve" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Change after approval ---- */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Make changes?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {approved
              ? `${quote?.quotationNumber} was approved by the customer. Changing it opens the sheet again and the next quotation gets a new number; ${quote?.quotationNumber} is kept as history (Revised).`
              : "These prices are locked. Changing them opens the sheet again and the next quotation gets a new number."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeOpen(false)}>Cancel</Button>
            <Button disabled={busy === "change"} onClick={confirmChange}>
              {busy === "change" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Make changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Create project + advance ---- */}
      <Dialog open={!!convertCfg} onOpenChange={(o) => !o && setConvertCfg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A project is created from the approved quote. If the customer paid an advance, record it now.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Advance received (₹) — optional</label>
              <BaseInput inputMode="numeric" value={convertCfg?.advanceAmount ?? ""}
                onChange={(e) => setConvertCfg((c) => c && { ...c, advanceAmount: e.target.value })}
                placeholder="0" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Payment method</label>
              <select value={convertCfg?.advanceMethod ?? "Cash"}
                onChange={(e) => setConvertCfg((c) => c && { ...c, advanceMethod: e.target.value })}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm">
                {["Cash", "Bank Transfer", "UPI", "Cheque", "Card"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setConvertCfg(null)} disabled={busy === "convert"}>Cancel</Button>
              <Button onClick={doConvert} disabled={busy === "convert"} className="bg-green-600 hover:bg-green-700 text-white">
                {busy === "convert" ? "Creating…" : convertCfg?.advanceAmount ? `Create Project + Record ₹${convertCfg.advanceAmount}` : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {printId && <QuotationPrintView quotationId={printId} readOnly onClose={() => setPrintId(null)} />}
    </section>
  );
}

/** "Not sent yet" / "QT-… · Draft" / "Approved" / "Project created" — one chip in the header. */
function QuoteStatus({ quote, locked }: { quote?: any; locked: boolean }) {
  if (!quote) {
    return <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">{locked ? "Locked" : "Quote not shared yet"}</span>;
  }
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${QUOTATION_STATUS_STYLES[quote.status] || "bg-muted text-muted-foreground"}`}>
      {quote.quotationNumber} · {QUOTATION_STATUS_LABELS[quote.status] || quote.status}
    </span>
  );
}

/** Earlier quotations of this lead — opened read-only (print view), nothing to edit there. */
function HistoryMenu({ quotes, onOpen }: { quotes: any[]; onOpen: (id: number) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1 hover:text-primary">
          <History className="h-3 w-3" /> History ({quotes.length})
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {quotes.map((q) => (
          <DropdownMenuItem key={q.id} onClick={() => onOpen(q.id)} className="flex items-center justify-between gap-2">
            <span className="truncate">
              {q.quotationNumber}
              <span className="ml-1.5 text-[11px] text-muted-foreground">{QUOTATION_STATUS_LABELS[q.status] || q.status}</span>
            </span>
            <span className="tabular-nums text-xs">{inr(q.grandTotal ?? q.totalAmount)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TotalsPatch = {
  discountType?: "PERCENT" | "FLAT"; discount?: number | null; taxPercent?: number | null;
  materialTotalOverride?: number | null; labourTotalOverride?: number | null;
};

/**
 * The price cards under the item sheet. Discount, GST and the final price are all editable here —
 * typing a final price works the discount out for you — and all of it carries into the quotation
 * when it's generated.
 */
function TotalsPanel({ boq, editable, onSave }: { boq: Boq; editable: boolean; onSave: (patch: TotalsPatch) => void }) {
  const flat = boq.discountType === "FLAT";
  const subtotal = Number(boq.subtotal ?? 0);
  const gstPct = Number(boq.taxPercent ?? 0);
  const active = (boq.items || []).filter((i) => i.isActive !== false);
  const itemsMaterial = active.reduce((s, i) => s + Number(i.materialTotal ?? 0), 0);
  const itemsLabour = active.reduce((s, i) => s + Number(i.labourTotal ?? 0), 0);
  const manual = boq.materialTotalOverride != null || boq.labourTotalOverride != null;
  const f = editable ? "h-9 !border-border !bg-background" : "h-9";

  /** Final price → flat discount that lands on it (final = (subtotal − discount) × (1 + GST%)). */
  const setFinal = (target: number | null) => {
    if (target == null) return;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // Same maths as the server (GST rounded to paise), so try the neighbouring paise and keep the
    // discount that lands exactly on the typed price.
    const grandFor = (d: number) => r2(subtotal - d + r2((subtotal - d) * gstPct / 100));
    const guess = r2(subtotal - target / (1 + gstPct / 100));
    const discount = [guess, r2(guess - 0.01), r2(guess + 0.01), r2(guess - 0.02), r2(guess + 0.02)]
      .reduce((best, d) => (Math.abs(grandFor(d) - target) < Math.abs(grandFor(best) - target) ? d : best), guess);
    if (discount < 0) {
      toast.error(`That's above the item total (${inr(subtotal * (1 + gstPct / 100))}) — raise item amounts instead.`);
      return;
    }
    onSave({ discountType: "FLAT", discount });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Cost card */}
      <div className="rounded-xl border p-4 space-y-2 text-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items total</h4>
        <Row label="Material" value={inr(boq.materialTotal)} />
        <Row label="Labour" value={inr(boq.labourTotal)} />
        <div className="flex items-center justify-between border-t pt-2">
          <span className="font-medium">Subtotal</span>
          <span className="text-lg font-bold tabular-nums">{inr(subtotal)}</span>
        </div>
        {manual && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 space-y-1.5">
            <p>
              A manual total is set, so this subtotal doesn't match the items
              (items add up to <span className="font-semibold">{inr(itemsMaterial + itemsLabour)}</span>).
            </p>
            {editable && (
              <Button size="sm" variant="outline" className="h-7 bg-background"
                onClick={() => onSave({ materialTotalOverride: null, labourTotalOverride: null })}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Use the item totals
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Customer price card */}
      <div className="rounded-xl border border-primary/30 bg-primary/[0.02] p-4 space-y-3 text-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer price</h4>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <label className="text-muted-foreground">Discount</label>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-md border bg-background p-0.5 text-xs">
              {(["PERCENT", "FLAT"] as const).map((m) => (
                <button key={m} type="button" disabled={!editable}
                  onClick={() => (m === "FLAT") !== flat && onSave({ discountType: m, discount: 0 })}
                  className={`px-2 py-1 rounded ${(m === "FLAT") === flat ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {m === "PERCENT" ? "%" : "₹"}
                </button>
              ))}
            </div>
            <div className="w-24"><NumCell value={boq.discount ?? 0} disabled={!editable} className={f} onCommit={(v) => onSave({ discount: v ?? 0 })} /></div>
          </div>
          <span className="col-span-2 -mt-1 text-right text-xs text-muted-foreground tabular-nums">− {inr(boq.discountAmount)}</span>

          <label className="text-muted-foreground">GST %</label>
          <div className="w-24 justify-self-end"><NumCell value={boq.taxPercent ?? 0} disabled={!editable} className={f} onCommit={(v) => onSave({ taxPercent: v ?? 0 })} /></div>
          <span className="col-span-2 -mt-1 text-right text-xs text-muted-foreground tabular-nums">+ {inr(boq.taxAmount)}</span>
        </div>

        <div className="border-t pt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Final price{editable && <span className="font-normal opacity-70"> · type a price — the discount is worked out</span>}
          </label>
          <NumCell value={boq.grandTotal} disabled={!editable}
            className={`h-11 text-xl font-bold text-primary ${editable ? "!border-primary/40 !bg-background" : ""}`}
            onCommit={setFinal} />
        </div>
        <p className="text-[11px] text-muted-foreground">Discount and GST carry into the quotation.</p>
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
