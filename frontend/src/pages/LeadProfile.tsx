import { BaseInput } from '@/components/ui/input';
import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, MoreHorizontal, Edit, XCircle, Check, CalendarClock, CalendarPlus,
  LayoutGrid, ListChecks, Activity as ActivityIcon, FileText, Route, Clock, Star, RotateCcw,
  ChevronRight, Home, ClipboardList, Calculator, Rocket, UserPlus, FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { leadApi } from "./leads/leadApi";
import { toast } from "@/components/ui/toast";
import {
  LEAD_STATUSES,
  formatDate, statusStyle,
  type Lead, type UserSummary, type LeadCreator,
} from "./leads/constants";
import { SelectField, TextAreaField, selectClass } from "./leads/fields";
import { useGoBack } from "@/hooks/useGoBack";
import LeadFormDialog from "./leads/LeadFormDialog";
import ConvertLeadDialog from "./leads/ConvertLeadDialog";
import { useLeadJourney, type JourneyStepId } from "./leads/journey";
import { LeadInfoRow, LeadJourneyBar } from "./leads/LeadHeader";
import OverviewTab from "./leads/tabs/OverviewTab";
import EntityDailyReports from "@/components/hr/EntityDailyReports";
import SalesJourneyTab from "./leads/tabs/SalesJourneyTab";
import LeadTasksHub from "./leads/tabs/LeadTasksHub";
import ActivityTab from "./leads/tabs/ActivityTab";
import DocumentsTab from "./leads/tabs/DocumentsTab";
import TimelineTab from "./leads/tabs/TimelineTab";

// The consolidated tab set, in working order: read the lead → do the sales work → everything else.
// Old deep-links (?tab=measurements, ?tab=followups, …) still resolve to their new home.
const TABS = ["overview", "journey", "tasks", "activity", "documents", "timeline"] as const;
const TAB_ITEMS: [string, string, React.ComponentType<{ className?: string }>][] = [
  ["overview", "Overview", LayoutGrid], ["journey", "Sales Journey", Route], ["tasks", "Tasks", ListChecks],
  ["activity", "Activity", ActivityIcon], ["documents", "Documents", FileText], ["timeline", "Timeline", Clock],
];
const LEGACY_TAB_MAP: Record<string, string> = {
  customer: "overview", requirements: "overview",
  sitevisits: "journey", measurements: "journey", boqs: "journey", quotations: "journey",
  projects: "journey", taskdata: "tasks",
  followups: "activity", communication: "activity", notes: "activity",
};
function normalizeTab(t: string) {
  return (TABS as readonly string[]).includes(t) ? t : LEGACY_TAB_MAP[t] || "overview";
}

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide";

