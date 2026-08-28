import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Edit, Send, ThumbsUp, ThumbsDown, Copy, GitBranch, FileOutput, Building2, Plus, BarChart3, History as HistoryIcon, Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { boqApi } from "@/api/boqApi";
import {
  BOQ_STATUS_LABELS, BOQ_STATUS_STYLES, BOQ_CATEGORIES, BOQ_UNITS, QUOTATION_MODE_LABELS,
  type Boq, type BoqActivityLogEntry, type BoqChangeLogEntry, type BoqDiff, type BoqItem, type BoqPhase,
  type BoqReorderEntry,
} from "@/types/boq";
import BoqTree from "./components/BoqTree";
import MaterialPicker from "./components/MaterialPicker";

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "—";
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

/**
 * Client & project block. The BOQ carries the full customer OR lead record it was generated from
 * (Customer and Lead name their fields differently, so we read both), plus project / site / source
 * measurement — everything auto-populated, nothing re-keyed.
 */
function ClientProjectCard({ boq }: { boq: Boq }) {
  const client = boq.customer || boq.lead;
  const clientKind = boq.customer ? "Customer" : boq.lead ? "Lead" : null;
  if (!client) return null;
  const phone = client.mobileNumber || client.phone || client.whatsappNumber;
  const contactPerson = client.contactPerson || client.contactPersonName;
  const address = [client.address || client.siteAddress, client.city, client.district, client.state, client.pincode]
    .filter(Boolean).join(", ");

  return (
    <div className="border rounded-xl bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Client &amp; Project</h3>
        {clientKind && <span className="text-[10px] uppercase px-2 py-0.5 bg-muted rounded-full">{clientKind}</span>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
        <InfoItem label="Name" value={client.name} />
        <InfoItem label="Company" value={client.companyName} />
        <InfoItem label="Contact Person" value={contactPerson} />
        <InfoItem label="Phone" value={phone} />
        <InfoItem label="Email" value={client.email} />
        <InfoItem label="GST" value={client.gstNumber} />
        <div className="col-span-2 md:col-span-2"><InfoItem label="Address" value={address || undefined} /></div>
        <InfoItem label="Project" value={boq.project?.projectName} />
        <InfoItem label="Site / Property" value={boq.propertyName} />
        <InfoItem label="From Measurement" value={boq.measurement?.measurementNumber} />
      </div>
    </div>
  );
}

export default function BoqDetails() {
  const { id } = useParams<{ id: string }>();
  const boqId = Number(id);
  const navigate = useNavigate();
  const location = useLocation();
  // Return to the last visited screen (browser history); fall back to state.from or the BOQ list
  // only when the page was opened directly with no in-app history.
  const handleBack = () => {
    if (window.history.length > 2) { navigate(-1); return; }
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from || "/boq");
  };
  const { hasAuthority } = useAuth();
  const [boq, setBoq] = useState<Boq | null>(null);
  const [activity, setActivity] = useState<BoqActivityLogEntry[]>([]);
  const [phases, setPhases] = useState<BoqPhase[]>([]);
  const [changeLog, setChangeLog] = useState<BoqChangeLogEntry[]>([]);
  const [revisionFamily, setRevisionFamily] = useState<Boq[]>([]);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [diff, setDiff] = useState<BoqDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const [addItemTarget, setAddItemTarget] = useState<{ floor: string; room: string } | null>(null);
  const [newItem, setNewItem] = useState<Partial<BoqItem>>({ category: BOQ_CATEGORIES[0], unit: BOQ_UNITS[0], quantity: 1 });
  const [materialTarget, setMaterialTarget] = useState<BoqItem | null>(null);
  const [labourTarget, setLabourTarget] = useState<BoqItem | null>(null);
  const [newLabour, setNewLabour] = useState<{ workType: string; quantity: number; rate: number }>({ workType: "", quantity: 1, rate: 0 });

  // Editable Totals card — discount, tax, and the material/labour lump-sum overrides.
  const [editingTotals, setEditingTotals] = useState(false);
  const [savingTotals, setSavingTotals] = useState(false);
  const [totalsForm, setTotalsForm] = useState<{
    materialOverride: string; labourOverride: string;
    discountType: "PERCENT" | "FLAT"; discount: string; taxPercent: string;
  }>({ materialOverride: "", labourOverride: "", discountType: "PERCENT", discount: "", taxPercent: "" });

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteMode, setQuoteMode] = useState<"FULL_HOUSE" | "PARTIAL" | "BUDGET">("FULL_HOUSE");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [budgetCap, setBudgetCap] = useState(0);
  const [newPhase, setNewPhase] = useState<{ phaseName: string; budget: number }>({ phaseName: "", budget: 0 });

  const canWrite = hasAuthority("BOQ_WRITE");
  const canApprove = hasAuthority("BOQ_APPROVE");

  const refreshAll = useCallback(() => {
    if (!boqId) return;
    boqApi.get(boqId).then(setBoq).catch(console.error);
    boqApi.getActivityLog(boqId).then(setActivity).catch(console.error);
    boqApi.getPhases(boqId).then(setPhases).catch(console.error);
    boqApi.getChangeLog(boqId).then(setChangeLog).catch(console.error);
    boqApi.getRevisionFamily(boqId).then(setRevisionFamily).catch(console.error);
  }, [boqId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      boqApi.get(boqId).then(setBoq),
      boqApi.getActivityLog(boqId).then(setActivity),
      boqApi.getPhases(boqId).then(setPhases),
      boqApi.getChangeLog(boqId).then(setChangeLog),
      boqApi.getRevisionFamily(boqId).then(setRevisionFamily),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [boqId]);

  const handleToggleItemActive = (item: BoqItem) => {
    if (!item.id) return;
    const nextActive = item.isActive === false;
    const reason = window.prompt(nextActive ? "Reason for re-enabling this item (optional):" : "Reason for disabling this item (optional):") || undefined;
    runAction(() => boqApi.toggleItemActive(boqId, item.id!, nextActive, reason));
  };

  const handleCompare = () => {
    if (!compareFrom || !compareTo) return;
    boqApi.compareVersionsDetailed(compareFrom, compareTo).then(setDiff).catch(console.error);
  };

  const runAction = (fn: () => Promise<unknown>) => {
    setActionBusy(true);
    fn().then(refreshAll).catch((e) => console.error(e)).finally(() => setActionBusy(false));
  };

  const handleReject = () => {
    const reason = window.prompt("Reason for rejection (optional):") || undefined;
    runAction(() => boqApi.reject(boqId, reason));
  };

  const handleClone = () => {
    setActionBusy(true);
    boqApi.clone(boqId).then((clone) => navigate(`/boq/${clone.id}/edit`)).catch(console.error).finally(() => setActionBusy(false));
  };

  const handleRevision = () => {
    setActionBusy(true);
    boqApi.createRevision(boqId).then((rev) => navigate(`/boq/${rev.id}/edit`)).catch(console.error).finally(() => setActionBusy(false));
  };

  const handleGenerateQuotation = () => {
    setActionBusy(true);
    const payload: any = { mode: quoteMode };
    if (quoteMode === "PARTIAL") payload.itemIds = Array.from(selectedIds);
    if (quoteMode === "BUDGET") payload.budgetCap = budgetCap;
    boqApi.generateQuotation(boqId, payload)
      .then((quotation: any) => navigate(`/quotations/${quotation.id}`))
      .catch((e) => { console.error(e); alert(e?.response?.data?.message || "Failed to generate quotation."); })
      .finally(() => { setActionBusy(false); setQuoteDialogOpen(false); });
  };

  const handleAddItem = () => {
    if (!addItemTarget || !newItem.itemName) return;
    boqApi.addItem(boqId, { ...newItem, floorName: addItemTarget.floor, roomName: addItemTarget.room })
      .then(() => { setAddItemTarget(null); setNewItem({ category: BOQ_CATEGORIES[0], unit: BOQ_UNITS[0], quantity: 1 }); refreshAll(); })
      .catch(console.error);
  };

  const handleAddMaterial = (material: any) => {
    if (!materialTarget?.id) return;
    boqApi.addMaterial(boqId, materialTarget.id, material).then(refreshAll)
      .catch((e) => alert(e?.response?.data?.message || "Could not add the material."));
  };

  const handleReorder = (ordered: BoqReorderEntry[]) => {
    boqApi.reorder(boqId, ordered).then(refreshAll)
      .catch((e) => alert(e?.response?.data?.message || "Could not save the new order."));
  };

  const handleAddLabour = () => {
    if (!labourTarget?.id) return;
    // Work type is only a label — default it so a rate-only charge still saves instead of silently no-op'ing.
    const payload = { ...newLabour, workType: newLabour.workType.trim() || "Labour" };
    boqApi.addLabour(boqId, labourTarget.id, payload)
      .then(() => { setLabourTarget(null); setNewLabour({ workType: "", quantity: 1, rate: 0 }); refreshAll(); })
      .catch((e) => alert(e?.response?.data?.message || "Could not add the labour charge."));
  };

  const handleAddPhase = () => {
    if (!newPhase.phaseName) return;
    boqApi.addPhase(boqId, { phaseName: newPhase.phaseName, budget: newPhase.budget, sequence: phases.length + 1 })
      .then(() => { setNewPhase({ phaseName: "", budget: 0 }); refreshAll(); })
      .catch(console.error);
  };

  const startEditTotals = () => {
    if (!boq) return;
    setTotalsForm({
      materialOverride: boq.materialTotalOverride != null ? String(boq.materialTotalOverride) : "",
      labourOverride: boq.labourTotalOverride != null ? String(boq.labourTotalOverride) : "",
      discountType: boq.discountType === "FLAT" ? "FLAT" : "PERCENT",
      discount: boq.discount != null ? String(boq.discount) : "",
      taxPercent: boq.taxPercent != null ? String(boq.taxPercent) : "",
    });
    setEditingTotals(true);
  };

  const handleSaveTotals = () => {
    const num = (s: string) => { const t = s.trim(); return t === "" ? null : Number(t); };
    setSavingTotals(true);
    boqApi.updateTotals(boqId, {
      discountType: totalsForm.discountType,
      discount: num(totalsForm.discount) ?? 0,
      taxPercent: num(totalsForm.taxPercent) ?? 0,
      materialTotalOverride: num(totalsForm.materialOverride),
      labourTotalOverride: num(totalsForm.labourOverride),
    })
      .then(() => { setEditingTotals(false); refreshAll(); })
      .catch((e) => alert(e?.response?.data?.message || "Could not update the totals."))
      .finally(() => setSavingTotals(false));
  };

  /** Brings in rooms/items measured after this BOQ was generated. */
  const handleSyncFromMeasurement = () => {
    setActionBusy(true);
    boqApi.syncFromMeasurement(boqId)
      .then((res) => { alert(res.message); refreshAll(); })
      .catch((e) => {
        console.error(e);
        alert(e?.response?.data?.message || "Could not sync from the measurement.");
      })
      .finally(() => setActionBusy(false));
  };

  const toggleSelect = (ids: number[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => (selected ? next.add(i) : next.delete(i)));
      return next;
    });
  };

  const selectableItems = useMemo(
    () => (boq?.items || []).filter((i) => i.status === "PENDING" || i.status === "SELECTED"),
    [boq]
  );

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!boq || !boqId) return <div className="p-8 text-destructive">Failed to load BOQ.</div>;

  const status = boq.status || "DRAFT";
  // The backend (BoqService.ensureEditable) rejects edits once a BOQ is APPROVED — you must create a
  // revision. Gate the edit controls to match, so material/labour/item actions aren't dead buttons.
  const canEdit = canWrite && status !== "APPROVED";

  // Live preview of the totals while editing, so the grand total updates before saving. When a
  // material/labour field is blank the last-saved effective total stands in; the authoritative figure
  // (re-summed from items when an override is cleared) comes back from the server after Save.
  const pv = (() => {
    const material = totalsForm.materialOverride.trim() !== "" ? Number(totalsForm.materialOverride) : Number(boq.materialTotal ?? 0);
    const labour = totalsForm.labourOverride.trim() !== "" ? Number(totalsForm.labourOverride) : Number(boq.labourTotal ?? 0);
    const subtotal = material + labour;
    const discount = Number(totalsForm.discount || 0);
    const discountAmount = totalsForm.discountType === "FLAT" ? discount : subtotal * discount / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * Number(totalsForm.taxPercent || 0) / 100;
    return { material, labour, subtotal, discountAmount, taxAmount, grandTotal: afterDiscount + taxAmount };
  })();

  return (
    <div className="p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleBack} title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{boq.boqNumber}</h1>
              {boq.revisionNumber && boq.revisionNumber > 1 && (
                <span className="text-sm text-muted-foreground">version {boq.revisionNumber}</span>
              )}
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${BOQ_STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}>
                {BOQ_STATUS_LABELS[status] || status}
              </span>
              {boq.isLatestVersion === false && (
                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full font-medium">SUPERSEDED</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
              {(boq.customer?.name || boq.lead?.name) && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {boq.customer?.name || boq.lead?.name}</span>
              )}
              {boq.project?.projectName && <span>{boq.project.projectName}</span>}
              {boq.propertyName && <span>{boq.propertyName}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && status === "DRAFT" && boq.measurement?.id && (
            <Button variant="outline" disabled={actionBusy} onClick={handleSyncFromMeasurement}>
              <Ruler className="mr-2 h-4 w-4" /> Sync from Measurement
            </Button>
          )}
          {canWrite && status === "DRAFT" && (
            <Button variant="outline" disabled={actionBusy} onClick={() => navigate(`/boq/${boqId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
          )}
          {canWrite && status === "DRAFT" && (
            <Button disabled={actionBusy} onClick={() => runAction(() => boqApi.submitForReview(boqId))}>
              <Send className="mr-2 h-4 w-4" /> Submit for Review
            </Button>
          )}
          {canApprove && status === "REVIEW" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={actionBusy}
                onClick={() => runAction(() => boqApi.approve(boqId))}>
                <ThumbsUp className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" className="text-destructive" disabled={actionBusy} onClick={handleReject}>
                <ThumbsDown className="mr-2 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {canWrite && status === "APPROVED" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionBusy} onClick={() => setQuoteDialogOpen(true)}>
              <FileOutput className="mr-2 h-4 w-4" /> Generate Quotation
            </Button>
          )}
          {boq.quotation && (
            <Link to={`/quotations/${boq.quotation.id}`}>
              <Button variant="outline"><FileOutput className="mr-2 h-4 w-4" /> View Quotation</Button>
            </Link>
          )}
          <Link to={`/boq/${boqId}/reports`}>
            <Button variant="outline"><BarChart3 className="mr-2 h-4 w-4" /> Reports</Button>
          </Link>
          {canWrite && (
            <Button variant="outline" disabled={actionBusy} onClick={handleRevision}>
              <GitBranch className="mr-2 h-4 w-4" /> New Revision
            </Button>
          )}
          {canWrite && (
            <Button variant="outline" disabled={actionBusy} onClick={handleClone}>
              <Copy className="mr-2 h-4 w-4" /> Clone
            </Button>
          )}
        </div>
      </div>

      {/* Client & project details — carried automatically from the measurement's customer/lead
          when the BOQ is generated, so the document is complete without re-keying anything. */}
      <ClientProjectCard boq={boq} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="border rounded-xl bg-card p-5 space-y-4">
            <Tabs defaultValue="items">
              <TabsList>
                <TabsTrigger value="items">Floors / Rooms / Items</TabsTrigger>
                <TabsTrigger value="phases">Phases</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="items" className="pt-3">
                {canWrite && !canEdit && (
                  <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 flex items-center justify-between gap-3">
                    <span>This BOQ is approved and locked. Create a new revision to add or change items, materials or labour.</span>
                    <Button size="sm" variant="outline" className="shrink-0" disabled={actionBusy} onClick={handleRevision}>
                      <GitBranch className="mr-1.5 h-4 w-4" /> New Revision
                    </Button>
                  </div>
                )}
                <BoqTree
                  items={boq.items || []}
                  mode="view"
                  onAddItem={canEdit ? (floor, room) => setAddItemTarget({ floor, room }) : undefined}
                  onAddMaterial={canEdit ? (item) => setMaterialTarget(item) : undefined}
                  onDeleteMaterial={canEdit ? (item, materialId) => item.id && boqApi.deleteMaterial(boqId, item.id, materialId).then(refreshAll).catch(console.error) : undefined}
                  onAddLabour={canEdit ? (item) => setLabourTarget(item) : undefined}
                  onDeleteLabour={canEdit ? (item, labourId) => item.id && boqApi.deleteLabour(boqId, item.id, labourId).then(refreshAll).catch(console.error) : undefined}
                  onDeleteItem={canEdit ? (item) => item.id && boqApi.deleteItem(boqId, item.id).then(refreshAll).catch(console.error) : undefined}
                  onToggleItemActive={canEdit ? handleToggleItemActive : undefined}
                  onReorder={canEdit ? handleReorder : undefined}
                />
                {canEdit && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddItemTarget({ floor: "Ground Floor", room: "Living Room" })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Item to New Floor/Room
                  </Button>
                )}
              </TabsContent>
              <TabsContent value="phases" className="pt-3 space-y-3">
                {phases.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No phases defined yet.</p>
                ) : (
                  <div className="space-y-2">
                    {phases.map((p) => (
                      <div key={p.id} className="flex items-center justify-between border rounded-md p-2 text-sm">
                        <span className="font-medium">{p.sequence}. {p.phaseName}</span>
                        <span className="text-muted-foreground">{formatCurrency(p.budget)} · {p.status} · {p.completionPercent ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {canWrite && (
                  <div className="flex gap-2 items-end pt-2 border-t">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Phase Name</label>
                      <Input value={newPhase.phaseName} onChange={(e) => setNewPhase((p) => ({ ...p, phaseName: e.target.value }))} placeholder="e.g. Phase 1 - Ground Floor Windows" />
                    </div>
                    <div className="w-32">
                      <label className="text-xs text-muted-foreground">Budget</label>
                      <Input type="number" value={newPhase.budget} onChange={(e) => setNewPhase((p) => ({ ...p, budget: Number(e.target.value) }))} />
                    </div>
                    <Button size="sm" onClick={handleAddPhase}>Add</Button>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="activity" className="pt-3">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {activity.map((a, i) => (
                      <li key={i} className="text-sm border-l-2 border-primary/30 pl-3">
                        <span className="font-medium">{a.actionType}</span> — {a.description}
                        <div className="text-xs text-muted-foreground">{a.performedBy} · {formatDateTime(a.actionTime)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="history" className="pt-3 space-y-5">
                {/* Revision timeline */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><HistoryIcon className="h-3.5 w-3.5" /> Revision Timeline</h3>
                  {revisionFamily.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No revisions yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {revisionFamily.map((rev) => (
                        <div key={rev.id} className={`flex items-center justify-between border rounded-md p-2 text-sm ${rev.id === boqId ? "border-primary bg-primary/5" : ""}`}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">v{rev.revisionNumber}</span>
                            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-medium ${BOQ_STATUS_STYLES[rev.status || "DRAFT"] || "bg-muted"}`}>
                              {BOQ_STATUS_LABELS[rev.status || "DRAFT"] || rev.status}
                            </span>
                            {rev.id === boqId && <span className="text-xs text-primary font-medium">(current)</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{rev.createdByUser?.name}</span>
                            <span>{formatDate(rev.createdAt)}</span>
                            {rev.id !== boqId && (
                              <Link to={`/boq/${rev.id}`} className="text-primary hover:underline">View</Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Version compare */}
                {revisionFamily.length > 1 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-2">Compare Versions</h3>
                    <div className="flex items-end gap-2 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">From</label>
                        <select className="w-full border rounded-md p-2 text-sm" value={compareFrom ?? ""} onChange={(e) => setCompareFrom(Number(e.target.value) || null)}>
                          <option value="">Select revision...</option>
                          {revisionFamily.map((r) => <option key={r.id} value={r.id}>v{r.revisionNumber} ({r.status})</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">To</label>
                        <select className="w-full border rounded-md p-2 text-sm" value={compareTo ?? ""} onChange={(e) => setCompareTo(Number(e.target.value) || null)}>
                          <option value="">Select revision...</option>
                          {revisionFamily.map((r) => <option key={r.id} value={r.id}>v{r.revisionNumber} ({r.status})</option>)}
                        </select>
                      </div>
                      <Button size="sm" disabled={!compareFrom || !compareTo} onClick={handleCompare}>Compare</Button>
                    </div>
                    {diff && (
                      <div className="space-y-3 text-sm border rounded-lg p-3 bg-muted/20">
                        <div className="flex justify-between font-medium">
                          <span>Grand Total: {formatCurrency(diff.grandTotalFrom)} → {formatCurrency(diff.grandTotalTo)}</span>
                          <span className={diff.grandTotalDelta > 0 ? "text-red-600" : diff.grandTotalDelta < 0 ? "text-emerald-600" : ""}>
                            {diff.grandTotalDelta > 0 ? "+" : ""}{formatCurrency(diff.grandTotalDelta)}
                          </span>
                        </div>
                        {diff.itemsAdded.length > 0 && (
                          <div>
                            <div className="text-emerald-700 font-medium mb-1">Added ({diff.itemsAdded.length})</div>
                            {diff.itemsAdded.map((i) => <div key={i.itemId} className="text-xs pl-2">+ {i.itemName} ({i.floorName}/{i.roomName})</div>)}
                          </div>
                        )}
                        {diff.itemsRemoved.length > 0 && (
                          <div>
                            <div className="text-red-700 font-medium mb-1">Removed ({diff.itemsRemoved.length})</div>
                            {diff.itemsRemoved.map((i) => <div key={i.itemId} className="text-xs pl-2 line-through">- {i.itemName} ({i.floorName}/{i.roomName})</div>)}
                          </div>
                        )}
                        {diff.itemsChanged.length > 0 && (
                          <div>
                            <div className="text-amber-700 font-medium mb-1">Changed ({diff.itemsChanged.length})</div>
                            {diff.itemsChanged.map((i) => (
                              <div key={i.itemId} className="text-xs pl-2 mb-1">
                                <span className="font-medium">{i.itemName}</span>
                                {i.changes?.map((c, idx) => (
                                  <div key={idx} className="pl-3 text-muted-foreground">
                                    {c.field}: {String(c.previousValue)} → {String(c.newValue)}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {diff.itemsAdded.length === 0 && diff.itemsRemoved.length === 0 && diff.itemsChanged.length === 0 && (
                          <p className="text-muted-foreground">No item-level differences between these revisions.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Field-level change log */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-2">Edit History</h3>
                  {changeLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No field-level edits recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {changeLog.map((c) => (
                        <div key={c.id} className="text-xs border-l-2 border-amber-300 pl-2 py-1">
                          <span className="font-medium">{c.changeType}</span>
                          {c.fieldName && <span className="text-muted-foreground"> · {c.fieldName}</span>}
                          {(c.previousValue || c.newValue) && (
                            <span className="text-muted-foreground"> — {c.previousValue ?? "—"} → {c.newValue ?? "—"}</span>
                          )}
                          {c.reason && <div className="italic text-muted-foreground">Reason: {c.reason}</div>}
                          <div className="text-muted-foreground">{c.modifiedBy?.name || "System"} · {formatDateTime(c.modifiedDate)} · v{c.revisionNumber}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right: totals + info */}
        <div className="space-y-5">
          <div className="border rounded-xl bg-card p-5 space-y-1 text-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Totals</h3>
              {canEdit && !editingTotals && (
                <Button variant="outline" size="sm" className="h-7 px-2" onClick={startEditTotals}>
                  <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              )}
            </div>

            {!editingTotals ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material Total{boq.materialTotalOverride != null && <span className="ml-1 text-[10px] uppercase text-amber-600">manual</span>}</span>
                  <span>{formatCurrency(boq.materialTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labour Total{boq.labourTotalOverride != null && <span className="ml-1 text-[10px] uppercase text-amber-600">manual</span>}</span>
                  <span>{formatCurrency(boq.labourTotal)}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(boq.subtotal)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount{boq.discountType === "PERCENT" && boq.discount ? ` (${boq.discount}%)` : ""}</span>
                  <span>-{formatCurrency(boq.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax{boq.taxPercent ? ` (${boq.taxPercent}%)` : ""}</span>
                  <span>+{formatCurrency(boq.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Grand Total</span><span>{formatCurrency(boq.grandTotal)}</span></div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Material Total (override)</label>
                  <Input type="number" min={0} placeholder={`Auto: ${formatCurrency(boq.materialTotal)}`}
                    value={totalsForm.materialOverride}
                    onChange={(e) => setTotalsForm((f) => ({ ...f, materialOverride: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Labour Total (override)</label>
                  <Input type="number" min={0} placeholder={`Auto: ${formatCurrency(boq.labourTotal)}`}
                    value={totalsForm.labourOverride}
                    onChange={(e) => setTotalsForm((f) => ({ ...f, labourOverride: e.target.value }))} />
                </div>
                <p className="text-[11px] text-muted-foreground -mt-1">Leave a field blank to auto-sum it from the item materials / labour lines.</p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Discount Type</label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={totalsForm.discountType}
                      onChange={(e) => setTotalsForm((f) => ({ ...f, discountType: e.target.value === "FLAT" ? "FLAT" : "PERCENT" }))}>
                      <option value="PERCENT">Percent (%)</option>
                      <option value="FLAT">Flat (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Discount {totalsForm.discountType === "FLAT" ? "(₹)" : "(%)"}</label>
                    <Input type="number" min={0} value={totalsForm.discount}
                      onChange={(e) => setTotalsForm((f) => ({ ...f, discount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tax (%)</label>
                  <Input type="number" min={0} value={totalsForm.taxPercent}
                    onChange={(e) => setTotalsForm((f) => ({ ...f, taxPercent: e.target.value }))} />
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(pv.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>-{formatCurrency(pv.discountAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>+{formatCurrency(pv.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-base border-t pt-1 mt-1"><span>Grand Total</span><span>{formatCurrency(pv.grandTotal)}</span></div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" disabled={savingTotals} onClick={handleSaveTotals}>
                    {savingTotals ? "Saving..." : "Save Totals"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={savingTotals} onClick={() => setEditingTotals(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          <div className="border rounded-xl bg-card p-5 grid grid-cols-2 gap-4">
            <InfoItem label="Customer" value={boq.customer?.name} />
            <InfoItem label="Lead" value={boq.lead?.name} />
            <InfoItem label="Project" value={boq.project?.projectName} />
            <div>
              <p className="text-xs text-muted-foreground">Measurement</p>
              {boq.measurement?.id ? (
                <Link to={`/measurements/${boq.measurement.id}`} className="text-sm font-medium text-primary hover:underline">
                  {boq.measurement.measurementNumber || `#${boq.measurement.id}`}
                </Link>
              ) : (
                <p className="text-sm font-medium">—</p>
              )}
            </div>
            <InfoItem label="Created By" value={boq.createdByUser?.name} />
            <InfoItem label="Approved By" value={boq.approvedBy?.name} />
            <InfoItem label="Approved Date" value={formatDateTime(boq.approvedDate)} />
            {boq.rejectionReason && <InfoItem label="Rejection Reason" value={boq.rejectionReason} />}
          </div>

          {boq.notes && (
            <div className="border rounded-xl bg-card p-5">
              <h3 className="font-semibold mb-2 text-sm">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{boq.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add item dialog */}
      <Dialog open={!!addItemTarget} onOpenChange={(v) => !v && setAddItemTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Item — {addItemTarget?.floor} / {addItemTarget?.room}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Floor name" value={addItemTarget?.floor ?? ""} onChange={(e) => setAddItemTarget((t) => t && ({ ...t, floor: e.target.value }))} />
              <Input placeholder="Room name" value={addItemTarget?.room ?? ""} onChange={(e) => setAddItemTarget((t) => t && ({ ...t, room: e.target.value }))} />
            </div>
            <Input placeholder="Item name (e.g. Window W1)" value={newItem.itemName ?? ""} onChange={(e) => setNewItem((it) => ({ ...it, itemName: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <select className="border rounded-md p-2 text-sm" value={newItem.category} onChange={(e) => setNewItem((it) => ({ ...it, category: e.target.value }))}>
                {BOQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input type="number" placeholder="Qty" value={newItem.quantity ?? 1} onChange={(e) => setNewItem((it) => ({ ...it, quantity: Number(e.target.value) }))} />
              <select className="border rounded-md p-2 text-sm" value={newItem.unit} onChange={(e) => setNewItem((it) => ({ ...it, unit: e.target.value }))}>
                {BOQ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemTarget(null)}>Cancel</Button>
            <Button onClick={handleAddItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MaterialPicker open={!!materialTarget} onClose={() => setMaterialTarget(null)} onSave={handleAddMaterial} />

      {/* Add labour dialog */}
      <Dialog open={!!labourTarget} onOpenChange={(v) => !v && setLabourTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Labour — {labourTarget?.itemName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Work type (e.g. Carpentry Fixing)" value={newLabour.workType} onChange={(e) => setNewLabour((l) => ({ ...l, workType: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Quantity / Hours" value={newLabour.quantity} onChange={(e) => setNewLabour((l) => ({ ...l, quantity: Number(e.target.value) }))} />
              <Input type="number" placeholder="Rate (₹)" value={newLabour.rate} onChange={(e) => setNewLabour((l) => ({ ...l, rate: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabourTarget(null)}>Cancel</Button>
            <Button onClick={handleAddLabour}>Add Labour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate quotation dialog */}
      <Dialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Generate Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(["FULL_HOUSE", "PARTIAL", "BUDGET"] as const).map((m) => (
                <button key={m} type="button"
                  className={`border rounded-md p-2 text-sm text-left ${quoteMode === m ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => setQuoteMode(m)}>
                  {QUOTATION_MODE_LABELS[m]}
                </button>
              ))}
            </div>
            {quoteMode === "PARTIAL" && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select the floors, rooms, or items to include. {selectedIds.size} item(s) selected.</p>
                <BoqTree items={selectableItems} mode="select" selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              </div>
            )}
            {quoteMode === "BUDGET" && (
              <div>
                <label className="text-xs text-muted-foreground">Customer Budget (₹)</label>
                <Input type="number" value={budgetCap} onChange={(e) => setBudgetCap(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">Items are added floor-by-floor, room-by-room until the budget is reached. Remaining items stay on the BOQ for a future quotation.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialogOpen(false)}>Cancel</Button>
            <Button disabled={actionBusy || (quoteMode === "PARTIAL" && selectedIds.size === 0)} onClick={handleGenerateQuotation}>
              Generate Quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
