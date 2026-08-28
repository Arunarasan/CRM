import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Building2, ThumbsUp, ThumbsDown, GitBranch, Copy, FileOutput, Building, CheckCircle2,
  RefreshCw, Printer, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { quotationApi } from "@/api/quotationApi";
import { downloadQuotationPdf } from "@/lib/quotationPdf";
import {
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_STYLES,
  type Quotation, type QuotationItem,
} from "@/types/quotation";
import QuotationTree from "./components/QuotationTree";

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function QuotationDetails() {
  const { id } = useParams<{ id: string }>();
  const quotationId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAuthority } = useAuth();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [revisions, setRevisions] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (quotation?.lead?.id) {
      navigate(`/leads/${quotation.lead.id}`);
    } else if (quotation?.customer?.id) {
      navigate(`/customers/${quotation.customer.id}`);
    } else if (quotation?.project?.id) {
      navigate(`/projects/${quotation.project.id}`);
    } else if (quotation?.boq?.id) {
      navigate(`/boq/${quotation.boq.id}`);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/quotations");
    }
  };

  const canWrite = hasAuthority("QUOTATION_WRITE");
  const canApprove = hasAuthority("QUOTATION_APPROVE");
  const isManager = hasAuthority("ROLE_ADMIN") || hasAuthority("ROLE_MANAGER") || hasAuthority("ROLE_PROJECT_MANAGER");

  const refresh = useCallback(() => {
    if (!quotationId) return;
    quotationApi.get(quotationId).then(setQuotation).catch(console.error);
    quotationApi.getRevisionFamily(quotationId).then(setRevisions).catch(console.error);
  }, [quotationId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      quotationApi.get(quotationId).then(setQuotation),
      quotationApi.getRevisionFamily(quotationId).then(setRevisions),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [quotationId]);

  const items = quotation?.items || [];
  const pendingItems = useMemo(() => items.filter((i) => i.status === "PENDING"), [items]);

  const toggle = (itemId?: number) => {
    if (itemId === undefined) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const runAction = (fn: () => Promise<unknown>) => {
    setBusy(true);
    fn().then(refresh).catch((e) => { console.error(e); alert(e?.response?.data?.message || "Action failed."); }).finally(() => setBusy(false));
  };

  const handleApproveSelected = () => runAction(() => quotationApi.approveItems(quotationId, Array.from(checked)).then(() => setChecked(new Set())));
  const handleRejectSelected = () => runAction(() => quotationApi.rejectItems(quotationId, Array.from(checked)).then(() => setChecked(new Set())));
  const handleApproveAll = () => runAction(() => quotationApi.approveItems(quotationId, pendingItems.map((i) => i.id!).filter(Boolean)));

  const handleConvert = (splitBy?: "NONE" | "FLOOR") => {
    setBusy(true);
    quotationApi.convertToProject(quotationId, splitBy)
      .then(() => navigate("/projects"))
      .catch((e) => { console.error(e); alert(e?.response?.data?.message || "Conversion failed — approve items first."); })
      .finally(() => setBusy(false));
  };

  /** Flips the header status so the conversion buttons unlock; item-level approval rolls this up too. */
  const handleApproveQuotation = () =>
    runAction(() => quotationApi.updateApprovalStatus(quotationId, "APPROVED"));

  const handleRevise = () => {
    setBusy(true);
    quotationApi.createRevision(quotationId).then((rev) => navigate(`/quotations/${rev.id}`)).catch(console.error).finally(() => setBusy(false));
  };

  const handleDuplicate = () => {
    setBusy(true);
    quotationApi.duplicate(quotationId).then((dup) => navigate(`/quotations/${dup.id}`)).catch(console.error).finally(() => setBusy(false));
  };

  const handleSyncFromBoq = () => runAction(() => quotationApi.syncFromBoq(quotationId));

  /** Persist a single line's pricing/annotations. mergeItemPricing matches by id, so send the full item list. */
  const handleSaveItem = async (updated: QuotationItem) => {
    if (!quotation) return;
    const items = (quotation.items || []).map((i) => (i.id === updated.id ? updated : i));
    setBusy(true);
    try {
      const saved = await quotationApi.update(quotationId, { ...quotation, items });
      setQuotation(saved);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || "Failed to save item.");
      throw e;
    } finally {
      setBusy(false);
    }
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

  const status = quotation.status || "DRAFT";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleBack} title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{quotation.quotationNumber}</h1>
              {quotation.revisionNumber ? <span className="text-sm text-muted-foreground">v{quotation.revisionNumber}</span> : null}
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${QUOTATION_STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}>
                {QUOTATION_STATUS_LABELS[status] || status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
              {quotation.customer?.name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {quotation.customer.name}</span>}
              {quotation.boq?.boqNumber && (
                <Link to={`/boq/${quotation.boq.id}`} className="underline">Linked BOQ: {quotation.boq.boqNumber}</Link>
              )}
              <span>{quotation.quotationMode || "FULL_HOUSE"}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadQuotationPdf(quotation)}>
            <FileDown className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button variant="outline" onClick={() => navigate(`/quotations/${quotationId}/print`)}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          {canWrite && quotation.boq?.id && status !== "CONVERTED" && (
            <Button
              variant="outline" disabled={busy} onClick={handleSyncFromBoq}
              title="Pull the latest floors/rooms/items from the linked BOQ, keeping your manual pricing"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Sync from BOQ
            </Button>
          )}
          {canWrite && (
            <Button variant="outline" disabled={busy} onClick={handleRevise}><GitBranch className="mr-2 h-4 w-4" /> New Revision</Button>
          )}
          {canWrite && (
            <Button variant="outline" disabled={busy} onClick={handleDuplicate}><Copy className="mr-2 h-4 w-4" /> Duplicate</Button>
          )}
          {canWrite && status !== "CONVERTED" && status !== "APPROVED" && (
            <Button variant="outline" disabled={busy} onClick={handleApproveQuotation}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Approved
            </Button>
          )}
          {canWrite && status !== "CONVERTED" && (
            <>
              <Button
                disabled={busy || status !== "APPROVED"}
                title={status !== "APPROVED" ? "Customer approval required — a project can only be created from an approved quotation" : undefined}
                onClick={() => handleConvert()}
              >
                <FileOutput className="mr-2 h-4 w-4" /> Create Project
              </Button>
              <Button
                variant="outline"
                disabled={busy || status !== "APPROVED"}
                title={status !== "APPROVED" ? "Customer approval required — a project can only be created from an approved quotation" : undefined}
                onClick={() => handleConvert("FLOOR")}
              >
                <Building className="mr-2 h-4 w-4" /> Create Project (Split by Floor)
              </Button>
            </>
          )}
          {quotation.project?.projectName && (
            <Link to="/projects"><Button variant="outline">View Project: {quotation.project.projectName}</Button></Link>
          )}
        </div>
      </div>

      {/* A greyed-out button with only a tooltip reads as "broken" — say what is blocking it. */}
      {canWrite && status !== "CONVERTED" && status !== "APPROVED" && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Create Project is locked: </span>
          this quotation is <span className="font-medium">{QUOTATION_STATUS_LABELS[status] || status}</span>.
          {pendingItems.length > 0
            ? ` Approve the remaining ${pendingItems.length} item(s) below — the quotation then approves itself automatically.`
            : " Click Mark Approved to unlock it."}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="border rounded-xl bg-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Quotation — Floor / Room / Work</h3>
              {canApprove && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleApproveAll} disabled={busy || pendingItems.length === 0}>Approve All Pending</Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleApproveSelected} disabled={busy || checked.size === 0}>
                    <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Approve Selected
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={handleRejectSelected} disabled={busy || checked.size === 0}>
                    <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Reject Selected
                  </Button>
                </div>
              )}
            </div>
            <QuotationTree
              items={items}
              canApprove={canApprove}
              editable={canWrite && (!(status === "APPROVED" || status === "CONVERTED") || isManager)}
              checked={checked}
              onToggle={toggle}
              onSaveItem={handleSaveItem}
              busy={busy}
            />
            {quotation.boq?.id && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                Structure (floors, rooms, items) is defined on the{" "}
                <Link to={`/boq/${quotation.boq.id}`} className="underline">linked BOQ</Link>. Use{" "}
                <span className="font-medium">Sync from BOQ</span> above to pull structural changes here.
              </p>
            )}
          </div>

          {revisions.length > 1 && (
            <div className="border rounded-xl bg-card p-5">
              <h3 className="font-semibold mb-2">Version History</h3>
              <div className="space-y-1">
                {revisions.map((r) => (
                  <Link key={r.id} to={`/quotations/${r.id}`}
                    className={`flex justify-between text-sm p-2 rounded-md hover:bg-muted/40 ${r.id === quotationId ? "bg-muted/50 font-medium" : ""}`}>
                    <span>v{r.revisionNumber} — {r.quotationNumber}</span>
                    <span>{formatCurrency(r.grandTotal)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="border rounded-xl bg-card p-5 space-y-1 text-sm">
            <h3 className="font-semibold mb-2">Grand Summary</h3>
            <div className="flex justify-between"><span className="text-muted-foreground">Material Total</span><span>{formatCurrency(quotation.materialTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Labour Total</span><span>{formatCurrency(quotation.labourTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Additional Charges</span><span>{formatCurrency(quotation.additionalChargesTotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatCurrency(quotation.discount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>+{formatCurrency(quotation.gst)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Grand Total</span><span>{formatCurrency(quotation.grandTotal)}</span></div>
            {quotation.quotationMode === "BUDGET" && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1"><span>Customer Budget</span><span>{formatCurrency(quotation.budgetCap)}</span></div>
            )}
          </div>

          <div className="border rounded-xl bg-card p-5 grid grid-cols-2 gap-4">
            <InfoItem label="Customer" value={quotation.customer?.name} />
            <InfoItem label="Validity" value={quotation.expiryDate} />
            <InfoItem label="Prepared By" value={quotation.preparedBy?.name} />
            <InfoItem label="Approval Status" value={quotation.internalApprovalStatus} />
          </div>

          {quotation.termsAndConditions && (
            <div className="border rounded-xl bg-card p-5">
              <h3 className="font-semibold mb-2 text-sm">Terms</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.termsAndConditions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
