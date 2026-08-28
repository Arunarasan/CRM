import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Check, Edit, MapPin, PlayCircle, Send, ThumbsUp, ThumbsDown,
  CheckCircle2, XCircle, Building2, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { measurementApi } from "@/api/measurementApi";
import { boqApi } from "@/api/boqApi";
import type { Boq } from "@/types/boq";
import {
  MEASUREMENT_PRIORITIES, MEASUREMENT_STATUSES, MEASUREMENT_TYPES, PRIORITY_STYLES, STATUS_STYLES,
  type Measurement, type MeasurementRoom, type UserSummary,
} from "@/types/measurement";
import { SelectField, TextAreaField, TextField } from "../leads/fields";
import { ContactContextCard } from "./MeasurementForm";
import { formatDate, formatDateTime, initials } from "./helpers";
import RoomsTab from "./tabs/RoomsTab";

/** What still stands between the current status and the Generate BOQ button. */
const BOQ_READINESS: Record<string, string> = {
  "Draft": "add floors, rooms and items, then Start Measurement.",
  "Assigned": "accept the assignment or Start Measurement, then capture rooms and items.",
  "Accepted": "Start Measurement, then capture rooms and items.",
  "In Progress": "finish capturing rooms and items, then Submit for Review.",
  "Under Review": "an approver needs to Approve this measurement.",
  "Revision Required": "address the rejection remarks, then Submit for Review again.",
  "Approved": "click Mark Completed · Ready for BOQ.",
};
import DrawingsTab from "./tabs/DrawingsTab";
import MediaTab from "./tabs/MediaTab";
import ChecklistTab from "./tabs/ChecklistTab";
import AssignmentsTab from "./tabs/AssignmentsTab";
import ActivityTab from "./tabs/ActivityTab";
import RevisionsTab from "./tabs/RevisionsTab";

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 whitespace-nowrap";

const WORKFLOW_STAGES = MEASUREMENT_STATUSES.filter((s) => s !== "Cancelled" && s !== "Revision Required");

function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

