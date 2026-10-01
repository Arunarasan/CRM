import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Building, Building2, Check, CheckCircle2, Copy, FileDown, FileOutput, GitBranch,
  Loader2, MoreHorizontal, Pencil, Printer, RefreshCw, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import { NumCell } from "@/pages/leads/quote/cells";
import QuotationPdfDialog from "./QuotationPdfDialog";
import {
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES, buildQuotationTree,
  type Quotation, type QuotationItem,
} from "@/types/quotation";

/**
 * Quotation page, built around the customer conversation:
 *   1. Price — adjust item rates, the customer discount and GST.
 *   2. Customer picks the scope — tick the items they want; totals follow the selection.
 *   3. "Customer approved" saves that scope (dropped items leave the total) → Create Project.
 * The customer can change the scope again any time until the project is created.
 */

const inr = (v?: number | null) =>
  "₹" + Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const num = (v: unknown) => Number(v ?? 0) || 0;
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

type DiscountMode = "PERCENT" | "FLAT";

/** Line total exactly as the server computes it (rate × qty, less line discount, + charges, + line GST). */
function lineTotal(it: QuotationItem, rate = it.rate) {
  if (rate == null || it.quantity == null) return num(it.totalAmount);
  let t = num(rate) * num(it.quantity);
  if (num(it.discountPercentage) > 0) t -= t * num(it.discountPercentage) / 100;
  t += num(it.additionalCharges);
  if (num(it.gstPercentage) > 0) t += t * num(it.gstPercentage) / 100;
  return t;
}

