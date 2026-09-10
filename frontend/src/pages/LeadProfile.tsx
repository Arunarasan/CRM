import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, Building, CheckCircle2, MoreVertical, Edit, XCircle,
  MessageCircle, Check, CalendarClock, CalendarPlus, TrendingUp, Crown, ArrowRight,
  LayoutGrid, ListChecks, Activity as ActivityIcon, FileText, Route, Clock, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { leadApi } from "./leads/leadApi";
import { toast } from "@/components/ui/toast";
import {
  LEAD_STATUSES, PRIORITY_STYLES, TEMPERATURE_STYLES,
  formatDate, formatINR, statusStyle,
  type Lead, type UserSummary, type LeadCreator,
} from "./leads/constants";
import { SelectField, TextAreaField, selectClass } from "./leads/fields";
import { useGoBack } from "@/hooks/useGoBack";
import LeadFormDialog from "./leads/LeadFormDialog";
import ConvertLeadDialog from "./leads/ConvertLeadDialog";
import { useLeadJourney, type JourneyStepId } from "./leads/journey";
import OverviewTab from "./leads/tabs/OverviewTab";
import EntityDailyReports from "@/components/hr/EntityDailyReports";
import SalesJourneyTab from "./leads/tabs/SalesJourneyTab";
import LeadTasksHub from "./leads/tabs/LeadTasksHub";
import ActivityTab from "./leads/tabs/ActivityTab";
import DocumentsTab from "./leads/tabs/DocumentsTab";
import TimelineTab from "./leads/tabs/TimelineTab";

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 whitespace-nowrap";

// The consolidated tab set. Old deep-links (?tab=measurements, ?tab=followups, …) still resolve
// to the new home so bookmarks and cross-page links keep working after the tab collapse.
const TABS = ["overview", "journey", "tasks", "activity", "documents", "timeline"] as const;
const LEGACY_TAB_MAP: Record<string, string> = {
  customer: "overview", requirements: "overview",
  sitevisits: "journey", measurements: "journey", boqs: "journey", quotations: "journey",
  projects: "journey", taskdata: "tasks",
  followups: "activity", communication: "activity", notes: "activity",
};
function normalizeTab(t: string) {
  return (TABS as readonly string[]).includes(t) ? t : LEGACY_TAB_MAP[t] || "overview";
}

type ActionIcon = React.ComponentType<{ className?: string }>;