type PrimaryAction =
  | { kind: "button"; label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void }
  | { kind: "link"; label: string; icon: React.ComponentType<{ className?: string }>; to: string };

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const goBack = useGoBack("/leads");
  const [lead, setLead] = useState<Lead | null>(null);
  const [creator, setCreator] = useState<LeadCreator | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTabState] = useState(normalizeTab(searchParams.get("tab") || "overview"));
  // The open tab lives in ?tab= too, so in-page links (e.g. the Quote's "Drawings & photos") can switch it.
  const tabParam = searchParams.get("tab");
  useEffect(() => { if (tabParam) setActiveTabState(normalizeTab(tabParam)); }, [tabParam]);
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setSearchParams((p) => { p.set("tab", tab); return p; }, { replace: true });
  };
  // Set by the header (journey bar / primary action) to jump into the Journey tab at the right stage.
  const [focusStep, setFocusStep] = useState<{ id: JourneyStepId; nonce: number } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [winBackOpen, setWinBackOpen] = useState(false);

  const fetchLead = useCallback(() => {
    if (!id) return;
    leadApi.get(id)
      .then((res) => setLead(res.data))
      .catch((err) => console.error("Failed to fetch lead", err))
      .finally(() => setLoading(false));
  }, [id]);

  const journey = useLeadJourney(id || "", lead);

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
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-2.5">
          <Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-16 rounded-2xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!lead || !id) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-destructive font-medium">Couldn't load this lead.</p>
        <Button variant="outline" onClick={goBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back to leads</Button>
      </div>
    );
  }

  const isOpen = !lead.isConverted && !["Lost", "Cancelled"].includes(lead.status);
  const isLost = lead.status === "Lost";
  const canReopen = isLost && lead.canReopen !== false;
  const addedBy = creator?.name || lead.leadOwner?.name;
  const project = lead.convertedToProject || journey.records.projects[0];

  // One primary action, chosen by where the deal really is (from records, not the status dropdown).
  const primary: PrimaryAction | null = (() => {
    if (isOpen && journey.currentStep) {
      switch (journey.currentStep.id) {
        case "requirement": return { kind: "button", label: "Add requirement", icon: ClipboardList, onClick: () => setEditOpen(true) };
        case "quote": return { kind: "button", label: journey.currentStep.actionLabel, icon: Calculator, onClick: () => goToStep("quote") };
        case "convert": return { kind: "button", label: "Create Project", icon: Rocket, onClick: () => goToStep("quote") };
      }
    }
    if (project?.id) return { kind: "link", label: "View Project", icon: FolderKanban, to: `/projects/${project.id}` };
    if (canReopen) return { kind: "button", label: "Reopen Lead", icon: RotateCcw, onClick: () => setReopenOpen(true) };
    return null;
  })();

  const renderPrimary = (compact = false) => {
    if (!primary) return null;
    const Icon = primary.icon;
    const cls = compact
      ? "h-8 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white shrink-0"
      : "h-11 flex-1 @2xl:flex-none whitespace-nowrap rounded-xl bg-emerald-800 hover:bg-emerald-900 px-5 font-semibold text-white shadow-[0_4px_14px_-4px_rgba(0,53,34,0.45)] transition hover:-translate-y-px";
    const inner = <><Icon className={`w-4 h-4 ${compact ? "mr-1.5" : "mr-2"}`} /> {primary.label}</>;
    return primary.kind === "link"
      ? <Button asChild size={compact ? "sm" : "default"} className={cls}><Link to={primary.to}>{inner}</Link></Button>
      : <Button size={compact ? "sm" : "default"} className={cls} disabled={journey.loading && isOpen} onClick={primary.onClick}>{inner}</Button>;
  };

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
    <div className="flex flex-col h-full bg-slate-50/50 relative overflow-hidden animate-in fade-in">
      {/* One scroll surface: the header scrolls away, the tab strip pins with a compact header. */}
      <div onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 140)} className="flex-1 overflow-y-auto scroll-smooth @container">

        {/* Breadcrumb */}
        <div className="px-4 sm:px-6 lg:px-8 pt-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link to="/" className="hover:text-emerald-600 flex items-center" aria-label="Home"><Home className="w-3.5 h-3.5" /></Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link to="/leads" className="hover:text-emerald-600">Leads</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-600 font-medium truncate">{lead.name}</span>
          </nav>
        </div>

        {/* Header band */}
        <div className="px-4 sm:px-6 lg:px-8 pt-2">
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-white to-emerald-50/60 px-4 sm:px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <button type="button" onClick={goBack} title="Back" aria-label="Back"
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:text-slate-900 hover:border-slate-300">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="min-w-0 max-w-full text-xl sm:text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900 truncate">{lead.name}</h1>
                    <button
                      type="button"
                      onClick={() => isOpen && setStatusOpen(true)}
                      disabled={!isOpen}
                      title={isOpen ? "Change status" : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(lead.status)} ${isOpen ? "hover:ring-1 hover:ring-emerald-400 cursor-pointer" : "cursor-default"}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {lead.status}
                    </button>
                    {lead.isConverted && <span className={`${PILL} bg-emerald-100 text-emerald-800`}><CheckCircle2 className="h-3 w-3" /> Converted</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-mono">{lead.leadNumber}</span>
                    {lead.companyName && <span>· {lead.companyName}</span>}
                    {lead.leadSource && <span>· via {lead.leadSource}</span>}
                    <span className="inline-flex items-center gap-0.5 ml-1" title={lead.rating ? `Rating ${lead.rating}/5` : "Rate this lead"}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} type="button" onClick={() => setRating(s)} disabled={!isOpen}
                          aria-label={`Set rating ${s} of 5`}
                          className={isOpen ? "hover:scale-110 transition-transform" : "cursor-default"}>
                          <Star className={`h-3.5 w-3.5 ${s <= (lead.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                        </button>
                      ))}
                    </span>
                  </div>
                  <div className="-ml-[52px] @xl:ml-0"><LeadInfoRow lead={lead} addedBy={addedBy} /></div>
                </div>
              </div>

              <div className="flex flex-col @2xl:flex-row @2xl:flex-wrap @4xl:flex-col items-stretch @2xl:items-center @4xl:items-end gap-3 min-w-0">
                <div className="flex items-center gap-2 @2xl:order-2 @4xl:order-none @2xl:ml-auto @4xl:ml-0">
                  {isLost && (
                    <Button variant="outline" onClick={() => setWinBackOpen(true)}
                      className="h-11 rounded-xl border-slate-200 bg-white px-4 font-semibold text-slate-700">
                      <CalendarClock className="w-4 h-4 mr-2" /> {lead.winBackDate ? "Change win-back" : "Plan win-back"}
                    </Button>
                  )}
                  {lead.isConverted && lead.convertedToCustomer && (
                    <Button asChild variant="outline" className="h-11 rounded-xl border-slate-200 bg-white px-4 font-semibold text-slate-700">
                      <Link to={`/customers/${lead.convertedToCustomer.id}`}>View Customer</Link>
                    </Button>
                  )}
                  {isOpen && (
                    <Button variant="outline" title="Edit lead" onClick={() => setEditOpen(true)}
                      className="h-11 shrink-0 rounded-xl border-slate-200 bg-white px-3.5 @lg:px-4 text-slate-700 font-semibold">
                      <Edit className="w-4 h-4 @lg:mr-2" /> <span className="hidden @lg:inline">Edit</span>
                    </Button>
                  )}
                  {renderPrimary()}
                  {isOpen && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="More actions" className="h-11 w-11 shrink-0 rounded-xl border-slate-200 text-slate-600 bg-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setAssignOpen(true)}><Check className="h-4 w-4 mr-2" /> Assign team</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStatusOpen(true)}><CheckCircle2 className="h-4 w-4 mr-2" /> Change status</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setActiveTab("tasks")}><CalendarPlus className="h-4 w-4 mr-2" /> Add task</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setConvertOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Convert to customer only</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setLostOpen(true)} className="text-destructive"><XCircle className="h-4 w-4 mr-2" /> Mark as lost</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isLost
            ? <div className="mt-3"><LostBanner lead={lead} onPlan={() => setWinBackOpen(true)} /></div>
            : <LeadJourneyBar journey={journey} onOpen={goToStep} />}
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-3 bg-slate-50/95 backdrop-blur-sm space-y-2">
              {/* Compact header — slides in once the big header scrolls away, so the lead stays identifiable. */}
              <div className={`flex items-center justify-between gap-2 overflow-hidden transition-all duration-300 ${scrolled ? "max-h-14 opacity-100" : "max-h-0 opacity-0"}`} aria-hidden={!scrolled}>
                <div className="flex items-center gap-2 min-w-0">
                  <button type="button" onClick={goBack} title="Back" tabIndex={scrolled ? 0 : -1} className="text-slate-400 hover:text-slate-600 shrink-0"><ArrowLeft className="h-4 w-4" /></button>
                  <span className="font-bold text-slate-800 truncate">{lead.name}</span>
                  {lead.city && <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">· {lead.city}</span>}
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold shrink-0 ${statusStyle(lead.status)}`}>{lead.status}</span>
                </div>
                {scrolled && renderPrimary(true)}
              </div>
              <div role="tablist" aria-label="Lead sections"
                className="bg-white p-1.5 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] rounded-2xl flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {TAB_ITEMS.map(([value, label, Icon]) => {
                  const active = value === activeTab;
                  return (
                    <button key={value} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(value)}
                      className={`rounded-xl px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-2 shrink-0 ${active ? "bg-emerald-800 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <TabsContent value="overview" className="mt-0">
              <OverviewTab lead={lead} users={users} canEdit={isOpen} onChanged={fetchLead} />
            </TabsContent>
            <TabsContent value="journey" className="mt-0">
              <SalesJourneyTab
                leadId={id}
                lead={lead}
                users={users}
                journey={journey}
                focusStep={focusStep}
                onChanged={() => { fetchLead(); journey.reload(); }}
                onEditRequirement={() => setEditOpen(true)}
                onConvert={() => goToStep("quote")}
              />
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <LeadTasksHub leadId={id} users={users} />
            </TabsContent>
            <TabsContent value="activity" className="mt-0 space-y-4">
              <ActivityTab leadId={id} onChanged={fetchLead} />
              <EntityDailyReports leadId={Number(id)} title="Field Daily Reports for this Lead" />
            </TabsContent>
            <TabsContent value="documents" className="mt-0">
              <DocumentsTab leadId={id} />
            </TabsContent>
            <TabsContent value="timeline" className="mt-0">
              <TimelineTab leadId={id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} users={users} onSaved={() => fetchLead()} />
      <ConvertLeadDialog open={convertOpen} onOpenChange={setConvertOpen} lead={lead} />
      <StatusDialog open={statusOpen} onOpenChange={setStatusOpen} lead={lead} onChanged={fetchLead} />
      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} lead={lead} users={users} onChanged={fetchLead} />
      <MarkLostDialog open={lostOpen} onOpenChange={setLostOpen} lead={lead} onChanged={fetchLead} />
      <WinBackDialog open={winBackOpen} onOpenChange={setWinBackOpen} lead={lead} onChanged={fetchLead} />
      <ReopenDialog open={reopenOpen} onOpenChange={setReopenOpen} lead={lead} users={users} onChanged={fetchLead} />
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
  const [winBackDate, setWinBackDate] = useState("");
  const [winBackNote, setWinBackNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setCompetitor(""); setFeedback(""); setWinBackDate(""); setWinBackNote(""); }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.markLost(lead.id, {
      reason, competitor: competitor || undefined, feedback: feedback || undefined,
      winBackDate: winBackDate || undefined, winBackNote: winBackDate && winBackNote ? winBackNote : undefined,
    })
      .then(() => {
        toast.success(winBackDate ? `Marked lost · win-back on ${formatDate(winBackDate)}` : "Lead marked as lost");
        onOpenChange(false); onChanged();
      })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't mark the lead as lost."))
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
            <BaseInput className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={competitor} onChange={(e) => setCompetitor(e.target.value)} />
          </div>
          <TextAreaField label="Customer Feedback" value={feedback} onChange={setFeedback} />
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="text-sm font-medium">Try again later? <span className="font-normal text-muted-foreground">(optional)</span></div>
            <WinBackPicker date={winBackDate} onDate={setWinBackDate} allowNone />
            {winBackDate && (
              <BaseInput className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500} placeholder="What to try next time (e.g. new budget range, festive offer)"
                value={winBackNote} onChange={(e) => setWinBackNote(e.target.value)} />
            )}
          </div>
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

// ---------------------------------------------------------------------------------------------------
// Lost lead: summary banner, win-back planning and reopen.
// ---------------------------------------------------------------------------------------------------

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthsFromToday = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return isoDay(d); };
const daysUntil = (iso: string) =>
  Math.round((new Date(iso + "T00:00:00").getTime() - new Date(isoDay(new Date()) + "T00:00:00").getTime()) / 86400000);

const WIN_BACK_PRESETS: [string, number][] = [["1 month", 1], ["3 months", 3], ["6 months", 6], ["1 year", 12]];

/** Quick win-back presets plus a date field. `allowNone` adds a "Not now" chip that clears the date. */
function WinBackPicker({ date, onDate, allowNone }: { date: string; onDate: (d: string) => void; allowNone?: boolean }) {
  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"}`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {allowNone && <button type="button" className={chip(!date)} onClick={() => onDate("")}>Not now</button>}
        {WIN_BACK_PRESETS.map(([label, m]) => {
          const v = monthsFromToday(m);
          return <button key={label} type="button" className={chip(date === v)} onClick={() => onDate(v)}>In {label}</button>;
        })}
      </div>
      <BaseInput type="date" min={isoDay(new Date())} value={date} onChange={(e) => onDate(e.target.value)}
        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}