export default function QuotationDetails() {
  const { id } = useParams<{ id: string }>();
  const quotationId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAuthority, isAdmin } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [revisions, setRevisions] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [editingScope, setEditingScope] = useState(false);
  const [scope, setScope] = useState<Set<number>>(new Set());
  const [rateDrafts, setRateDrafts] = useState<Record<number, number | null | undefined>>({});
  const [discountMode, setDiscountMode] = useState<DiscountMode>("PERCENT");
  const [discountValue, setDiscountValue] = useState(0);
  const [gstPercent, setGstPercent] = useState(0);
  const [terms, setTerms] = useState("");

  const canWrite = hasAuthority("QUOTATION_WRITE") || isAdmin;
  const canApprove = hasAuthority("QUOTATION_APPROVE") || isAdmin;
  const isManager = isAdmin || hasAuthority("ROLE_MANAGER") || hasAuthority("ROLE_PROJECT_MANAGER");

  /** Pull the editable state (scope, discount, GST, terms) out of a fresh server copy. */
  const adopt = useCallback((q: Quotation) => {
    setQuotation(q);
    setScope(new Set((q.items || []).filter((i) => i.status !== "REJECTED").map((i) => i.id!).filter(Boolean)));
    const discounts: any[] = (q as any).discounts || [];
    if (discounts.length === 1 && num(discounts[0].percentage) > 0) {
      setDiscountMode("PERCENT"); setDiscountValue(num(discounts[0].percentage));
    } else {
      setDiscountMode(num(q.discount) > 0 ? "FLAT" : "PERCENT"); setDiscountValue(num(q.discount));
    }
    const taxes: any[] = (q as any).taxes || [];
    setGstPercent(taxes.filter((t) => !t.isInclusive).reduce((s, t) => s + num(t.percentage), 0));
    setTerms(q.termsAndConditions || "");
    setRateDrafts({});
  }, []);

  const load = useCallback(async () => {
    const [q, revs] = await Promise.all([
      quotationApi.get(quotationId),
      quotationApi.getRevisionFamily(quotationId).catch(() => []),
    ]);
    adopt(q);
    setRevisions(revs);
  }, [quotationId, adopt]);

  useEffect(() => {
    setLoading(true);
    load().catch(console.error).finally(() => setLoading(false));
  }, [load]);

  const items = quotation?.items || [];
  const status = quotation?.status || "DRAFT";
  const converted = status === "CONVERTED";
  const approved = status === "APPROVED";
  // Server rule: once approved, only managers may reprice.
  const priceEditable = canWrite && !converted && (!approved || isManager);
  const scopeEditable = canApprove && !converted && (!approved || editingScope);

  const tree = useMemo(() => buildQuotationTree(items), [items]);

  // ---- Live totals for the ticked scope (same formula as the server) ----
  const totals = useMemo(() => {
    const inScope = items.filter((i) => i.id != null && scope.has(i.id));
    const itemsTotal = inScope.reduce((s, i) => s + lineTotal(i, rateDrafts[i.id!] !== undefined ? rateDrafts[i.id!] ?? 0 : i.rate), 0);
    const labours = ((quotation as any)?.labours || []).reduce((s: number, l: any) => s + num(l.amount), 0);
    const charges = ((quotation as any)?.additionalCharges || []).reduce((s: number, c: any) => s + num(c.amount), 0);
    const subtotal = itemsTotal + labours + charges;
    const discount = discountMode === "PERCENT" ? subtotal * discountValue / 100 : discountValue;
    const gst = (subtotal - discount) * gstPercent / 100;
    return {
      count: inScope.length, subtotal, discount, gst, grand: subtotal - discount + gst,
      material: inScope.reduce((s, i) => s + num(i.materialCost), 0),
      labour: inScope.reduce((s, i) => s + num(i.labourCost), 0),
    };
  }, [items, scope, rateDrafts, quotation, discountMode, discountValue, gstPercent]);

  const serverScope = useMemo(
    () => new Set(items.filter((i) => i.status !== "REJECTED").map((i) => i.id!)), [items]);
  const scopeChanged = scope.size !== serverScope.size || [...scope].some((x) => !serverScope.has(x));

  // ---- Saving ----

  /** Full-quotation save (items are merged by id server-side; discounts/taxes are replaced). */
  const save = async (patch: Partial<Quotation> & Record<string, unknown>, what: string) => {
    if (!quotation) return;
    setBusy(true);
    try {
      adopt(await quotationApi.update(quotationId, { ...quotation, ...patch } as Quotation));
      toast.success(`${what} saved`);
    } catch (e) {
      toast.error(errMsg(e, `Could not save ${what.toLowerCase()}.`));
    } finally { setBusy(false); }
  };

  const saveRate = (item: QuotationItem, rate: number | null) =>
    save({ items: items.map((i) => (i.id === item.id ? { ...i, rate: rate ?? 0 } : i)) }, "Price");

  const savePricing = (mode: DiscountMode, value: number, gst: number) =>
    save({
      discounts: value > 0 ? [{
        discountType: "OVERALL", description: "Customer discount",
        ...(mode === "PERCENT" ? { percentage: value } : { amount: value }),
      }] : [],
      taxes: gst > 0 ? [{ taxType: "GST", percentage: gst, isInclusive: false }] : [],
    }, "Discount & GST");

  const confirmCustomerApproval = async () => {
    setBusy(true);
    try {
      const q = await quotationApi.customerApproval(quotationId, [...scope]);
      adopt(q);
      setApproveOpen(false);
      setEditingScope(false);
      toast.success(`Customer approved ${scope.size} item(s) — ${inr(q.grandTotal)}`);
    } catch (e) {
      toast.error(errMsg(e, "Could not save the customer approval."));
    } finally { setBusy(false); }
  };

  const [convertCfg, setConvertCfg] = useState<{ split?: "FLOOR"; advanceAmount: string; advanceMethod: string } | null>(null);
  const doConvert = () => {
    if (!convertCfg) return;
    setBusy(true);
    quotationApi.convertToProject(quotationId, convertCfg.split, {
      advanceAmount: convertCfg.advanceAmount || undefined,
      advancePaymentMethod: convertCfg.advanceMethod,
    })
      .then(() => { setConvertCfg(null); navigate("/projects"); })
      .catch((e) => toast.error(errMsg(e, "Conversion failed.")))
      .finally(() => setBusy(false));
  };

  const runNav = (fn: () => Promise<Quotation>, what: string) => {
    setBusy(true);
    fn().then((q) => navigate(`/quotations/${q.id}`)).catch((e) => toast.error(errMsg(e, `${what} failed.`))).finally(() => setBusy(false));
  };
  const syncFromBoq = () => {
    setBusy(true);
    quotationApi.syncFromBoq(quotationId).then((q) => { adopt(q); toast.success("Synced from BOQ"); })
      .catch((e) => toast.error(errMsg(e, "Sync failed."))).finally(() => setBusy(false));
  };

  const handleBack = () => {
    if (location.state?.from) navigate(location.state.from);
    else if (quotation?.project?.id) navigate(`/projects/${quotation.project.id}`);
    else if (quotation?.lead?.id) navigate(`/leads/${quotation.lead.id}?tab=journey`);
    else if (quotation?.customer?.id) navigate(`/customers/${quotation.customer.id}`);
    else if (window.history.length > 2) navigate(-1);
    else navigate("/quotations");
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!quotation) return <div className="p-8 text-destructive">Failed to load quotation.</div>;

  const client = quotation.customer?.name || quotation.lead?.name;
  const step = converted ? 3 : approved ? 2 : 1;
  const toggleScope = (ids: number[], on: boolean) =>
    setScope((prev) => { const n = new Set(prev); ids.forEach((x) => (on ? n.add(x) : n.delete(x))); return n; });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="outline" size="icon" onClick={handleBack} title="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight truncate">{quotation.quotationNumber}</h1>
              {quotation.revisionNumber ? <span className="text-sm text-muted-foreground">v{quotation.revisionNumber}</span> : null}
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${QUOTATION_STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}>
                {QUOTATION_STATUS_LABELS[status] || status}
              </span>
            </div>
            {client && <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><Building2 className="h-3.5 w-3.5" /> {client}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPdfOpen(true)}>
            <FileDown className="mr-2 h-4 w-4" /> PDF · Preview
          </Button>
          {!converted && !approved && canApprove && (
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy || scope.size === 0} onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Customer approved
            </Button>
          )}
          {approved && editingScope && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => { setEditingScope(false); adopt(quotation); }}>
                <Undo2 className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy || scope.size === 0 || !scopeChanged} onClick={() => setApproveOpen(true)}>
                <Check className="mr-2 h-4 w-4" /> Save new scope
              </Button>
            </>
          )}
          {approved && !editingScope && canWrite && (
            <Button disabled={busy} onClick={() => setConvertCfg({ advanceAmount: "", advanceMethod: "Cash" })}>
              <FileOutput className="mr-2 h-4 w-4" /> Create Project
            </Button>
          )}
          {converted && quotation.project?.id && (
            <Link to={`/projects/${quotation.project.id}`}><Button>Open project</Button></Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/quotations/${quotationId}/print`)}><Printer className="h-4 w-4 mr-2" /> Print page</DropdownMenuItem>
              {approved && !editingScope && canApprove && (
                <DropdownMenuItem onClick={() => setEditingScope(true)}><Pencil className="h-4 w-4 mr-2" /> Customer changed the scope</DropdownMenuItem>
              )}
              {approved && !editingScope && canWrite && (
                <DropdownMenuItem onClick={() => setConvertCfg({ split: "FLOOR", advanceAmount: "", advanceMethod: "Cash" })}>
                  <Building className="h-4 w-4 mr-2" /> Create projects split by floor
                </DropdownMenuItem>
              )}
              {canWrite && <DropdownMenuSeparator />}
              {canWrite && quotation.boq?.id && !converted && (
                <DropdownMenuItem onClick={syncFromBoq}><RefreshCw className="h-4 w-4 mr-2" /> Sync items from BOQ</DropdownMenuItem>
              )}
              {canWrite && <DropdownMenuItem onClick={() => runNav(() => quotationApi.createRevision(quotationId), "New revision")}><GitBranch className="h-4 w-4 mr-2" /> New revision</DropdownMenuItem>}
              {canWrite && <DropdownMenuItem onClick={() => runNav(() => quotationApi.duplicate(quotationId), "Duplicate")}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>}
              {isAdmin && quotation.boq?.id && (
                <DropdownMenuItem onClick={() => navigate(`/boq/${quotation.boq!.id}`)}>Open linked BOQ ({quotation.boq.boqNumber})</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ---------- Steps ---------- */}
      <div className="flex items-center gap-2 text-xs">
        {["Price & discount", "Customer approves scope", "Create project"].map((label, i) => {
          const done = step > i + 1;
          const current = step === i + 1;
          return (
            <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center font-bold ${
                done ? "bg-green-500 text-white" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`truncate font-medium ${current ? "" : "text-muted-foreground"}`}>{label}</span>
              {i < 2 && <span className={`h-0.5 flex-1 rounded ${done ? "bg-green-500" : "bg-muted"}`} />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ---------- Items ---------- */}
        <div className="lg:col-span-2 border rounded-xl bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
            <div>
              <h3 className="font-semibold">Items</h3>
              <p className="text-xs text-muted-foreground">
                {scopeEditable
                  ? "Tick the items the customer wants — totals follow the selection."
                  : approved ? "Customer-approved scope. Dropped items are greyed out." : "Prices and scope as quoted."}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">{totals.count} of {items.length} items</span>
              {scopeEditable && (
                <>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleScope(items.map((i) => i.id!), true)}>All</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toggleScope(items.map((i) => i.id!), false)}>None</Button>
                </>
              )}
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-[28px_minmax(0,1fr)_88px_110px_110px] gap-2 px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span /><span>Item</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
          </div>

          <div className="px-2 pb-3">
            {tree.floors.map((f) => (
              <div key={f.floor} className="mt-2">
                {(tree.floors.length > 1 || f.floor !== "General") && (
                  <div className="px-2 text-xs font-semibold uppercase tracking-wide text-primary">{f.floor}</div>
                )}
                {f.rooms.map((r) => {
                  const roomItems = r.categories.flatMap((c) => c.items);
                  const ids = roomItems.map((i) => i.id!).filter(Boolean);
                  const allOn = ids.every((x) => scope.has(x));
                  return (
                    <div key={r.room} className="mt-1 rounded-lg border">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-t-lg">
                        <input type="checkbox" className="h-4 w-4 accent-primary" disabled={!scopeEditable}
                          checked={allOn} onChange={() => toggleScope(ids, !allOn)} aria-label={`Select ${r.room}`} />
                        <span className="text-sm font-medium flex-1">{r.room}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {inr(roomItems.filter((i) => scope.has(i.id!)).reduce((s, i) => s + lineTotal(i, rateDrafts[i.id!] !== undefined ? rateDrafts[i.id!] ?? 0 : i.rate), 0))}
                        </span>
                      </div>
                      <div className="divide-y">
                        {roomItems.map((it) => {
                          const on = it.id != null && scope.has(it.id);
                          const draft = rateDrafts[it.id!];
                          const shownTotal = lineTotal(it, draft !== undefined ? draft ?? 0 : it.rate);
                          return (
                            <div key={it.id} className={`grid grid-cols-[28px_minmax(0,1fr)] sm:grid-cols-[28px_minmax(0,1fr)_88px_110px_110px] gap-x-2 gap-y-1 items-center px-2 py-1.5 ${on ? "" : "opacity-50"}`}>
                              <input type="checkbox" className="h-4 w-4 accent-primary justify-self-center" disabled={!scopeEditable}
                                checked={on} onChange={() => toggleScope([it.id!], !on)} aria-label={`Include ${it.itemName}`} />
                              <div className="min-w-0">
                                <p className={`text-sm truncate ${on ? "" : "line-through"}`}>{it.itemName}</p>
                                {(it.specification || it.brand) && <p className="text-[11px] text-muted-foreground truncate">{it.specification || it.brand}</p>}
                              </div>
                              <div className="col-start-2 sm:col-start-auto flex sm:block items-center justify-between gap-2 text-sm sm:text-right text-muted-foreground">
                                <span className="sm:hidden text-[11px] uppercase">Qty</span>{it.quantity ?? "—"} {it.unit ?? ""}
                              </div>
                              <div className="col-start-2 sm:col-start-auto flex sm:block items-center justify-between gap-2">
                                <span className="sm:hidden text-[11px] uppercase text-muted-foreground">Rate</span>
                                {priceEditable ? (
                                  <div className="w-28 sm:w-auto"><NumCell value={it.rate} col="qRate" className="border-border"
                                    onDraft={(v) => setRateDrafts((d) => ({ ...d, [it.id!]: v }))}
                                    onCommit={(v) => saveRate(it, v)} /></div>
                                ) : <span className="text-sm tabular-nums sm:block sm:text-right">{inr(it.rate)}</span>}
                              </div>
                              <div className="col-start-2 sm:col-start-auto flex sm:block items-center justify-between gap-2">
                                <span className="sm:hidden text-[11px] uppercase text-muted-foreground">Amount</span>
                                <span className="text-sm font-semibold tabular-nums sm:block sm:text-right">{inr(shownTotal)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">No items on this quotation.</p>}
          </div>
        </div>

        {/* ---------- Customer price ---------- */}
        <div className="space-y-5">
          <div className="border rounded-xl bg-card p-4 space-y-2 text-sm lg:sticky lg:top-4">
            <h3 className="font-semibold">Customer price</h3>
            <Row label={`Items (${totals.count})`} value={inr(totals.subtotal)} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground flex items-center gap-1">
                Discount
                <select className="h-7 rounded border bg-background px-1 text-xs" value={discountMode} disabled={!priceEditable || busy}
                  onChange={(e) => {
                    const m = e.target.value as DiscountMode;
                    setDiscountMode(m); setDiscountValue(0);
                    savePricing(m, 0, gstPercent);
                  }}>
                  <option value="PERCENT">%</option>
                  <option value="FLAT">₹</option>
                </select>
              </span>
              <div className="flex items-center gap-2">
                <div className="w-24"><NumCell value={discountValue} disabled={!priceEditable || busy} className="h-8 border-border"
                  onCommit={(v) => { setDiscountValue(v ?? 0); savePricing(discountMode, v ?? 0, gstPercent); }} /></div>
                <span className="w-24 text-right tabular-nums text-muted-foreground">− {inr(totals.discount)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">GST %</span>
              <div className="flex items-center gap-2">
                <div className="w-24"><NumCell value={gstPercent} disabled={!priceEditable || busy} className="h-8 border-border"
                  onCommit={(v) => { setGstPercent(v ?? 0); savePricing(discountMode, discountValue, v ?? 0); }} /></div>
                <span className="w-24 text-right tabular-nums text-muted-foreground">+ {inr(totals.gst)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Grand total</span>
              <span className="text-xl font-bold tabular-nums text-primary">{inr(totals.grand)}</span>
            </div>
            {scopeChanged && !converted && (
              <p className="text-[11px] text-amber-700">
                Showing the ticked scope — {approved ? "save the new scope" : "mark customer approved"} to make it the quoted total.
              </p>
            )}
            {busy && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</p>}
            <div className="border-t pt-2 text-xs text-muted-foreground space-y-0.5">
              <Row label="Material" value={inr(totals.material)} small />
              <Row label="Labour" value={inr(totals.labour)} small />
            </div>
          </div>

          <div className="border rounded-xl bg-card p-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Info label="Quote date" value={quotation.quotationDate} />
              <Info label="Valid until" value={quotation.expiryDate} />
              <Info label="Prepared by" value={quotation.preparedBy?.name} />
              <Info label="Approved by" value={approved || converted ? quotation.approvedBy?.name : "—"} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Terms & conditions</label>
              <textarea rows={3} value={terms} disabled={!priceEditable}
                onChange={(e) => setTerms(e.target.value)}
                onBlur={() => terms !== (quotation.termsAndConditions || "") && save({ termsAndConditions: terms }, "Terms")}
                placeholder="Payment terms, validity, warranty…"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70" />
            </div>
          </div>

          {revisions.length > 1 && (
            <div className="border rounded-xl bg-card p-4 text-sm">
              <h3 className="font-semibold mb-1">Versions</h3>
              {revisions.map((r) => (
                <Link key={r.id} to={`/quotations/${r.id}`}
                  className={`flex justify-between p-1.5 rounded hover:bg-muted/40 ${r.id === quotationId ? "bg-muted/50 font-medium" : ""}`}>
                  <span>v{r.revisionNumber ?? 0} · {QUOTATION_STATUS_LABELS[r.status || ""] || r.status}</span>
                  <span className="tabular-nums">{inr(r.grandTotal)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- Customer approval confirm ---------- */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{approved ? "Save the new scope?" : "Customer approved this quotation?"}</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p><span className="font-semibold">{totals.count}</span> of {items.length} items · grand total <span className="font-semibold">{inr(totals.grand)}</span></p>
            {totals.count < items.length && (
              <p className="text-muted-foreground">The {items.length - totals.count} unticked item(s) are dropped from the quotation and its total, and go back to the BOQ.</p>
            )}
            <p className="text-muted-foreground">The quotation becomes Approved and you can create the project.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={confirmCustomerApproval}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Convert-to-project + advance payment ---------- */}
      <Dialog open={!!convertCfg} onOpenChange={(o) => !o && setConvertCfg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Project{convertCfg?.split ? " (split by floor)" : ""}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A project is created from the {totals.count} approved item(s). If the customer paid an advance,
              record it now — it's booked against the new project.
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
              <Button variant="outline" onClick={() => setConvertCfg(null)} disabled={busy}>Cancel</Button>
              <Button onClick={doConvert} disabled={busy} className="bg-green-600 hover:bg-green-700 text-white">
                {busy ? "Creating…" : convertCfg?.advanceAmount ? `Create Project + Record ₹${convertCfg.advanceAmount}` : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuotationPdfDialog quotation={quotation} open={pdfOpen} onOpenChange={setPdfOpen} defaultSelectedIds={[...scope]} />
    </div>
  );
}

function Row({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={small ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block text-xs">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