// A labeled, tappable action in the header (icon tile + caption below).
function HeaderAction({
  icon: Icon, label, href, onClick, external, tone = "text-primary",
}: {
  icon: ActionIcon; label: string; href?: string; onClick?: () => void; external?: boolean; tone?: string;
}) {
  const tile = (
    <span className="flex flex-col items-center gap-1">
      <span className={`h-11 w-11 rounded-xl border bg-card shadow-sm grid place-items-center transition-colors group-hover:bg-accent ${tone}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
  return href
    ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="group">{tile}</a>
    : <button type="button" onClick={onClick} className="group">{tile}</button>;
}

// One at-a-glance metric tile in the header strip.
function StatTile({
  icon: Icon, label, value, hint, tone = "bg-primary/10 text-primary",
}: {
  icon: ActionIcon; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold leading-tight truncate">{value}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </div>
  );
}

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const goBack = useGoBack("/leads");
  const [lead, setLead] = useState<Lead | null>(null);
  const [creator, setCreator] = useState<LeadCreator | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(normalizeTab(searchParams.get("tab") || "overview"));
  // Set by the Next-Step banner to jump into the Journey tab and open the right stage.
  const [focusStep, setFocusStep] = useState<{ id: JourneyStepId; nonce: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  const fetchLead = useCallback(() => {
    if (!id) return;
    leadApi.get(id)
      .then((res) => setLead(res.data))
      .catch((err) => console.error("Failed to fetch lead", err))
      .finally(() => setLoading(false));
  }, [id]);

  const journey = useLeadJourney(id || "", lead);

  // The banner's action jumps to the Journey tab and opens the current stage.
  const goToNextStep = () => {
    if (journey.currentStep) setFocusStep({ id: journey.currentStep.id, nonce: Date.now() });
    setActiveTab("journey");
  };
  // Open a specific journey step (from the Overview "Next Step" card).
  const goToStep = (stepId: JourneyStepId) => {
    setFocusStep({ id: stepId, nonce: Date.now() });
    setActiveTab("journey");
  };

  useEffect(() => {
    fetchLead();
    leadApi.assignableUsers().then((res) => setUsers(res.data)).catch(console.error);
    if (id) leadApi.createdBy(id).then((res) => setCreator(res.data)).catch(() => setCreator(null));
  }, [fetchLead, id]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!lead || !id) return <div className="p-8 text-destructive">Failed to load lead profile.</div>;

  const isOpen = !lead.isConverted && !["Lost", "Cancelled"].includes(lead.status);
  const products = (lead.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
  const lastContact = lead.lastContactAt || lead.lastFollowUp;
  const fuDays = lead.nextFollowUpDate
    ? Math.ceil((new Date(lead.nextFollowUpDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;
  const fuHint = fuDays == null ? "Not scheduled"
    : fuDays < 0 ? `${-fuDays} day${fuDays === -1 ? "" : "s"} overdue`
    : fuDays === 0 ? "Today"
    : `${fuDays} day${fuDays === 1 ? "" : "s"} left`;

  // Click a header star to set the rating (or the current top star again to clear). Sends the full
  // lead with the new rating — updateLead is a full replace — mirroring the card save cleanup.
  const setRating = (star: number) => {
    if (!lead || !isOpen) return;
    const payload: any = { ...lead, rating: lead.rating === star ? null : star };
    ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue",
      "areaSqft", "expectedWorkArea", "floorCount"].forEach((k) => {
      if (payload[k] === "" || payload[k] == null) delete payload[k];
    });
    ["expectedStartDate", "expectedEndDate", "preferredCompletionDate", "nextFollowUpDate"].forEach((k) => {
      if (!payload[k]) delete payload[k];
    });
    if (payload.assignedSalesExecutive?.id) payload.assignedSalesExecutive = { id: payload.assignedSalesExecutive.id };
    else delete payload.assignedSalesExecutive;
    if (payload.assignedDesigner?.id) payload.assignedDesigner = { id: payload.assignedDesigner.id };
    else delete payload.assignedDesigner;
    if (payload.assignedEngineer?.id) payload.assignedEngineer = { id: payload.assignedEngineer.id };
    else delete payload.assignedEngineer;
    payload.rating = lead.rating === star ? null : star; // re-apply after cleanup (null passes through)
    delete payload.projectManager;
    delete payload.convertedToCustomer;
    delete payload.convertedToProject;
    delete payload.referredByCustomer;
    delete payload.referredByEmployee;
    leadApi.update(lead.id, payload)
      .then(() => { toast.success("Rating updated"); fetchLead(); })
      .catch((err) => {
        console.error("Failed to update rating", err);
        toast.error(err?.response?.data?.message || "Couldn't save the rating.");
      });
  };

  return (
    <div className="p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={goBack} title="Back"><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{lead.name}</h1>
              <span className="text-sm text-muted-foreground">{lead.leadNumber}</span>
              <button
                onClick={() => isOpen && setStatusOpen(true)}
                className={`px-2 py-1 text-xs rounded-full font-medium ${statusStyle(lead.status)} ${isOpen ? "hover:ring-1 hover:ring-primary cursor-pointer" : "cursor-default"}`}
                title={isOpen ? "Change status" : undefined}
              >
                {lead.status}
              </button>
              {lead.leadTemperature && (
                <span className={`px-2 py-1 text-xs rounded-full font-bold ${TEMPERATURE_STYLES[lead.leadTemperature] || ""}`}>
                  {lead.leadTemperature}
                </span>
              )}
              {lead.priority && (
                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${PRIORITY_STYLES[lead.priority] || ""}`}>
                  {lead.priority}
                </span>
              )}
              {lead.isConverted && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">CONVERTED</span>
              )}
              <span className="inline-flex items-center gap-0.5 ml-0.5" title={lead.rating ? `Rating ${lead.rating}/5` : "Rate this lead"}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    disabled={!isOpen}
                    aria-label={`Set rating ${s}`}
                    className={isOpen ? "hover:scale-110 transition-transform cursor-pointer" : "cursor-default"}
                  >
                    <Star className={`h-4 w-4 ${s <= (lead.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-1">
              {lead.companyName && <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {lead.companyName}</span>}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                  <Mail className="h-3 w-3" /> {lead.email}
                </a>
              )}
              {lead.mobileNumber && (
                <a href={`tel:${lead.mobileNumber}`} className="flex items-center gap-1 hover:text-green-600 transition-colors">
                  <Phone className="h-3 w-3" /> {lead.mobileNumber}
                </a>
              )}
              {lead.leadSource && <span>Source: {lead.leadSource}</span>}
              {(creator?.name || lead.leadOwner?.name) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
                  {creator?.fromEmployeePortal ? "Added by employee:" : "Added by:"} {creator?.name || lead.leadOwner?.name}
                  {creator?.employeeCode && <span className="text-emerald-600/80">· {creator.employeeCode}</span>}
                  {creator?.designation && <span className="text-emerald-600/60">· {creator.designation}</span>}
                </span>
              )}
            </div>
            {(products.length > 0 || lead.requirementCategory) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {lead.requirementCategory && (
                  <span className="text-xs text-muted-foreground">{lead.requirementCategory}:</span>
                )}
                {products.map((p) => (
                  <span key={p} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{p}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isOpen && (
            <>
              <Button onClick={() => setConvertOpen(true)} className="bg-green-600 hover:bg-green-700 text-white rounded-full shadow-sm">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Convert to Project
              </Button>
              <div className="flex items-center gap-2">
                {lead.mobileNumber && <HeaderAction icon={Phone} label="Call" href={`tel:${lead.mobileNumber}`} tone="text-emerald-600" />}
                {(lead.whatsappNumber || lead.mobileNumber) && (
                  <HeaderAction icon={MessageCircle} label="WhatsApp" external
                    href={`https://wa.me/${(lead.whatsappNumber || lead.mobileNumber).replace(/[^0-9]/g, "")}`} tone="text-green-600" />
                )}
                {lead.email && <HeaderAction icon={Mail} label="Email" href={`mailto:${lead.email}`} tone="text-orange-500" />}
                <HeaderAction icon={CalendarPlus} label="Add Task" onClick={() => setActiveTab("tasks")} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditOpen(true)}><Edit className="h-4 w-4 mr-2" /> Edit Lead</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAssignOpen(true)}><Check className="h-4 w-4 mr-2" /> Assign Team</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusOpen(true)}><CheckCircle2 className="h-4 w-4 mr-2" /> Change Status</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLostOpen(true)} className="text-destructive"><XCircle className="h-4 w-4 mr-2" /> Mark as Lost</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {lead.isConverted && lead.convertedToCustomer && (
            <Link to={`/customers/${lead.convertedToCustomer.id}`}>
              <Button variant="outline">View Customer</Button>
            </Link>
          )}
          {lead.isConverted && lead.convertedToProject && (
            <Link to={`/projects/${lead.convertedToProject.id}`}>
              <Button variant="outline">View Project</Button>
            </Link>
          )}
        </div>
      </div>

      {/* At-a-glance metric tiles + the "what's next" convert CTA. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={CalendarClock}
          label="Next Follow-up"
          value={lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : "—"}
          hint={<span className={fuDays != null && fuDays < 0 ? "text-red-500 font-medium" : fuDays === 0 ? "text-emerald-600 font-medium" : ""}>{fuHint}</span>}
          tone="bg-amber-50 text-amber-500"
        />
        <StatTile
          icon={Phone}
          label="Last Contact"
          value={lastContact ? formatDate(lastContact) : "—"}
          hint={lastContact ? "Most recent touchpoint" : "No contact yet"}
          tone="bg-sky-50 text-sky-500"
        />
        <StatTile
          icon={TrendingUp}
          label="Expected Value"
          value={lead.expectedProjectValue ? formatINR(lead.expectedProjectValue) : formatINR(lead.estimatedBudget)}
          hint={lead.expectedProjectValue || lead.estimatedBudget ? "Projected deal size" : "Not estimated"}
          tone="bg-violet-50 text-violet-500"
        />
        {isOpen ? (
          <button
            type="button"
            onClick={goToNextStep}
            className="group text-left rounded-2xl p-4 bg-gradient-to-br from-primary to-primary/75 text-primary-foreground shadow-sm flex items-center gap-3"
          >
            <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-tight">Potential Customer</div>
              <div className="text-xs opacity-90 mt-0.5">Take the next step and convert this lead to a project.</div>
            </div>
            <ArrowRight className="h-5 w-5 opacity-80 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ) : (
          <StatTile icon={CheckCircle2} label="Status" value={lead.status} hint={lead.isConverted ? "Converted" : undefined} />
        )}
      </div>

      {/* Tabs — the 15-tab pipeline is collapsed into 5 task-shaped groups. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0 space-x-6 min-w-max flex">
            {([
              ["overview", "Overview", LayoutGrid], ["tasks", "Tasks", ListChecks],
              ["activity", "Activity", ActivityIcon], ["documents", "Documents", FileText],
              ["journey", "Sales Journey", Route], ["timeline", "Timeline", Clock],
            ] as const).map(([value, label, Icon]) => (
              <TabsTrigger key={value} value={value} className={TAB_TRIGGER_CLASS}>
                <span className="flex items-center gap-1.5"><Icon className="h-4 w-4" /> {label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-4">
            <OverviewTab lead={lead} users={users} canEdit={isOpen} journey={journey} onGoStep={goToStep} onChanged={fetchLead} />
          </TabsContent>

          <TabsContent value="journey">
            <SalesJourneyTab
              leadId={id}
              lead={lead}
              users={users}
              journey={journey}
              focusStep={focusStep}
              onChanged={() => { fetchLead(); journey.reload(); }}
              onEditRequirement={() => setEditOpen(true)}
              onConvert={() => setConvertOpen(true)}
            />
          </TabsContent>
          <TabsContent value="tasks">
            <LeadTasksHub leadId={id} users={users} />
          </TabsContent>
          <TabsContent value="activity" className="space-y-4">
            <ActivityTab leadId={id} onChanged={fetchLead} />
            <EntityDailyReports leadId={Number(id)} title="Field Daily Reports for this Lead" />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab leadId={id} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab leadId={id} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Dialogs */}
      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} users={users} onSaved={() => fetchLead()} />
      <ConvertLeadDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />
      <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} lead={lead} onChanged={fetchLead} />
      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} lead={lead} users={users} onChanged={fetchLead} />
      <MarkLostDialog open={lostOpen} onOpenChange={setLostOpen} lead={lead} onChanged={fetchLead} />
    </div>
  );
}

