import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { contractorApi } from "@/api/contractorApi";
import type {
  WorkPackageDetail, Contractor, ContractorMaterialIssue, ContractorMaterialIssueItem,
  ContractorQualityInspection, ContractorAttendance, ContractorSafetyRecord,
} from "@/types/contractor";
import {
  WP_STATUS_TONE, BILL_STATUS_TONE, QC_RESULT_TONE, RATE_TYPE_LABEL, RATE_TYPES,
} from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import CameraCaptureButton from "@/components/CameraCaptureButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, AlertTriangle, CheckCircle2, Boxes, Receipt } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const num = (v: unknown) => (v === "" || v == null ? undefined : Number(v));

interface ProductOption { id: number; name: string; unit?: string; costPrice?: number }

export default function WorkPackageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useGoBack("/contractors/work-packages");
  const wpId = Number(id);

  const [detail, setDetail] = useState<WorkPackageDetail | null>(null);
  const [issues, setIssues] = useState<ContractorMaterialIssue[]>([]);
  const [inspections, setInspections] = useState<ContractorQualityInspection[]>([]);
  const [attendance, setAttendance] = useState<ContractorAttendance[]>([]);
  const [safety, setSafety] = useState<ContractorSafetyRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(() => {
    contractorApi.getWorkPackage(wpId).then(setDetail).catch((e) => setError(String(e)));
    contractorApi.getMaterialIssues(wpId).then(setIssues).catch(() => {});
    contractorApi.getInspections(wpId).then(setInspections).catch(() => {});
    contractorApi.getPackageAttendance(wpId).then(setAttendance).catch(() => {});
    contractorApi.getPackageSafety(wpId).then(setSafety).catch(() => {});
  }, [wpId]);

  useEffect(() => { reload(); }, [reload]);

  const act = async (fn: () => Promise<unknown>, successMessage: string) => {
    setError(null); setNotice(null);
    try {
      await fn();
      setNotice(successMessage);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  };

  if (!detail) return <div className="p-8 text-sm text-muted-foreground">Loading work package…</div>;

  const wp = detail.workPackage;
  const liveAssignments = detail.assignments.filter(
    (a) => a.status !== "REJECTED" && a.status !== "TERMINATED");
  const leadContractorId = liveAssignments[0]?.contractor?.id;

  return (
    <div className="space-y-5">
      <button type="button" onClick={goBack} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* ---------------------------------------------------------- header */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-black text-slate-900">{wp.packageName}</h2>
              <Badge className={WP_STATUS_TONE[wp.status]}>{wp.status.replace(/_/g, " ")}</Badge>
              {wp.trade && <Badge className="bg-slate-100 text-slate-700">{wp.trade.replace(/_/g, " ")}</Badge>}
              {wp.delayed && (
                <Badge className="bg-rose-100 text-rose-700 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Delayed
                </Badge>
              )}
              <span className="font-mono text-xs text-slate-400">{wp.packageCode}</span>
            </div>
            {/* The BOQ trail is the point of the module — always show where this work came from. */}
            <div className="mt-2 text-sm text-slate-600">
              <Link to={`/projects/${wp.project.id}`} className="font-semibold hover:text-primary">
                {wp.project.projectName}
              </Link>
              {wp.phase?.name && <span> › {wp.phase.name}</span>}
              {wp.room?.roomName && <span> › {wp.room.roomName}</span>}
              <span className="text-muted-foreground"> › {detail.items.length} BOQ item(s)</span>
            </div>
            {wp.scopeOfWork && <p className="mt-2 text-sm text-slate-500 max-w-2xl">{wp.scopeOfWork}</p>}
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {(wp.status === "ACCEPTED" || wp.status === "ON_HOLD" || wp.status === "REWORK") && (
              <Button onClick={() => act(() => contractorApi.startWork(wpId), "Work started.")}>Start Work</Button>
            )}
            {wp.status === "IN_PROGRESS" && (
              <>
                <Button variant="outline" onClick={() => act(() => contractorApi.holdWork(wpId, "Put on hold"), "Package on hold.")}>
                  Hold
                </Button>
                <Button onClick={() => act(() => contractorApi.markWorkCompleted(wpId), "Sent for inspection.")}>
                  Mark Work Complete
                </Button>
              </>
            )}
            {(wp.status === "INSPECTION_PENDING" || wp.status === "WORK_COMPLETED") && (
              <Button onClick={() => act(() => contractorApi.completeWorkPackage(wpId), "Work package closed.")}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Close Package
              </Button>
            )}
            {leadContractorId && wp.status !== "DRAFT" && wp.status !== "PENDING_ASSIGNMENT" && (
              <Button variant="outline"
                      onClick={() => navigate(`/contractors/bills/new?workPackageId=${wpId}&contractorId=${leadContractorId}`)}>
                <Receipt className="w-4 h-4 mr-1" /> Raise Bill
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 pt-6 border-t">
          <Metric label="Progress" value={`${wp.completionPercentage}%`} bar={wp.completionPercentage} />
          <Metric label="Rate" value={RATE_TYPE_LABEL[wp.rateType] ?? wp.rateType}
                  hint={wp.rate != null ? `${currency(wp.rate)}${wp.unit ? ` / ${wp.unit}` : ""}` : undefined} />
          <Metric label="Estimated" value={currency(wp.estimatedCost)} />
          <Metric label="Approved" value={currency(wp.approvedCost)} />
          <Metric label="Billed" value={currency(wp.billedAmount)} />
          <Metric label="Paid" value={currency(wp.paidAmount)} hint={`outstanding ${currency(wp.outstandingAmount)}`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs text-slate-500">
          <div>Planned: {wp.startDate ?? "—"} → {wp.endDate ?? "—"}</div>
          <div>Actual: {wp.actualStartDate ?? "—"} → {wp.actualEndDate ?? "—"}</div>
          <div>Quality: {wp.qualityStatus ?? "not inspected"}</div>
          <div>Site engineer: {wp.siteEngineer?.name ?? "—"}</div>
        </div>
      </div>

      {notice && <Banner tone="ok">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {/* ------------------------------------------------------------ tabs */}
      <Tabs defaultValue="items">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="items">BOQ Items</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="progress">Daily Progress</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="site">Attendance & Safety</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- items */}
        <TabsContent value="items">
          <Panel title="BOQ items in this package"
                 action={<LinkBoqItemsButton wp={wp} onDone={reload} />}>
            <SimpleTable
              head={["Item", "Unit", "Qty", "Completed", "Rate", "Amount", "Status", "Task"]}
              rows={detail.items.map((i) => [
                <div>
                  <div className="font-semibold text-slate-800">{i.itemName}</div>
                  {i.boqItem && <div className="text-[11px] text-slate-400">BOQ #{i.boqItem.id} · {i.boqItem.category ?? ""}</div>}
                </div>,
                i.unit ?? "—", i.quantity, i.completedQuantity, currency(i.rate), currency(i.amount),
                <Badge className={i.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700"
                  : i.status === "IN_PROGRESS" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-700"}>
                  {i.status.replace(/_/g, " ")}
                </Badge>,
                i.task ? <Link to="/tasks" className="text-primary hover:underline text-xs">{i.task.taskName}</Link> : "—",
              ])}
              empty="No BOQ items linked. Use “Link BOQ items” to pull scope in from the project's BOQ."
            />
          </Panel>
        </TabsContent>

        {/* -------------------------------------------------- contractors */}
        <TabsContent value="contractors">
          <Panel title="Assigned contractors"
                 action={<AssignContractorButton wpId={wpId} trade={wp.trade} onDone={reload} />}>
            <SimpleTable
              head={["Contractor", "Role", "Rate", "Agreed", "Dates", "Status", ""]}
              rows={detail.assignments.map((a) => [
                <Link to={`/contractors/directory/${a.contractor.id}`} className="font-semibold text-slate-800 hover:text-primary">
                  {a.contractor.name}
                  <div className="text-[11px] font-normal text-slate-400">{a.contractor.contractorCode}</div>
                </Link>,
                a.role ?? "—",
                a.rate != null ? `${currency(a.rate)} (${RATE_TYPE_LABEL[a.rateType ?? ""] ?? a.rateType ?? "—"})` : "—",
                currency(a.agreedAmount),
                `${a.startDate ?? "—"} → ${a.endDate ?? "—"}`,
                <Badge className={
                  a.status === "ACCEPTED" || a.status === "IN_PROGRESS" ? "bg-emerald-100 text-emerald-700"
                  : a.status === "REJECTED" || a.status === "TERMINATED" ? "bg-rose-100 text-rose-700"
                  : a.status === "COMPLETED" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                }>{a.status.replace(/_/g, " ")}</Badge>,
                a.status === "ASSIGNED" ? (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => act(() => contractorApi.acceptAssignment(a.id), "Assignment accepted.")}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline"
                            onClick={() => act(() => contractorApi.rejectAssignment(a.id, "Declined"), "Assignment rejected.")}>
                      Reject
                    </Button>
                  </div>
                ) : null,
              ])}
              empty="No contractor assigned yet."
            />
          </Panel>
        </TabsContent>

        {/* ---------------------------------------------------- materials */}
        <TabsContent value="materials">
          <Panel title="Materials issued to contractors"
                 action={leadContractorId
                   ? <IssueMaterialButton wpId={wpId} contractorId={leadContractorId} onDone={reload} />
                   : <span className="text-xs text-muted-foreground">Assign a contractor first</span>}>
            <SimpleTable
              head={["Issue", "Date", "Contractor", "Value", "Recoverable", "Status", ""]}
              rows={issues.map((iss) => [
                <span className="font-mono text-xs">{iss.issueNumber}</span>,
                iss.issueDate, iss.contractor?.name,
                currency(iss.totalValue),
                <span className={Number(iss.recoverableValue) > 0 ? "text-rose-600 font-semibold" : ""}>
                  {currency(iss.recoverableValue)}
                </span>,
                <Badge className={
                  iss.status === "RECONCILED" ? "bg-emerald-100 text-emerald-700"
                  : iss.status === "ISSUED" ? "bg-cyan-100 text-cyan-700"
                  : iss.status === "CANCELLED" ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-700"
                }>{iss.status.replace(/_/g, " ")}</Badge>,
                <div className="flex gap-1">
                  {iss.status === "DRAFT" && (
                    <Button size="sm" onClick={() => act(() => contractorApi.confirmMaterialIssue(iss.id),
                      "Materials issued — stock deducted.")}>Confirm & Issue</Button>
                  )}
                  {(iss.status === "ISSUED" || iss.status === "PARTIALLY_RETURNED") && (
                    <ReconcileButton issueId={iss.id} onDone={reload} />
                  )}
                </div>,
              ])}
              empty="No materials issued for this package yet."
            />
          </Panel>
        </TabsContent>

        {/* ----------------------------------------------------- progress */}
        <TabsContent value="progress">
          <Panel title="Daily progress"
                 action={leadContractorId
                   ? <RecordProgressButton wpId={wpId} contractorId={leadContractorId} unit={wp.unit} onDone={reload} />
                   : <span className="text-xs text-muted-foreground">Assign a contractor first</span>}>
            <SimpleTable
              head={["Date", "Contractor", "Work done", "%", "Workers", "Issues", "Status", ""]}
              rows={detail.progress.map((p) => [
                p.progressDate, p.contractor?.name, p.workDone ?? "—",
                <span className="font-bold">{p.completionPercentage}%</span>,
                p.workersCount ?? "—",
                p.issues ? <span className="text-rose-600">{p.issues}</span> : "—",
                <Badge className={
                  p.status === "VERIFIED" ? "bg-emerald-100 text-emerald-700"
                  : p.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                }>{p.status}</Badge>,
                p.status === "SUBMITTED" ? (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => act(() => contractorApi.verifyProgress(p.id, true), "Progress verified.")}>
                      Verify
                    </Button>
                    <Button size="sm" variant="outline"
                            onClick={() => act(() => contractorApi.verifyProgress(p.id, false, "Not matching site"), "Progress rejected.")}>
                      Reject
                    </Button>
                  </div>
                ) : null,
              ])}
              empty="No progress reported yet. Only verified reports move the project bar."
            />
          </Panel>
        </TabsContent>

        {/* ------------------------------------------------------ quality */}
        <TabsContent value="quality">
          <Panel title="Quality inspections"
                 action={<InspectionButton wpId={wpId} onDone={reload} />}>
            <SimpleTable
              head={["Inspection", "Date", "Type", "Result", "Score", "Defects", ""]}
              rows={inspections.map((q) => [
                <span className="font-mono text-xs">{q.inspectionNumber}</span>,
                q.inspectionDate, q.inspectionType ?? "—",
                <Badge className={QC_RESULT_TONE[q.result]}>{q.result}</Badge>,
                q.score ?? "—", q.defects ?? "—",
                q.result === "PASS" ? (
                  <Button size="sm" onClick={() => act(() => contractorApi.approveInspection(q.id, "Accepted"),
                    "Inspection approved — package can now be closed.")}>Approve</Button>
                ) : null,
              ])}
              empty="No inspections yet. A package cannot close until an inspection passes."
            />
          </Panel>
        </TabsContent>

        {/* -------------------------------------------------------- bills */}
        <TabsContent value="bills">
          <Panel title="Contractor bills">
            <SimpleTable
              head={["Bill", "Type", "Date", "Gross", "Deductions", "Net", "Balance", "Status"]}
              rows={detail.bills.map((b) => [
                <Link to={`/contractors/bills/${b.id}`} className="font-semibold text-slate-800 hover:text-primary">
                  {b.billNumber}
                </Link>,
                b.billType, b.billDate, currency(b.grossAmount),
                currency(Number(b.materialDeduction) + Number(b.advanceAdjustment)
                  + Number(b.penaltyAmount) + Number(b.otherDeduction)),
                currency(b.netAmount), currency(b.balanceAmount),
                <Badge className={BILL_STATUS_TONE[b.status]}>{b.status.replace(/_/g, " ")}</Badge>,
              ])}
              empty="No bills raised against this package."
            />
          </Panel>
        </TabsContent>

        {/* ------------------------------------------------------ changes */}
        <TabsContent value="changes">
          <Panel title="Scope variations"
                 action={<ChangeButton wpId={wpId} onDone={reload} />}>
            <SimpleTable
              head={["Change", "Type", "Description", "Cost impact", "Extension", "Status", ""]}
              rows={detail.changes.map((ch) => [
                <span className="font-mono text-xs">{ch.changeNumber}</span>,
                ch.changeType.replace(/_/g, " "), ch.description ?? "—",
                <span className={Number(ch.costImpact) < 0 ? "text-rose-600 font-semibold" : "text-emerald-700 font-semibold"}>
                  {currency(ch.costImpact)}
                </span>,
                ch.daysExtension ? `${ch.daysExtension} day(s)` : (ch.revisedEndDate ?? "—"),
                <Badge className={
                  ch.status === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                  : ch.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                }>{ch.status}</Badge>,
                ch.status === "PENDING" ? (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => act(() => contractorApi.approveChange(ch.id), "Variation approved.")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline"
                            onClick={() => act(() => contractorApi.rejectChange(ch.id, "Not approved"), "Variation rejected.")}>
                      Reject
                    </Button>
                  </div>
                ) : null,
              ])}
              empty="No variations raised. BOQ change requests raise these automatically."
            />
          </Panel>
        </TabsContent>

        {/* --------------------------------------------- attendance/safety */}
        <TabsContent value="site">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Panel title="Attendance">
              <SimpleTable
                head={["Date", "Contractor", "Status", "Workers", "In", "Out", "Hours"]}
                rows={attendance.map((a) => [
                  a.date, a.contractor?.name, a.status, a.workersCount ?? "—",
                  a.inTime ?? "—", a.outTime ?? "—", a.hoursWorked ?? "—",
                ])}
                empty="No attendance recorded. Worker counts on a daily progress report create these automatically."
              />
            </Panel>
            <Panel title="Safety"
                   action={leadContractorId
                     ? <SafetyButton wpId={wpId} contractorId={leadContractorId} onDone={reload} />
                     : undefined}>
              <SimpleTable
                head={["Date", "Type", "Severity", "PPE", "Description", "Penalty", "Status"]}
                rows={safety.map((s) => [
                  s.recordDate, s.recordType.replace(/_/g, " "), s.severity ?? "—",
                  s.ppeCompliant ? "Yes" : <span className="text-rose-600 font-semibold">No</span>,
                  s.description ?? "—", currency(s.penaltyAmount), s.status,
                ])}
                empty="No safety records."
              />
            </Panel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================ sub-components */

function LinkBoqItemsButton({ wp, onDone }: { wp: WorkPackageDetail["workPackage"]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ id: number; itemName: string; category?: string; roomName?: string; labourTotal?: number; status?: string }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !wp.boq?.id) return;
    api.get(`/boq/${wp.boq.id}`)
      .then((r) => setItems((r.data?.items ?? []).filter((i: { status?: string }) =>
        i.status === "APPROVED" || i.status === "EXECUTED")))
      .catch(() => setItems([]));
  }, [open, wp.boq?.id]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.addBoqItems(wp.id, selected);
      setOpen(false); setSelected([]); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not link the selected items.");
    } finally { setSaving(false); }
  };

  if (!wp.boq?.id) return <span className="text-xs text-muted-foreground">No BOQ on this project</span>;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Link BOQ items
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Link BOQ items to this package</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Only customer-approved items appear. An item already allocated to another live package is refused —
            that guard is what keeps the same scope from being paid twice.
          </p>
          <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
            {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No approved BOQ items.</div>}
            {items.map((i) => (
              <label key={i.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(i.id)}
                       onChange={(e) => setSelected((s) => e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id))} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-800 truncate">{i.itemName}</div>
                  <div className="text-xs text-muted-foreground">{[i.category, i.roomName].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="text-xs text-slate-500">labour {currency(i.labourTotal)}</div>
              </label>
            ))}
          </div>
          {error && <Banner tone="error">{error}</Banner>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || selected.length === 0}>
              {saving ? "Linking…" : `Link ${selected.length} item(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignContractorButton({ wpId, trade, onDone }: { wpId: number; trade?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({ role: "LEAD" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Default to the matching trade so the picker surfaces the right specialists first.
    contractorApi.list({ trade, status: "ACTIVE", size: 100 })
      .then((p) => setContractors(p.content ?? []))
      .catch(() => contractorApi.list({ status: "ACTIVE", size: 100 }).then((p) => setContractors(p.content ?? [])));
  }, [open, trade]);

  const save = async () => {
    if (!contractorId) { setError("Pick a contractor."); return; }
    setSaving(true); setError(null);
    try {
      await contractorApi.assign(wpId, Number(contractorId), {
        role: String(form.role ?? "LEAD"),
        rateType: form.rateType as string | undefined,
        rate: num(form.rate),
        agreedAmount: num(form.agreedAmount) ?? 0,
        startDate: form.startDate as string | undefined,
        endDate: form.endDate as string | undefined,
        remarks: form.remarks as string | undefined,
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign the contractor.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Assign contractor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign contractor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Contractor *">
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
                <option value="">Select…</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.overallRating ? ` — ★${Number(c.overallRating).toFixed(1)}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={String(form.role)} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  {["LEAD", "SUPPORT", "SPECIALIST"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Rate type">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={String(form.rateType ?? "")} onChange={(e) => setForm((f) => ({ ...f, rateType: e.target.value }))}>
                  <option value="">Package default</option>
                  {RATE_TYPES.map((t) => <option key={t} value={t}>{RATE_TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Rate (₹)">
                <Input type="number" onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
              </Field>
              <Field label="Agreed amount (₹)">
                <Input type="number" onChange={(e) => setForm((f) => ({ ...f, agreedAmount: e.target.value }))} />
              </Field>
              <Field label="Start date">
                <Input type="date" onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </Field>
              <Field label="End date">
                <Input type="date" onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </Field>
            </div>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Assigning…" : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IssueMaterialButton({ wpId, contractorId, onDone }: { wpId: number; contractorId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<{ productId: string; quantity: string; unitRate: string }[]>([
    { productId: "", quantity: "", unitRate: "" },
  ]);
  const [receivedBy, setReceivedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/inventory/products?size=200").then((r) => setProducts(r.data?.content ?? [])).catch(() => {});
    api.get("/inventory/warehouses").then((r) => setWarehouses(r.data ?? [])).catch(() => {});
  }, [open]);

  const save = async () => {
    const valid = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (valid.length === 0) { setError("Add at least one material line."); return; }
    setSaving(true); setError(null);
    try {
      await contractorApi.createMaterialIssue(wpId, {
        contractorId,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        issue: { receivedBy },
        items: valid.map((l) => ({
          product: { id: Number(l.productId) },
          issuedQuantity: Number(l.quantity),
          unitRate: l.unitRate ? Number(l.unitRate) : undefined,
        })),
      });
      setOpen(false);
      setLines([{ productId: "", quantity: "", unitRate: "" }]);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the material issue.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Boxes className="w-3.5 h-3.5 mr-1" /> Issue materials
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Issue materials to contractor</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Saved as a draft. Confirming the issue is what deducts stock from the warehouse.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Warehouse">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">Select…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Received by">
                <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Site supervisor" />
              </Field>
            </div>

            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-6">
                    <Label className="text-xs text-slate-500">Material</Label>
                    <select className="h-10 w-full rounded-md border bg-white px-2 text-sm" value={l.productId}
                            onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx
                              ? { ...x, productId: e.target.value,
                                  unitRate: String(products.find((p) => p.id === Number(e.target.value))?.costPrice ?? x.unitRate) }
                              : x))}>
                      <option value="">Select…</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-slate-500">Quantity</Label>
                    <Input type="number" value={l.quantity}
                           onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs text-slate-500">Unit rate (₹)</Label>
                    <Input type="number" value={l.unitRate}
                           onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, unitRate: e.target.value } : x))} />
                  </div>
                </div>
              ))}
              <Button size="sm" variant="outline"
                      onClick={() => setLines((ls) => [...ls, { productId: "", quantity: "", unitRate: "" }])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add line
              </Button>
            </div>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Create draft issue"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReconcileButton({ issueId, onDone }: { issueId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContractorMaterialIssueItem[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    contractorApi.getMaterialIssue(issueId).then((d) => setItems(d.items)).catch(() => {});
  }, [open, issueId]);

  const setField = (id: number, key: string, value: string) =>
    setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? {}), [key]: value } }));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.reconcileMaterialIssue(issueId, items.map((i) => ({
        id: i.id,
        returnedQuantity: num(edits[i.id]?.returnedQuantity) ?? i.returnedQuantity,
        consumedQuantity: num(edits[i.id]?.consumedQuantity) ?? i.consumedQuantity,
        wasteQuantity: num(edits[i.id]?.wasteQuantity) ?? i.wasteQuantity,
        damagedQuantity: num(edits[i.id]?.damagedQuantity) ?? i.damagedQuantity,
      })));
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reconcile the issue.");
    } finally { setSaving(false); }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Reconcile</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Reconcile issued materials</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Returned quantity goes back into stock. Waste and damage are priced and recovered from the
            contractor's next bill.
          </p>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="border rounded-lg p-3">
                <div className="font-semibold text-sm text-slate-800 mb-2">
                  {i.product?.name} · issued {i.issuedQuantity} {i.unit ?? ""} @ {currency(i.unitRate)}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(["returnedQuantity", "consumedQuantity", "wasteQuantity", "damagedQuantity"] as const).map((k) => (
                    <div key={k}>
                      <Label className="text-xs text-slate-500 capitalize">{k.replace("Quantity", "")}</Label>
                      <Input type="number" defaultValue={String(i[k] ?? 0)}
                             onChange={(e) => setField(i.id, k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {error && <Banner tone="error">{error}</Banner>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Reconcile"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordProgressButton({ wpId, contractorId, unit, onDone }: {
  wpId: number; contractorId: number; unit?: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ completionPercentage: "" });
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const upload = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const res = await api.post("/uploads", body, { headers: { "Content-Type": "multipart/form-data" } });
    setPhotoUrl(res.data?.url ?? res.data?.fileUrl ?? "");
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.recordProgress(wpId, {
        contractorId,
        progress: {
          progressDate: form.progressDate || undefined,
          workDone: form.workDone,
          completionPercentage: Number(form.completionPercentage || 0),
          quantityCompleted: num(form.quantityCompleted),
          unit,
          workersCount: num(form.workersCount),
          supervisorName: form.supervisorName,
          issues: form.issues,
          remarks: form.remarks,
          weather: form.weather,
        },
        media: photoUrl ? [{ mediaType: "PHOTO", fileUrl: photoUrl }] : undefined,
      });
      setOpen(false); setPhotoUrl(""); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the progress report.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Record progress
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Daily progress</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Date"><Input type="date" onChange={(e) => set("progressDate", e.target.value)} /></Field>
              <Field label="Complete %">
                <Input type="number" value={form.completionPercentage} onChange={(e) => set("completionPercentage", e.target.value)} />
              </Field>
              <Field label="Qty completed"><Input type="number" onChange={(e) => set("quantityCompleted", e.target.value)} /></Field>
              <Field label="Workers"><Input type="number" onChange={(e) => set("workersCount", e.target.value)} /></Field>
            </div>
            <Field label="Work done"><Input onChange={(e) => set("workDone", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Supervisor"><Input onChange={(e) => set("supervisorName", e.target.value)} /></Field>
              <Field label="Weather"><Input onChange={(e) => set("weather", e.target.value)} placeholder="CLEAR / RAIN" /></Field>
            </div>
            <Field label="Issues on site"><Input onChange={(e) => set("issues", e.target.value)} /></Field>
            <Field label="Photo">
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*,video/*"
                       onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <CameraCaptureButton onCapture={upload} label="Camera" />
              </div>
              {photoUrl && <div className="text-xs text-emerald-600 mt-1">Uploaded ✓</div>}
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InspectionButton({ wpId, onDone }: { wpId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ result: "PASS", inspectionType: "IN_PROGRESS_CHECK" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.recordInspection(wpId, {
        inspection: {
          inspectionDate: form.inspectionDate || undefined,
          inspectionType: form.inspectionType,
          result: form.result as never,
          score: num(form.score),
          observations: form.observations,
          defects: form.defects,
          correctiveAction: form.correctiveAction,
          reworkDueDate: form.reworkDueDate || undefined,
        },
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the inspection.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> New inspection
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quality inspection</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" onChange={(e) => set("inspectionDate", e.target.value)} /></Field>
              <Field label="Type">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.inspectionType} onChange={(e) => set("inspectionType", e.target.value)}>
                  {["IN_PROGRESS_CHECK", "PRE_HANDOVER", "FINAL", "SNAG_VERIFICATION"].map((t) =>
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
              <Field label="Result">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.result} onChange={(e) => set("result", e.target.value)}>
                  {["PASS", "FAIL", "REWORK"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Score (0-100)"><Input type="number" onChange={(e) => set("score", e.target.value)} /></Field>
            </div>
            <Field label="Observations"><Input onChange={(e) => set("observations", e.target.value)} /></Field>
            <Field label="Defects"><Input onChange={(e) => set("defects", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Corrective action"><Input onChange={(e) => set("correctiveAction", e.target.value)} /></Field>
              <Field label="Rework due"><Input type="date" onChange={(e) => set("reworkDueDate", e.target.value)} /></Field>
            </div>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChangeButton({ wpId, onDone }: { wpId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ changeType: "ADDITIONAL_WORK" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.createChange(wpId, {
        changeType: form.changeType as never,
        description: form.description,
        reason: form.reason,
        costImpact: Number(form.costImpact || 0),
        daysExtension: num(form.daysExtension),
        revisedEndDate: form.revisedEndDate || undefined,
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise the variation.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Raise variation
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scope variation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Type">
              <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                      value={form.changeType} onChange={(e) => set("changeType", e.target.value)}>
                {["ADDITIONAL_WORK", "REDUCED_SCOPE", "RATE_REVISION", "TIME_EXTENSION"].map((t) =>
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </Field>
            <Field label="Description"><Input onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Reason"><Input onChange={(e) => set("reason", e.target.value)} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Cost impact (₹)">
                <Input type="number" onChange={(e) => set("costImpact", e.target.value)}
                       placeholder="negative to reduce" />
              </Field>
              <Field label="Days extension"><Input type="number" onChange={(e) => set("daysExtension", e.target.value)} /></Field>
              <Field label="Revised end date"><Input type="date" onChange={(e) => set("revisedEndDate", e.target.value)} /></Field>
            </div>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Raise"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SafetyButton({ wpId, contractorId, onDone }: { wpId: number; contractorId: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ recordType: "PPE_CHECK", severity: "LOW" });
  const [ppe, setPpe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await contractorApi.recordSafety(wpId, contractorId, {
        recordType: form.recordType as never,
        severity: form.severity as never,
        ppeCompliant: ppe,
        description: form.description,
        actionTaken: form.actionTaken,
        penaltyAmount: Number(form.penaltyAmount || 0),
      });
      setOpen(false); onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the safety record.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Log safety
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Safety record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.recordType} onChange={(e) => set("recordType", e.target.value)}>
                  {["PPE_CHECK", "SAFETY_CHECKLIST", "INCIDENT", "VIOLATION"].map((t) =>
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
              <Field label="Severity">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={form.severity} onChange={(e) => set("severity", e.target.value)}>
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ppe} onChange={(e) => setPpe(e.target.checked)} />
              PPE compliant
            </label>
            <Field label="Description"><Input onChange={(e) => set("description", e.target.value)} /></Field>
            <Field label="Action taken"><Input onChange={(e) => set("actionTaken", e.target.value)} /></Field>
            <Field label="Penalty (₹)">
              <Input type="number" onChange={(e) => set("penaltyAmount", e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                A penalty is debited to the contractor's ledger immediately.
              </p>
            </Field>
            {error && <Banner tone="error">{error}</Banner>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ================================================================= chrome */

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mt-4">
      <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-white text-slate-500 border-b">
          <tr className="text-left">{head.map((h, i) => <th key={i} className="p-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="p-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {r.map((cell, j) => <td key={j} className="p-3 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, hint, bar }: { label: string; value: string; hint?: string; bar?: number }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
      {bar != null && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-primary rounded-full" style={{ width: `${bar}%` }} />
        </div>
      )}
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok"
    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : "bg-rose-50 border-rose-200 text-rose-700";
  return <div className={`text-sm border rounded-md p-3 ${cls}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