function LostBanner({ lead, onPlan }: { lead: Lead; onPlan: () => void }) {
  const days = lead.winBackDate ? daysUntil(lead.winBackDate) : null;
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 grid place-items-center shrink-0">
          <XCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 text-sm">
          <div className="font-semibold text-red-700">Lost{lead.lostReason ? ` · ${lead.lostReason}` : ""}</div>
          {lead.competitor && <div className="text-muted-foreground">Went with: {lead.competitor}</div>}
          {lead.customerFeedback && <div className="text-muted-foreground italic">"{lead.customerFeedback}"</div>}
          {lead.canReopen === false && <div className="text-xs text-muted-foreground mt-1">This lead is marked as not reopenable.</div>}
        </div>
      </div>
      <button type="button" onClick={onPlan}
        className="text-left rounded-xl border bg-card px-3 py-2 hover:bg-accent transition-colors min-w-[200px]">
        <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Win-back</div>
        {lead.winBackDate && days != null ? (
          <>
            <div className="font-semibold">{formatDate(lead.winBackDate)}</div>
            <div className={`text-xs ${days <= 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              {days < 0 ? "Due — try them again now" : days === 0 ? "Due today" : `in ${days} day${days === 1 ? "" : "s"}`}
            </div>
            {lead.winBackNote && <div className="text-xs text-muted-foreground truncate max-w-[260px]">{lead.winBackNote}</div>}
          </>
        ) : (
          <div className="font-medium text-muted-foreground">Not planned — set a date</div>
        )}
      </button>
    </div>
  );
}

function WinBackDialog({
  open, onOpenChange, lead, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; onChanged: () => void }) {
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setDate(lead.winBackDate || monthsFromToday(3)); setNote(lead.winBackNote || ""); }
  }, [open, lead.winBackDate, lead.winBackNote]);

  const save = (clear: boolean) => {
    setSaving(true);
    leadApi.scheduleWinBack(lead.id, clear ? {} : { date, note: note || undefined })
      .then(() => {
        toast.success(clear ? "Win-back plan cleared" : `Win-back reminder set for ${formatDate(date)}`);
        onOpenChange(false); onChanged();
      })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't save the win-back plan."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Plan Win-back</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (date) save(false); }} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick when to try {lead.name} again. A reminder task is created for that day and the sales executive is notified.
          </p>
          <WinBackPicker date={date} onDate={setDate} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What to try</label>
            <BaseInput className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={500} placeholder="e.g. offer the new budget range" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            {lead.winBackDate
              ? <Button type="button" variant="ghost" className="text-destructive" disabled={saving} onClick={() => save(true)}>Clear plan</Button>
              : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !date}>{saving ? "Saving..." : "Set Reminder"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const REOPEN_STATUSES = LEAD_STATUSES.filter((st) => !["Lost", "Cancelled", "Completed"].includes(st));

function ReopenDialog({
  open, onOpenChange, lead, users, onChanged,
}: { open: boolean; onOpenChange: (o: boolean) => void; lead: Lead; users: UserSummary[]; onChanged: () => void }) {
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const currentExec = lead.assignedSalesExecutive?.id;

  useEffect(() => {
    if (open) {
      setStatus(""); setRemarks("");
      setAssigneeId(currentExec ? String(currentExec) : "");
      const t = new Date(); t.setDate(t.getDate() + 1); setFollowUpDate(isoDay(t));
    }
  }, [open, currentExec]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    leadApi.reopen(lead.id, {
      status: status || undefined,
      remarks,
      assigneeId: assigneeId && Number(assigneeId) !== currentExec ? Number(assigneeId) : undefined,
      followUpDate: followUpDate || undefined,
    })
      .then(() => { toast.success("Lead reopened — back in the pipeline"); onOpenChange(false); onChanged(); })
      .catch((err) => toast.error(err?.response?.data?.message || "Couldn't reopen the lead."))
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reopen Lead</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextAreaField label="Why reopen? *" value={remarks} onChange={setRemarks} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Move to</label>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Where it left off (status before it was lost)</option>
              {REOPEN_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sales executive</label>
            <select className={selectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Keep as is</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Next follow-up</label>
            <BaseInput type="date" min={isoDay(new Date())} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <p className="text-xs text-muted-foreground">A follow-up reminder is created for this day. Leave empty to skip.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !remarks.trim()}>
              <RotateCcw className="mr-2 h-4 w-4" /> {saving ? "Reopening..." : "Reopen Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