function StatusDialog({
  open, onOpenChange, lead, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; onChanged: () => void }) {
  const [status, setStatus] = useState(lead.status);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setStatus(lead.status); setRemarks(""); } }, [open, lead.status]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.updateStatus(lead.id, status, remarks || undefined)
      .then(() => { onOpenChange(false); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SelectField label="Status" value={status} onChange={setStatus} options={LEAD_STATUSES} allowEmpty={false} />
          <TextAreaField label="Remarks" value={remarks} onChange={setRemarks} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Updating..." : "Update Status"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  open, onOpenChange, lead, users, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; users: UserSummary[]; onChanged: () => void }) {
  const [role, setRole] = useState("Sales Executive");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    leadApi.assign(lead.id, Number(userId), role)
      .then(() => { onOpenChange(false); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Assign Team Member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SelectField label="Role" value={role} onChange={setRole}
            options={["Sales Executive", "Designer", "Engineer", "Project Manager"]} allowEmpty={false} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Employee</label>
            <select className={selectClass} required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select employee...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !userId}>{saving ? "Assigning..." : "Assign"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MarkLostDialog({
  open, onOpenChange, lead, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.markLost(lead.id, { reason, competitor: competitor || undefined, feedback: feedback || undefined })
      .then(() => { onOpenChange(false); onChanged(); })
      .catch(console.error)
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark Lead as Lost</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <SelectField label="Reason" value={reason} onChange={setReason} required
            options={["Budget too high", "Chose competitor", "Project postponed", "Not reachable", "Requirement dropped", "Location not serviceable", "Other"]} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Competitor (if any)</label>
            <input className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={competitor} onChange={(e) => setCompetitor(e.target.value)} />
          </div>
          <TextAreaField label="Customer Feedback" value={feedback} onChange={setFeedback} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving || !reason}>
              {saving ? "Saving..." : "Mark as Lost"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