export default function MeasurementDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const measurementId = Number(id);
  const { hasAuthority, isAdmin } = useAuth();
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [rooms, setRooms] = useState<MeasurementRoom[]>([]);
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [showBoqHistory, setShowBoqHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const canWrite = hasAuthority("MEASUREMENT_WRITE");
  const canAssign = hasAuthority("MEASUREMENT_ASSIGN");
  const canApprove = hasAuthority("MEASUREMENT_APPROVE");
  const canDelete = hasAuthority("MEASUREMENT_DELETE");

  const handleBack = () => {
    // Prefer the last visited screen (browser history); the routes below are only fallbacks for when
    // the page was opened directly with no in-app history to return to.
    if (window.history.length > 2) {
      navigate(-1);
    } else if (location.state?.from) {
      navigate(location.state.from);
    } else if (measurement?.lead?.id) {
      navigate(`/leads/${measurement.lead.id}`);
    } else if (measurement?.customer?.id) {
      navigate(`/customers/${measurement.customer.id}`);
    } else if (measurement?.project?.id) {
      navigate(`/projects/${measurement.project.id}`);
    } else if (measurement?.siteVisit?.id) {
      navigate(`/site-visits/${measurement.siteVisit.id}`);
    } else {
      navigate("/measurements");
    }
  };

  const fetchMeasurement = useCallback(() => {
    if (!measurementId) return;
    measurementApi.get(measurementId).then(setMeasurement).catch(console.error);
  }, [measurementId]);

  const fetchRooms = useCallback(() => {
    if (!measurementId) return;
    measurementApi.getRooms(measurementId).then(setRooms).catch(console.error);
  }, [measurementId]);

  const fetchBoqs = useCallback(() => {
    if (!measurementId) return;
    boqApi.getByMeasurement(measurementId).then(setBoqs).catch(console.error);
  }, [measurementId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      measurementApi.get(measurementId).then(setMeasurement),
      measurementApi.getRooms(measurementId).then(setRooms),
      measurementApi.assignableEmployees().then(setEmployees),
      boqApi.getByMeasurement(measurementId).then(setBoqs),
    ]).catch(console.error).finally(() => setLoading(false));
  }, [measurementId]);

  const refreshAll = () => { fetchMeasurement(); fetchRooms(); fetchBoqs(); };

  /** Backend rejections (403, invalid transition, "BOQ already exists") must be visible — a button
   *  that silently does nothing is indistinguishable from a broken app. */
  const describeError = (e: any) =>
    e?.response?.data?.message
      || e?.response?.data?.error
      || (e?.response?.status === 403 ? "You don't have permission for this action." : null)
      || e?.message
      || "Something went wrong. Please try again.";

  const runAction = (fn: () => Promise<unknown>) => {
    setActionBusy(true);
    setActionError("");
    fn()
      .then(refreshAll)
      .catch((e) => { console.error(e); setActionError(describeError(e)); })
      .finally(() => setActionBusy(false));
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
  if (!measurement || !measurementId) return <div className="p-8 text-destructive">Failed to load measurement.</div>;

  const status = measurement.status || "Draft";
  const currentStageIndex = WORKFLOW_STAGES.indexOf(status === "Revision Required" ? "Under Review" : status);
  const progressPct = status === "Completed"
    ? 100
    : Math.max(0, Math.round((currentStageIndex / (WORKFLOW_STAGES.length - 1)) * 100));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleBack} title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{measurement.measurementNumber}</h1>
              {measurement.revisionNumber && measurement.revisionNumber > 1 && (
                <span className="text-sm text-muted-foreground">revision {measurement.revisionNumber}</span>
              )}
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${STATUS_STYLES[status] || "bg-muted text-muted-foreground"}`}>
                {status}
              </span>
              {measurement.priority && (
                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${PRIORITY_STYLES[measurement.priority] || ""}`}>
                  {measurement.priority}
                </span>
              )}
              {measurement.isLatestRevision === false && (
                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full font-medium">SUPERSEDED</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
              {measurement.customer?.name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {measurement.customer.name}</span>}
              {measurement.project?.projectName && <span>{measurement.project.projectName}</span>}
              {measurement.siteAddress && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {measurement.siteAddress}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && ["Draft", "Assigned", "Accepted"].includes(status) && (
            <Button variant="outline" disabled={actionBusy} onClick={() => runAction(() => measurementApi.start(measurementId))}>
              <PlayCircle className="mr-2 h-4 w-4" /> Start Measurement
            </Button>
          )}
          {canWrite && ["In Progress", "Revision Required"].includes(status) && (
            <Button disabled={actionBusy} onClick={() => runAction(() => measurementApi.submit(measurementId))}>
              <Send className="mr-2 h-4 w-4" /> Submit for Review
            </Button>
          )}
          {canApprove && status === "Under Review" && (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={actionBusy}
                onClick={() => runAction(() => measurementApi.approve(measurementId))}>
                <ThumbsUp className="mr-2 h-4 w-4" /> Approve
              </Button>
              <Button variant="outline" className="text-destructive" disabled={actionBusy} onClick={() => setRejectOpen(true)}>
                <ThumbsDown className="mr-2 h-4 w-4" /> Request Revision
              </Button>
            </>
          )}
          {canWrite && status === "Approved" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionBusy}
              onClick={() => runAction(() => measurementApi.complete(measurementId))}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Completed · Ready for BOQ
            </Button>
          )}
          {canWrite && status === "Completed" && boqs.length === 0 && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionBusy}
              onClick={() => {
                setActionBusy(true);
                setActionError("");
                boqApi.createFromMeasurement(measurementId)
                  .then((boq) => navigate(`/boq/${boq.id}/edit`))
                  .catch((e) => { console.error(e); setActionError(describeError(e)); })
                  .finally(() => setActionBusy(false));
              }}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Generate BOQ
            </Button>
          )}
          {boqs.length > 0 && (
            <Link to={`/boq/${(boqs.find((b) => b.isLatestVersion) ?? boqs[0]).id}`}>
              <Button variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" /> Open BOQ</Button>
            </Link>
          )}
          {boqs.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => setShowBoqHistory((v) => !v)}>
              BOQ History ({boqs.length})
            </Button>
          )}
          {canWrite && <Button variant="outline" onClick={() => setEditOpen(true)}><Edit className="h-4 w-4 mr-2" /> Edit</Button>}
          {canDelete && !["Completed", "Cancelled"].includes(status) && (
            <Button variant="ghost" className="text-destructive" disabled={actionBusy}
              onClick={() => confirm("Cancel this measurement?") && runAction(() => measurementApi.cancel(measurementId))}>
              <XCircle className="h-4 w-4 mr-2" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* The BOQ button only exists at Completed, so say what still has to happen to get there. */}
      {canWrite && boqs.length === 0 && !["Completed", "Cancelled"].includes(status) && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step to generate the BOQ: </span>
          {BOQ_READINESS[status] ?? "move this measurement through the workflow to Completed."}
        </div>
      )}

      {showBoqHistory && boqs.length > 0 && (
        <div className="border rounded-xl bg-card p-4 space-y-2">
          <h3 className="font-semibold text-sm">BOQ History</h3>
          {boqs.map((b) => (
            <Link key={b.id} to={`/boq/${b.id}`}
              className="flex items-center justify-between text-sm border rounded-lg p-2 hover:bg-muted/50">
              <span className="font-medium">{b.boqNumber} · Rev {b.revisionNumber ?? 1}</span>
              <span className="text-muted-foreground">{b.status}{b.isLatestVersion === false ? " · superseded" : ""}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Progress tracker — compact bar on phones, full stepper from sm up */}
      {status !== "Cancelled" && (
        <div className="sm:hidden bg-card border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-primary">{status}</span>
            <span className="text-muted-foreground">
              {status === "Completed" ? "Complete" : `Step ${currentStageIndex + 1} of ${WORKFLOW_STAGES.length}`}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}
      {status !== "Cancelled" && (
        <div className="hidden sm:block bg-card border rounded-xl p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center min-w-[900px]">
            {WORKFLOW_STAGES.map((stage, index) => {
              const done = index < currentStageIndex || status === "Completed";
              const current = index === currentStageIndex && status !== "Completed";
              return (
                <div key={stage} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                      ${done ? "bg-primary border-primary text-primary-foreground"
                        : current ? "border-primary text-primary bg-primary/10"
                        : "border-muted-foreground/30 text-muted-foreground"}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </div>
                    <span className={`text-[10px] whitespace-nowrap ${current ? "font-bold text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                      {stage}
                    </span>
                  </div>
                  {index < WORKFLOW_STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 ${index < currentStageIndex || status === "Completed" ? "bg-primary" : "bg-muted-foreground/20"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-3 rounded-xl border shadow-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Engineer:</span>
          {measurement.assignedEngineer ? (
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                {initials(measurement.assignedEngineer.name)}
              </span>
              {measurement.assignedEngineer.name}
            </span>
          ) : <span className="text-muted-foreground">Unassigned</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Designer:</span>
          <span className="font-medium">{measurement.designer?.name || "Unassigned"}</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-muted-foreground">Rooms: <span className="font-semibold text-foreground">{measurement.roomCount ?? rooms.length}</span></span>
          <span className="text-muted-foreground">Total Area: <span className="font-semibold text-foreground">{measurement.totalArea ? `${measurement.totalArea} sq.ft` : "—"}</span></span>
          <span className="text-muted-foreground">Date: <span className="font-semibold text-foreground">{formatDate(measurement.measurementDate)}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0 space-x-5">
            {[
              ["overview", "Overview"], ["rooms", `Rooms & Items (${rooms.length})`], ["drawings", "Drawings"],
              ["media", "Media"], ["checklist", "Checklist"], ["assignments", "Team"],
              ["activity", "Timeline"], ["revisions", "Revisions"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className={TAB_TRIGGER_CLASS}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-4">
            <ContactContextCard lead={measurement.lead} customer={measurement.customer} visit={measurement.siteVisit} />
            <Card>
              <CardHeader><CardTitle>Measurement Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Type" value={measurement.measurementType} />
                <InfoItem label="Property Type" value={measurement.propertyType} />
                <InfoItem label="Construction Stage" value={measurement.constructionStage} />
                <InfoItem label="Total Floors" value={measurement.totalFloors} />
                <InfoItem label="Measured By" value={measurement.measuredBy} />
                <InfoItem label="Verified By" value={measurement.verifiedBy} />
                <InfoItem label="Start / End Time" value={measurement.startTime && measurement.endTime ? `${measurement.startTime} - ${measurement.endTime}` : "—"} />
                <InfoItem label="Created" value={formatDateTime(measurement.createdAt)} />
                <div>
                  <p className="text-xs text-muted-foreground">Source Site Visit</p>
                  {measurement.siteVisit?.id ? (
                    <Link to={`/site-visits/${measurement.siteVisit.id}`} className="text-sm font-medium text-primary hover:underline">
                      {(measurement.siteVisit as any).visitNumber || `Visit #${measurement.siteVisit.id}`}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">—</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Auto-Calculated Totals</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Total Floor Area" value={measurement.totalFloorArea ? `${measurement.totalFloorArea} sqft` : "—"} />
                <InfoItem label="Total Wall Area" value={measurement.totalWallArea ? `${measurement.totalWallArea} sqft` : "—"} />
                <InfoItem label="Total Ceiling Area" value={measurement.totalCeilingArea ? `${measurement.totalCeilingArea} sqft` : "—"} />
                <InfoItem label="Total Paintable Area" value={measurement.totalPaintableArea ? `${measurement.totalPaintableArea} sqft` : "—"} />
                <InfoItem label="Total Door Area" value={measurement.totalDoorArea ? `${measurement.totalDoorArea} sqft` : "—"} />
                <InfoItem label="Total Window Area" value={measurement.totalWindowArea ? `${measurement.totalWindowArea} sqft` : "—"} />
                <InfoItem label="Total False Ceiling Area" value={measurement.totalFalseCeilingArea ? `${measurement.totalFalseCeilingArea} sqft` : "—"} />
                <InfoItem label="Total Tile Area" value={measurement.totalTileArea ? `${measurement.totalTileArea} sqft` : "—"} />
              </CardContent>
            </Card>
            {(measurement.remarks || measurement.internalNotes || measurement.rejectionReason) && (
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Remarks" value={measurement.remarks} />
                  <InfoItem label="Internal Notes" value={measurement.internalNotes} />
                  {measurement.rejectionReason && (
                    <div className="md:col-span-2"><InfoItem label="Revision Requested — Reason" value={measurement.rejectionReason} /></div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="rooms">
            <RoomsTab measurementId={measurementId} canWrite={canWrite || isAdmin} onChanged={refreshAll} />
          </TabsContent>
          <TabsContent value="drawings">
            <DrawingsTab measurementId={measurementId} canWrite={canWrite || isAdmin} onChanged={refreshAll} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab measurementId={measurementId} rooms={rooms} canWrite={canWrite || isAdmin} onChanged={refreshAll} />
          </TabsContent>
          <TabsContent value="checklist">
            <ChecklistTab measurementId={measurementId} canWrite={canWrite || isAdmin} onChanged={refreshAll} />
          </TabsContent>
          <TabsContent value="assignments">
            <AssignmentsTab measurementId={measurementId} employees={employees} canAssign={canAssign || isAdmin} canWrite={canWrite || isAdmin} onChanged={refreshAll} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab measurementId={measurementId} />
          </TabsContent>
          <TabsContent value="revisions">
            <RevisionsTab measurementId={measurementId} canWrite={canWrite || isAdmin} isLatestRevision={measurement.isLatestRevision !== false} onChanged={refreshAll} />
          </TabsContent>
        </div>
      </Tabs>

      <EditMeasurementDialog open={editOpen} onOpenChange={setEditOpen} measurement={measurement} onSaved={refreshAll} />
      <RejectDialog open={rejectOpen} onOpenChange={setRejectOpen} measurementId={measurementId} onSaved={refreshAll} />
    </div>
  );
}

function EditMeasurementDialog({ open, onOpenChange, measurement, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurement: Measurement; onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<Measurement>>(measurement);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(measurement); }, [open, measurement]);

  const set = (key: keyof Measurement) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!measurement.id) return;
    setSaving(true);
    measurementApi.update(measurement.id, form)
      .then(() => { onOpenChange(false); onSaved(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {measurement.measurementNumber}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SelectField label="Type" value={form.measurementType} onChange={set("measurementType")} options={MEASUREMENT_TYPES} allowEmpty={false} />
            <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={MEASUREMENT_PRIORITIES} allowEmpty={false} />
            <TextField label="Measurement Date" type="date" value={form.measurementDate} onChange={set("measurementDate")} />
            <TextField label="Measured By" value={form.measuredBy} onChange={set("measuredBy")} />
            <TextField label="Verified By" value={form.verifiedBy} onChange={set("verifiedBy")} />
            <TextField label="Total Area (sq.ft)" type="number" value={form.totalArea} onChange={set("totalArea")} />
          </div>
          <TextAreaField label="Site Address" value={form.siteAddress} onChange={set("siteAddress")} rows={2} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextAreaField label="Remarks" value={form.remarks} onChange={set("remarks")} />
            <TextAreaField label="Internal Notes" value={form.internalNotes} onChange={set("internalNotes")} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ open, onOpenChange, measurementId, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; measurementId: number; onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    measurementApi.reject(measurementId, reason)
      .then(() => { onOpenChange(false); setReason(""); onSaved(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Request Revision</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextAreaField label="Reason" value={reason} onChange={setReason} placeholder="What needs to be corrected?" />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason.trim()}>{saving ? "Sending..." : "Request Revision"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
