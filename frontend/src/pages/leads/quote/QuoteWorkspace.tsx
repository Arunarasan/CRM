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
import { boqApi, quoteWorkspaceApi, type ProjectChangeResult, type ProjectQuoteStatus } from "@/api/boqApi";
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
 * Inside a project (projectId) it is a change order instead: "Make changes" unlocks the project's
 * own sheet and "Customer approved change" updates that same project — never a new one.
 * Measurement, BOQ and Quotation stay separate records underneath — this only removes the re-entry.
 */

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || (typeof e?.response?.data === "string" ? e.response.data : "") || fallback;
const QUOTE_DONE = new Set(["APPROVED", "CONVERTED"]);

export default function QuoteWorkspace({ leadId, projectId, onChanged, fieldMode, onCreateProject }: {
  leadId: string;
  /** Opened from the project: changes update this project (change order), no Create Project. */
  projectId?: number;
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
  // Changing a running project's quote: admins and project managers only.
  const canChangeProject = isAdmin || hasAuthority("ROLE_PROJECT_MANAGER");
  const projectMode = projectId != null;

  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [boq, setBoq] = useState<Boq | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [printId, setPrintId] = useState<number | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [convertCfg, setConvertCfg] = useState<{ advanceAmount: string; advanceMethod: string } | null>(null);
  const [projectQuote, setProjectQuote] = useState<ProjectQuoteStatus | null>(null);
  const [changeResult, setChangeResult] = useState<ProjectChangeResult | null>(null);

  const load = useCallback(async () => {
    const [m, b, q, pq] = await Promise.all([
      leadApi.getMeasurements(leadId).catch(() => ({ data: [] })),
      leadApi.getBoqs(leadId).catch(() => ({ data: [] })),
      leadApi.getQuotations(leadId).catch(() => ({ data: [] })),
      // One retry: a read can lose a lock race with a just-finished change on a busy database.
      projectId != null
        ? quoteWorkspaceApi.projectStatus(projectId).catch(() => quoteWorkspaceApi.projectStatus(projectId)).catch(() => null)
        : Promise.resolve(null),
    ]);
    setMeasurements(m.data || []);
    const list: Boq[] = b.data || [];
    setQuotations(q.data || []);
    setProjectQuote(pq);
    // In a project: the sheet the project was built from. Otherwise the latest revision — older ones are history.
    const current = (pq?.boqId ? list.find((x) => x.id === pq.boqId) : undefined)
      ?? [...list].filter((x) => x.isLatestVersion !== false).sort((x, y) => (y.id ?? 0) - (x.id ?? 0))[0]
      ?? [...list].sort((x, y) => (y.id ?? 0) - (x.id ?? 0))[0];
    const id = pq?.boqId ?? current?.id;
    setBoq(id ? await boqApi.get(id).catch(() => current ?? null) : null);
  }, [leadId, projectId]);

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
  // The project this sheet already built (seen from the lead page): changes are made there, not here.
  const sheetProject = useMemo(
    () => (!projectMode && boq ? quotations.find((q) => (q.boq?.id ?? q.boqId) === boq.id && q.project?.id)?.project : undefined),
    [projectMode, quotations, boq],
  );
  const approved = !!quote && QUOTE_DONE.has(quote.status);
  const converted = quote?.status === "CONVERTED";
  // Locked = the customer approved it (or the older flow approved the sheet before quoting).
  const locked = boq?.status === "APPROVED";
  // A change to the running project is open (sheet unlocked, customer hasn't approved it yet).
  const changeInProgress = projectMode && !!projectQuote?.changeOpen;
  const editable = canPrice && !locked && !sheetProject && (!projectMode || canChangeProject);
  const inQuote = (boq?.items || []).filter((i) => i.isActive !== false);

  // ---------------- Actions ----------------

  /** One click: creates the measurement (if needed) and the sheet — no completion gate. */
  const startPricing = async () => {
    setBusy("start");
    try {
      const res = await quoteWorkspaceApi.startPricing(leadId);
      toast.success(res.boqCreated ? "Quote sheet ready — add a category and its products below" : "Quote sheet opened");
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
    if (approved && quote?.id && !changeInProgress) return quotationApi.get(quote.id);
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
      if (projectMode) {
        await quoteWorkspaceApi.startProjectChange(projectId!);
        toast.success("Sheet open for the customer's changes — the project updates when they approve");
        setChangeOpen(false);
        await refreshAll();
        return;
      }
      await quoteWorkspaceApi.reopen(boq.id);
      toast.success("Sheet opened for changes — the next quotation gets a new number");
      setChangeOpen(false);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not open the sheet for changes."));
    } finally { setBusy(null); }
  };

  /** Customer approved the change → the same project follows the new quote. */
  const confirmProjectChange = async () => {
    setBusy("approve");
    try {
      const res = await quoteWorkspaceApi.approveProjectChange(projectId!);
      setApproveOpen(false);
      if (res.unchanged) toast.success(`Nothing was changed — the project stays on ${projectQuote?.quotationNumber}`);
      else setChangeResult(res);
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not apply the change to the project."));
    } finally { setBusy(null); }
  };

  /** Close an open change with no edits — the sheet locks again on the project's quote. */
  const discardProjectChange = async () => {
    setBusy("discard");
    try {
      await quoteWorkspaceApi.discardProjectChange(projectId!);
      toast.success("Change closed — nothing was changed");
      await refreshAll();
    } catch (e) {
      toast.error(errMsg(e, "Could not close the change."));
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
                  One sheet for categories, products, colours, prices and the customer's choices — price as you go.
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
            {/* ---- Seen from the lead: the project owns this sheet now ---- */}
            {sheetProject && (
              <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Project {sheetProject.projectCode || ""} runs on this quote. Customer changes are made from the project, so the same project is updated.
                </span>
                {!fieldMode && (
                  <Link to={`/projects/${sheetProject.id}?tab=quote`}>
                    <Button size="sm" variant="outline" className="bg-background">Open project's quote</Button>
                  </Link>
                )}
              </div>
            )}

            {/* ---- In a project: its quote, or the change in progress ---- */}
            {projectMode && (locked ? (
              <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  This project runs on {projectQuote?.quotationNumber || quote?.quotationNumber} · {inr(projectQuote?.contractValue ?? quote?.grandTotal)}.
                </span>
                {canPrice && canChangeProject && projectQuote?.canChange && (
                  <Button size="sm" variant="outline" className="bg-background" onClick={() => setChangeOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Make changes
                  </Button>
                )}
              </div>
            ) : changeInProgress && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex flex-wrap sm:flex-nowrap items-start gap-2">
                <Pencil className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="flex-1">
                  <span className="font-semibold">Change in progress — not yet approved by the customer.</span>{" "}
                  The project keeps running on {projectQuote?.quotationNumber} ({inr(projectQuote?.contractValue)}) until you press
                  "Customer approved change". Work already started on site can't be removed — change its quantity instead.
                </span>
                {canChangeProject && (
                  <Button size="sm" variant="outline" className="bg-background shrink-0" disabled={!!busy} onClick={discardProjectChange}
                    aria-label="Discard change" title="Closes the change — only when nothing was edited">
                    {busy === "discard" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Discard
                  </Button>
                )}
              </div>
            ))}

            {/* ---- Approved / locked banner ---- */}
            {locked && !projectMode && !sheetProject && (
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
                {fieldMode && !approved && !sheetProject && (
                  <Button variant="outline" size="sm" disabled={!!busy || inQuote.length === 0 || sentToOffice} onClick={sendToOffice}>
                    {busy === "send" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {sentToOffice ? "Sent to office" : "Send to office"}
                  </Button>
                )}
                {fieldMode && !converted && !sheetProject && onCreateProject && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || inQuote.length === 0}
                    onClick={onCreateProject}>
                    <FileOutput className="h-4 w-4 mr-2" /> {approved ? "Create Project" : "Customer agreed · Create Project"}
                  </Button>
                )}
                {projectMode && changeInProgress && canChangeProject && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || inQuote.length === 0}
                    onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Customer approved change
                  </Button>
                )}
                {!projectMode && !sheetProject && !fieldMode && !approved && canApprove && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy || inQuote.length === 0}
                    onClick={() => setApproveOpen(true)}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Customer approved
                  </Button>
                )}
                {!projectMode && !sheetProject && !fieldMode && approved && !converted && canConvert && (
                  <Button size="sm" disabled={!!busy} onClick={() => setConvertCfg({ advanceAmount: "", advanceMethod: "Cash" })}>
                    <FileOutput className="h-4 w-4 mr-2" /> Create Project
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- Customer approved the change (project) ---- */}
      <Dialog open={approveOpen && projectMode} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Customer approved the change?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <Row label={`Now (${projectQuote?.quotationNumber ?? "current quote"})`} value={inr(projectQuote?.contractValue)} />
            <Row label="After the change" value={inr(boq?.grandTotal)} strong />
            <Row label="Difference" strong value={(() => {
              const d = Number(boq?.grandTotal ?? 0) - Number(projectQuote?.contractValue ?? 0);
              return `${d >= 0 ? "+" : "−"} ${inr(Math.abs(d))}`;
            })()} />
            <p className="text-muted-foreground pt-1">
              The change gets a new quotation number and this same project is updated: its work items, checklist,
              supply list, budget and unbilled payment milestones follow the new quote. Invoices already raised stay as they are.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy === "approve"} onClick={confirmProjectChange}>
              {busy === "approve" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update the project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- What the change did ---- */}
      <Dialog open={!!changeResult} onOpenChange={(o) => !o && setChangeResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Project updated</DialogTitle></DialogHeader>
          {changeResult && (
            <div className="text-sm space-y-2">
              <p>{changeResult.oldQuotationNumber} → <span className="font-semibold">{changeResult.newQuotationNumber}</span></p>
              <Row label="Contract value" value={`${inr(changeResult.oldTotal)} → ${inr(changeResult.newTotal)}`} strong />
              <Row label="Items" value={`${changeResult.itemsAdded} added · ${changeResult.itemsRemoved} removed · ${changeResult.itemsChanged} changed`} />
              {changeResult.milestonesRescaled > 0 && <Row label="Payment milestones re-worked" value={String(changeResult.milestonesRescaled)} />}
              {changeResult.supplyFlagged > 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  {changeResult.supplyFlagged} material(s) were removed from the quote but already bought — see Supply & Install.
                </p>
              )}
              {changeResult.excessPaid > 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  The customer has paid {inr(changeResult.collected)} — {inr(changeResult.excessPaid)} more than the new total.
                  Refund or adjust it from Payments.
                </p>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={() => setChangeResult(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Customer approval ---- */}
      <Dialog open={approveOpen && !projectMode} onOpenChange={setApproveOpen}>
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
            {projectMode
              ? `The sheet opens for the customer's changes. The project keeps running on ${projectQuote?.quotationNumber ?? "its current quote"} until the customer approves; then this same project is updated and the change gets a new quotation number.`
              : approved
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
  labourCharge?: number | null; labourNote?: string | null;
  shippingCharge?: number | null; shippingNote?: string | null;
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
  const lineDiscounts = Number(boq.lineDiscountTotal ?? 0);
  // Labour and shipping are added after the discount (never discounted) and before GST.
  const charges = Number(boq.labourCharge ?? 0) + Number(boq.shippingCharge ?? 0);
  const f = editable ? "h-9 !border-border !bg-background" : "h-9";

  /** Final price → flat discount that lands on it (final = (subtotal − discount + charges) × (1 + GST%)). */
  const setFinal = (target: number | null) => {
    if (target == null) return;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // Same maths as the server (GST rounded to paise), so try the neighbouring paise and keep the
    // discount that lands exactly on the typed price.
    const grandFor = (d: number) => r2(subtotal - d + charges + r2((subtotal - d + charges) * gstPct / 100));
    const guess = r2(subtotal + charges - target / (1 + gstPct / 100));
    const discount = [guess, r2(guess - 0.01), r2(guess + 0.01), r2(guess - 0.02), r2(guess + 0.02)]
      .reduce((best, d) => (Math.abs(grandFor(d) - target) < Math.abs(grandFor(best) - target) ? d : best), guess);
    if (discount < 0) {
      toast.error(`That's above the full price (${inr((subtotal + charges) * (1 + gstPct / 100))}) — raise item amounts instead.`);
      return;
    }
    onSave({ discountType: "FLAT", discount });
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* Cost card */}
      <div className="rounded-xl border p-4 space-y-2 text-sm">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items total</h4>
        <Row label="Products" value={inr(subtotal + lineDiscounts)} />
        {lineDiscounts > 0 && <Row label="Line discounts" value={`− ${inr(lineDiscounts)}`} />}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="font-medium">Products total</span>
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

          <ChargeRow label="Labour" amount={boq.labourCharge} note={boq.labourNote} notePlaceholder="e.g. Installation, 2 days"
            editable={editable} f={f} onSave={(amount, note) => onSave({ labourCharge: amount, labourNote: note })} />
          <ChargeRow label="Shipping" amount={boq.shippingCharge} note={boq.shippingNote} notePlaceholder="e.g. Transport to site"
            editable={editable} f={f} onSave={(amount, note) => onSave({ shippingCharge: amount, shippingNote: note })} />

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
        <p className="text-[11px] text-muted-foreground">Discount applies to products only. Labour and shipping are added after it; GST is on everything.</p>
      </div>
    </div>
  );
}

/** Labour / shipping: an amount added after the discount, with an optional note for the customer. */
function ChargeRow({ label, amount, note, notePlaceholder, editable, f, onSave }: {
  label: string; amount?: number | null; note?: string | null; notePlaceholder: string;
  editable: boolean; f: string; onSave: (amount: number | null, note: string | null) => void;
}) {
  const [draft, setDraft] = useState(note ?? "");
  useEffect(() => setDraft(note ?? ""), [note]);
  const has = Number(amount ?? 0) > 0;
  return (
    <>
      <label className="text-muted-foreground">{label} ₹</label>
      <div className="w-24 justify-self-end">
        <NumCell value={has ? amount : null} placeholder="0" disabled={!editable} className={f}
          onCommit={(v) => onSave(v && v > 0 ? v : null, v && v > 0 ? note ?? null : null)} />
      </div>
      {(has || (editable && draft)) && (
        editable ? (
          <input value={draft} placeholder={notePlaceholder} aria-label={`${label} note`}
            className="col-span-2 -mt-1 h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-xs text-muted-foreground outline-none hover:border-border focus:border-primary focus:bg-background"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft.trim() !== (note ?? "") && onSave(amount ?? null, draft.trim() || null)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
        ) : note ? <span className="col-span-2 -mt-1 text-right text-xs text-muted-foreground">{note}</span> : null
      )}
    </>
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
