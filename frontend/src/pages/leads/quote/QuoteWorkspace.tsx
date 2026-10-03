import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgePercent, Building2, CalendarDays, Calculator, CheckCircle2, ChevronDown, Eye, FileOutput,
  FileText, History, Image as ImageIcon, Info, Layers, Loader2, Lock, Pencil, RotateCcw,
  Save, Send, Share2, Users, Wand2,
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
  // Items (what the customer sees) vs Cost Breakdown (material / labour behind each price).
  const [view, setView] = useState<"items" | "cost" | "photos" | "history">(() => {
    try { return localStorage.getItem("quoteShowBreakdown") === "1" ? "cost" : "items"; } catch { return "items"; }
  });
  useEffect(() => {
    if (view !== "items" && view !== "cost") return;
    try { localStorage.setItem("quoteShowBreakdown", view === "cost" ? "1" : "0"); } catch { /* ignore */ }
  }, [view]);
  // Autosave state reported by the sheet, shown in the header.
  const [saveState, setSaveState] = useState<{ pending: number; lastSaved: number | null }>({ pending: 0, lastSaved: null });
  // Tab-bar slot the sheet renders "Add from Inventory" / "Add Item" into.
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);

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
  const customerName: string = boq?.customer?.name || measurement?.customer?.name || measurement?.customerName || "—";
  const customerId: string = measurement?.customerCode || (boq?.customer?.id ? `#${boq.customer.id}` : "—");

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

  /** Share a short summary (number, customer, total) — phone share sheet, or WhatsApp on desktop. */
  const shareQuote = async () => {
    setBusy("share");
    try {
      const q = await currentQuotation();
      const who = customerName !== "—" ? ` for ${customerName}` : "";
      const text = `Quotation ${q.quotationNumber}${who}: ${inQuote.length} item${inQuote.length === 1 ? "" : "s"}, total ${inr(q.grandTotal ?? boq?.grandTotal)}.`;
      if (navigator.share) await navigator.share({ title: `Quotation ${q.quotationNumber}`, text });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(errMsg(e, "Could not share the quotation."));
    } finally { setBusy(null); }
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

  const GREEN = "bg-[#1F5C3F] hover:bg-[#184A33] text-white";
  const noItems = inQuote.length === 0;
  /** The one next step for this quote (approve, approve change, create project). */
  const primary: null | { label: string; icon: typeof CheckCircle2; onClick: () => void; disabled: boolean } =
    projectMode && changeInProgress && canChangeProject
      ? { label: "Customer Approved Change", icon: CheckCircle2, onClick: () => setApproveOpen(true), disabled: !!busy || noItems }
      : !projectMode && !sheetProject && !fieldMode && !approved && canApprove
        ? { label: "Customer Approved", icon: CheckCircle2, onClick: () => setApproveOpen(true), disabled: !!busy || noItems }
        : !projectMode && !sheetProject && !fieldMode && approved && !converted && canConvert
          ? { label: "Create Project", icon: FileOutput, onClick: () => setConvertCfg({ advanceAmount: "", advanceMethod: "Cash" }), disabled: !!busy }
          : fieldMode && !converted && !sheetProject && onCreateProject
            ? { label: approved ? "Create Project" : "Customer Agreed · Create Project", icon: FileOutput, onClick: onCreateProject, disabled: !!busy || noItems }
            : null;
  /** Less common steps, under the primary button's ▾. */
  const secondary: { label: string; icon: typeof CheckCircle2; onClick: () => void; disabled?: boolean }[] = [
    ...(fieldMode && !approved && !sheetProject
      ? [{ label: sentToOffice ? "Sent to office" : "Send to office", icon: Send, onClick: sendToOffice, disabled: !!busy || noItems || sentToOffice }]
      : []),
    ...(locked && canPrice && !converted && !sheetProject && (!projectMode || (canChangeProject && projectQuote?.canChange))
      ? [{ label: "Make changes", icon: Pencil, onClick: () => setChangeOpen(true) }]
      : []),
    ...(projectMode && changeInProgress && canChangeProject
      ? [{ label: "Discard change", icon: RotateCcw, onClick: discardProjectChange, disabled: !!busy }]
      : []),
  ];
  const saveDraft = () => {
    if (saveState.pending > 0) toast.info("Saving your last changes…");
    else toast.success("Draft saved — every change on this sheet is saved as you type.");
  };
  const renderPrimary = (withMenu?: boolean) => {
    if (!primary && !(withMenu && secondary.length)) return null;
    return (
      <div className="inline-flex">
        {primary && (
          <Button size="sm" className={`h-9 ${GREEN} ${withMenu && secondary.length ? "rounded-r-none" : ""}`}
            disabled={primary.disabled} onClick={primary.onClick}>
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <primary.icon className="h-4 w-4" />} {primary.label}
          </Button>
        )}
        {withMenu && secondary.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" aria-label="More approval actions"
                className={`h-9 px-2 ${GREEN} ${primary ? "rounded-l-none border-l border-white/20" : ""}`}>
                {!primary && <span className="mr-1">Actions</span>}<ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {secondary.map((a) => (
                <DropdownMenuItem key={a.label} disabled={a.disabled} onClick={a.onClick}><a.icon className="h-4 w-4 mr-2" /> {a.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  // ---------------- Render ----------------

  return (
    <section className="quote-layout quote-neutral space-y-3">
      {/* ---- Quotation information ---- */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 rounded-xl border bg-card shadow-sm">
        <InfoTile icon={Users} label="Customer" value={customerName} sub={customerId !== "—" ? customerId : undefined} />
        <InfoTile icon={Building2} label="Site / Project"
          value={measurement?.siteAddress || measurement?.measurementNumber || (measurement ? `Measurement #${measurement.id}` : "No measurement yet")}
          sub={[measurement?.siteAddress ? measurement.measurementNumber : "", measurement?.totalArea ? `${measurement.totalArea} sq.ft` : ""].filter(Boolean).join(" · ") || undefined} />
        <InfoTile icon={CalendarDays} label="Date" value={formatDate(quote?.quotationDate || quote?.createdAt || boq?.createdAt) || "—"} />
        <InfoTile icon={FileText} label="Quote Total" value={inr(boq?.grandTotal)} tone="amber" strong />
      </dl>

      <div className="space-y-4">
        {!boq ? (
          // ---- Nothing yet: visit/measure, then one click opens the sheet ----
          <div className="rounded-lg border border-dashed bg-card p-5 flex flex-wrap items-center justify-between gap-3">
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
                ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#14532D]" : "border-[#FDE68A] bg-[#FFFBEB] text-[#78350F]"}`}>
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

            <div className="quote-grid grid gap-4">
              {/* ---- Left: the sheet ---- */}
              <div className="min-w-0 rounded-xl border bg-card shadow-sm">
                <div className="flex flex-wrap items-center gap-x-2 border-b px-2">
                <div role="tablist" aria-label="Quote view" className="flex items-center overflow-x-auto overflow-y-hidden">
                  <ViewTab active={view === "items"} icon={Layers} onClick={() => setView("items")}>Items</ViewTab>
                  <ViewTab active={view === "cost"} icon={Calculator} onClick={() => setView("cost")}>Cost Breakdown</ViewTab>
                  <ViewTab active={view === "photos"} icon={ImageIcon} onClick={() => setView("photos")}>Photos & Drawings</ViewTab>
                  <ViewTab active={view === "history"} icon={History} onClick={() => setView("history")}>
                    History{history.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{history.length}</span>}
                  </ViewTab>
                </div>
                {(view === "items" || view === "cost") && <div ref={setActionsEl} className="ml-auto py-1.5" />}
                </div>

                <div className="p-3">
                  {(view === "items" || view === "cost") && (
                    <BoqSheet boq={boq} canEdit={editable} onBoqChanged={setBoq} showBreakdown={view === "cost"}
                      actionsTarget={actionsEl}
                      onSaveState={(pending, lastSaved) => setSaveState({ pending, lastSaved })} />
                  )}
                  {view === "photos" && (
                    <PhotosPanel measurement={measurement} leadId={leadId} fieldMode={fieldMode} />
                  )}
                  {view === "history" && <HistoryPanel quotes={history} onOpen={(id) => setPrintId(id)} />}
                </div>

                {/* ---- Action bar ---- */}
                <div className="sticky bottom-16 md:bottom-0 z-10 rounded-b-xl border-t bg-card/95 backdrop-blur px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{inQuote.length} item{inQuote.length === 1 ? "" : "s"}<span className="hidden sm:inline"> in quote</span> · </span>
                    <span className="font-bold tabular-nums">{inr(boq.grandTotal)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9" disabled={!!busy || noItems} onClick={openPrint} aria-label="Preview"
                      title="See the quotation as the customer will — print or save as PDF from there">
                      {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}<span className="hidden sm:inline">Preview</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-9" disabled={!!busy || noItems} onClick={shareQuote} aria-label="Share quote"
                      title="Send the quote number and total — share sheet on phones, WhatsApp on desktop">
                      {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}<span className="hidden sm:inline">Share Quote</span>
                    </Button>
                    {editable && (
                      <Button variant="outline" size="sm" className="h-9" onClick={saveDraft} aria-label="Save draft"
                        title="The sheet saves every change as you type — this confirms it">
                        <Save className="h-4 w-4" /><span className="hidden sm:inline">Save Draft</span>
                      </Button>
                    )}
                    {renderPrimary(true)}
                  </div>
                </div>
              </div>

              {/* ---- Right: summary, charges and the final price ---- */}
              <aside className="quote-aside self-start">
                <TotalsPanel boq={boq} editable={editable} onSave={saveTotals} />
              </aside>
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
            <Button className="bg-[#16805C] hover:bg-[#126B4C] text-white" disabled={busy === "approve"} onClick={confirmProjectChange}>
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
            <Button className="bg-[#16805C] hover:bg-[#126B4C] text-white" disabled={busy === "approve"} onClick={confirmApproval}>
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
              <Button onClick={doConvert} disabled={busy === "convert"} className="bg-[#16805C] hover:bg-[#126B4C] text-white">
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
  const f = editable ? "h-9 !border-border !bg-background focus:!border-ring" : "h-9";

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
    <div className="space-y-3 text-sm">
      {/* Quotation summary */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <h4 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><Calculator className="h-4 w-4" /></span>
          Quotation Summary
        </h4>
        <Row label="Products Total" value={inr(subtotal + lineDiscounts)} />
        <Row label="Line Discounts" value={lineDiscounts > 0 ? `– ${inr(lineDiscounts)}` : inr(0)} />
        <div className="flex items-center justify-between rounded-lg bg-[#FFF7ED] px-3 py-3">
          <span className="font-semibold">Products Net Total</span>
          <span className="text-lg font-bold tabular-nums">{inr(subtotal)}</span>
        </div>
        {manual && (
          <div className="rounded-md border border-[#FDE68A] bg-[#FFFBEB] p-2 text-xs text-[#78350F] space-y-1.5">
            <p>
              A manual total is set, so this doesn't match the items
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

      {/* Additional charges → final price */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <h4 className="flex items-center gap-2.5 text-base font-semibold">
          <span className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><BadgePercent className="h-4 w-4" /></span>
          Additional Charges
        </h4>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2.5">
          <label className="text-muted-foreground" title="On products only — labour and shipping are added after it">Discount</label>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-md border bg-background p-0.5 text-xs" role="group" aria-label="Discount type">
              {(["PERCENT", "FLAT"] as const).map((m) => (
                <button key={m} type="button" disabled={!editable} aria-pressed={(m === "FLAT") === flat}
                  onClick={() => (m === "FLAT") !== flat && onSave({ discountType: m, discount: 0 })}
                  className={`px-2 py-1 rounded ${(m === "FLAT") === flat ? "bg-[#1F5C3F] text-white" : "text-muted-foreground"}`}>
                  {m === "PERCENT" ? "%" : "₹"}
                </button>
              ))}
            </div>
            <div className="w-24"><NumCell value={boq.discount ?? 0} disabled={!editable} className={f} onCommit={(v) => onSave({ discount: v ?? 0 })} /></div>
          </div>
          {Number(boq.discountAmount ?? 0) > 0 && (
            <span className="col-span-2 -mt-1.5 text-right text-xs text-muted-foreground tabular-nums">– {inr(boq.discountAmount)}</span>
          )}

          <ChargeRow label="Labour" amount={boq.labourCharge} note={boq.labourNote} notePlaceholder="e.g. Installation, 2 days"
            editable={editable} f={f} onSave={(amount, note) => onSave({ labourCharge: amount, labourNote: note })} />
          <ChargeRow label="Shipping" amount={boq.shippingCharge} note={boq.shippingNote} notePlaceholder="e.g. Transport to site"
            editable={editable} f={f} onSave={(amount, note) => onSave({ shippingCharge: amount, shippingNote: note })} />

          <label className="text-muted-foreground">GST %</label>
          <div className="w-32 justify-self-end"><NumCell value={boq.taxPercent ?? 0} disabled={!editable} className={f} onCommit={(v) => onSave({ taxPercent: v ?? 0 })} /></div>
          <span className="col-span-2 -mt-1.5 text-right text-xs text-muted-foreground tabular-nums">+ {inr(boq.taxAmount)}</span>
        </div>

        <div className="rounded-xl bg-[#ECFDF5] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-base font-bold"
              title="Discount applies to products only. Labour and shipping are added after it; GST is on everything.">
              Final Price <Info className="h-4 w-4 text-muted-foreground" />
            </label>
            <div className="min-w-0 flex-1">
              <NumCell value={boq.grandTotal} disabled={!editable}
                className={`h-11 !text-2xl font-bold text-[#14532D] ${editable ? "!border-transparent hover:!border-[#A7F3D0] !bg-transparent focus:!bg-background focus:!border-ring" : ""}`}
                onCommit={setFinal} />
            </div>
          </div>
          {editable && <p className="mt-1 text-[11px] text-[#166534]/80">Type a final price and the discount is worked out for you.</p>}
        </div>

        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Discount applies</span> to products only.{" "}
          <span className="font-medium text-foreground/80">Labour and shipping</span> are added after it; GST is on everything.
        </p>
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
      <div className="w-32 justify-self-end">
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

/** One card in the information row: tinted icon tile · label · value. */
function InfoTile({ icon: Icon, label, value, sub, strong, tone = "green" }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string; strong?: boolean;
  tone?: "green" | "amber";
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <span className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${tone === "amber" ? "bg-[#FFF7ED] text-[#D97706]" : "bg-[#ECFDF5] text-[#1F5C3F]"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={`truncate ${strong ? "text-lg font-bold tabular-nums" : "text-sm font-semibold"}`} title={value}>{value}</dd>
        {sub && <dd className="truncate text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}

/** Underlined tab — clear when active, quiet otherwise. */
function ViewTab({ active, icon: Icon, onClick, children }: {
  active: boolean; icon: React.ComponentType<{ className?: string }>; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-t ${active
        ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

/** Drawings & photos are kept with the lead — this points there instead of copying them. */
function PhotosPanel({ measurement, leadId, fieldMode }: { measurement?: any; leadId: string; fieldMode?: boolean }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm">
      <ImageIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-medium">Photos & drawings</p>
      <p className="mt-1 text-muted-foreground">
        {measurement
          ? `Site photos and drawings for ${measurement.measurementNumber || "this measurement"} are kept in the lead's Documents.`
          : "No measurement yet — photos and drawings added to the lead show up in its Documents."}
      </p>
      {!fieldMode && (
        <Link to={`/leads/${leadId}?tab=documents`}>
          <Button variant="outline" size="sm" className="mt-3">Open Documents</Button>
        </Link>
      )}
    </div>
  );
}

/** Earlier quotations — opened read-only (print view). */
function HistoryPanel({ quotes, onOpen }: { quotes: any[]; onOpen: (id: number) => void }) {
  if (quotes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        <History className="mx-auto mb-2 h-6 w-6" />
        No earlier quotations — when a quote is changed after approval, the old one is kept here.
      </div>
    );
  }
  return (
    <div className="divide-y rounded-lg border">
      {quotes.map((q) => (
        <div key={q.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
          <span className="font-medium">{q.quotationNumber}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${QUOTATION_STATUS_STYLES[q.status] || "bg-muted text-muted-foreground"}`}>
            {QUOTATION_STATUS_LABELS[q.status] || q.status}
          </span>
          <span className="text-xs text-muted-foreground">{formatDate(q.quotationDate || q.createdAt)}</span>
          <span className="ml-auto tabular-nums">{inr(q.grandTotal ?? q.totalAmount)}</span>
          <Button variant="outline" size="sm" className="h-7" onClick={() => onOpen(q.id)}><Eye className="h-3.5 w-3.5" /> Open</Button>
        </div>
      ))}
    </div>
  );
}
