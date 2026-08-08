import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, Building, CheckCircle2, MoreVertical, Edit, XCircle,
  MessageCircle, MapPin, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { leadApi } from "./leads/leadApi";
import {
  LEAD_STAGES, LEAD_STATUSES, PRIORITY_STYLES, TEMPERATURE_STYLES,
  formatDate, formatDateTime, formatINR, statusStyle,
  type Lead, type UserSummary,
} from "./leads/constants";
import { SelectField, TextAreaField, selectClass } from "./leads/fields";
import LeadFormDialog from "./leads/LeadFormDialog";
import ConvertLeadDialog from "./leads/ConvertLeadDialog";
import FollowUpsTab from "./leads/tabs/FollowUpsTab";
import CommunicationsTab from "./leads/tabs/CommunicationsTab";
import SiteVisitsTab from "./leads/tabs/SiteVisitsTab";
import MeasurementsTab from "./leads/tabs/MeasurementsTab";
import BoqTab from "./leads/tabs/BoqTab";
import QuotationsTab from "./leads/tabs/QuotationsTab";
import ProjectsTab from "./leads/tabs/ProjectsTab";
import TasksTab from "./leads/tabs/TasksTab";
import DocumentsTab from "./leads/tabs/DocumentsTab";
import NotesTab from "./leads/tabs/NotesTab";
import TimelineTab from "./leads/tabs/TimelineTab";

function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 whitespace-nowrap";

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchLead();
    leadApi.assignableUsers().then((res) => setUsers(res.data)).catch(console.error);
  }, [fetchLead]);

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
  const currentStageIndex = LEAD_STAGES.indexOf(lead.stage || "New Lead");

  return (
    <div className="p-6 lg:p-8 space-y-5 h-full bg-background flex flex-col overflow-y-auto animate-in fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link to="/leads">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
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
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isOpen && (
            <>
              <Button onClick={() => setConvertOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Convert
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
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

      {/* Stage progress tracker */}
      <div className="bg-card border rounded-xl p-4 md:p-5 shadow-sm">
        <div className="flex justify-between items-start w-full max-w-6xl mx-auto">
          {LEAD_STAGES.map((stage, index) => {
            const done = index < currentStageIndex;
            const current = index === currentStageIndex;
            return (
              <div key={stage} className="flex-1 relative">
                <div className="flex flex-col items-center relative z-10">
                  <div className={`h-8 w-8 md:h-10 md:w-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 transition-colors bg-background shrink-0
                    ${done ? "bg-primary border-primary text-primary-foreground"
                      : current ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground"}`}>
                    {done ? <Check className="h-4 w-4 md:h-5 md:w-5" /> : index + 1}
                  </div>
                  <div className="h-10 flex items-start justify-center mt-2 w-full">
                    <span className={`text-[9px] md:text-xs whitespace-normal text-center leading-tight px-1 ${current ? "font-bold text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                      {stage}
                    </span>
                  </div>
                </div>
                {index < LEAD_STAGES.length - 1 && (
                  <div className={`absolute top-4 md:top-5 left-1/2 w-full h-[2px] z-0 
                    ${index < currentStageIndex ? "bg-primary" : "bg-muted-foreground/20"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 bg-card p-2 rounded-xl border shadow-sm">
        <Button variant="ghost" size="sm" asChild>
          <a href={`tel:${lead.mobileNumber}`}><Phone className="h-4 w-4 mr-2 text-blue-500" /> Call</a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={`https://wa.me/${(lead.whatsappNumber || lead.mobileNumber)?.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-4 w-4 mr-2 text-green-500" /> WhatsApp
          </a>
        </Button>
        {lead.email && (
          <Button variant="ghost" size="sm" asChild>
            <a href={`mailto:${lead.email}`}><Mail className="h-4 w-4 mr-2 text-orange-500" /> Email</a>
          </Button>
        )}
        {lead.googleMapLocation && (
          <Button variant="ghost" size="sm" asChild>
            <a href={lead.googleMapLocation} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4 mr-2 text-red-500" /> Location</a>
          </Button>
        )}
        <div className="ml-auto flex items-center gap-4 px-3 text-sm">
          <span className="text-muted-foreground">Budget: <span className="font-semibold text-foreground">{formatINR(lead.estimatedBudget)}</span></span>
          <span className="text-muted-foreground">Next follow-up: <span className="font-semibold text-foreground">{formatDate(lead.nextFollowUpDate)}</span></span>
          <span className="text-muted-foreground">Last contact: <span className="font-semibold text-foreground">{formatDate(lead.lastContactAt || lead.lastFollowUp)}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0 space-x-5 min-w-max flex">
            {[
              ["overview", "Overview"], ["customer", "Customer"], ["requirements", "Requirements"],
              ["followups", "Follow-ups"], ["communication", "Communication"], ["sitevisits", "Site Visits"],
              ["measurements", "Measurements"], ["boqs", "BOQs"], ["quotations", "Quotations"], ["projects", "Projects"], ["tasks", "Tasks"],
              ["documents", "Documents"], ["notes", "Notes"], ["timeline", "Timeline"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className={TAB_TRIGGER_CLASS}>{label}</TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Lead Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Lead Source" value={lead.leadSource} />
                <InfoItem label="Lead Type" value={lead.leadType} />
                <InfoItem label="Stage" value={lead.stage} />
                <InfoItem label="Temperature" value={lead.leadTemperature} />
                <InfoItem label="Estimated Budget" value={<span className="text-lg">{formatINR(lead.estimatedBudget)}</span>} />
                <InfoItem label="Expected Project Value" value={formatINR(lead.expectedProjectValue)} />
                <InfoItem label="Expected Start" value={formatDate(lead.expectedStartDate)} />
                <InfoItem label="Expected Completion" value={formatDate(lead.expectedEndDate)} />
                <InfoItem label="Follow-ups Logged" value={lead.followUpCount ?? 0} />
                <InfoItem label="Next Follow-up" value={formatDate(lead.nextFollowUpDate)} />
                <InfoItem label="Created" value={formatDateTime(lead.createdAt)} />
                <InfoItem label="Created By" value={lead.createdBy} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Team</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Sales Executive" value={lead.assignedSalesExecutive?.name || "Unassigned"} />
                <InfoItem label="Designer" value={lead.assignedDesigner?.name || "Unassigned"} />
                <InfoItem label="Engineer" value={lead.assignedEngineer?.name || "Unassigned"} />
                <InfoItem label="Project Manager" value={lead.projectManager?.name || "Unassigned"} />
              </CardContent>
            </Card>
            {lead.status === "Lost" && (
              <Card className="border-destructive/40">
                <CardHeader><CardTitle className="text-destructive">Lost Lead Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <InfoItem label="Reason" value={lead.lostReason} />
                  <InfoItem label="Competitor" value={lead.competitor} />
                  <InfoItem label="Customer Feedback" value={lead.customerFeedback} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="customer" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Customer Name" value={lead.name} />
                <InfoItem label="Company" value={lead.companyName} />
                <InfoItem label="Contact Person" value={lead.contactPerson} />
                <InfoItem label="Primary Mobile" value={lead.mobileNumber} />
                <InfoItem label="Alternative Mobile" value={lead.alternateMobile} />
                <InfoItem label="WhatsApp" value={lead.whatsappNumber} />
                <InfoItem label="Email" value={lead.email} />
                <InfoItem label="GST Number" value={lead.gstNumber} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Address</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="col-span-2"><InfoItem label="Address" value={lead.address} /></div>
                <InfoItem label="City" value={lead.city} />
                <InfoItem label="District" value={lead.district} />
                <InfoItem label="State" value={lead.state} />
                <InfoItem label="Pincode" value={lead.pincode} />
                <div className="col-span-2"><InfoItem label="Project / Site Address" value={lead.siteAddress} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <InfoItem label="Property Type" value={lead.propertyType} />
                <InfoItem label="Construction Status" value={lead.currentConstructionStage} />
                <InfoItem label="Floors" value={lead.floorCount} />
                <InfoItem label="Area (sq.ft)" value={lead.areaSqft} />
                <InfoItem label="Design Style" value={lead.preferredDesignStyle} />
                <InfoItem label="Preferred Materials" value={lead.preferredMaterial} />
                <InfoItem label="Color Theme" value={lead.preferredColorTheme} />
                <InfoItem label="Duration" value={lead.estimatedDuration} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Scope of Work</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Modular Kitchen", lead.reqKitchen], ["Wardrobe", lead.reqWardrobe], ["TV Unit", lead.reqTvUnit],
                    ["False Ceiling", lead.reqFalseCeiling], ["Painting", lead.reqPainting], ["Flooring", lead.reqFlooring],
                    ["Electrical", lead.reqElectrical], ["Plumbing", lead.reqPlumbing], ["Wood Finish", lead.reqWoodFinish],
                  ].filter(([, v]) => v).map(([label]) => (
                    <span key={label as string} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
                      ✓ {label}
                    </span>
                  ))}
                  {![lead.reqKitchen, lead.reqWardrobe, lead.reqTvUnit, lead.reqFalseCeiling, lead.reqPainting,
                    lead.reqFlooring, lead.reqElectrical, lead.reqPlumbing, lead.reqWoodFinish].some(Boolean) && (
                    <span className="text-sm text-muted-foreground">No scope items selected.</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Rooms Required" value={lead.roomsRequired} />
                  <InfoItem label="Special Requests" value={lead.specialRequests} />
                </div>
                <InfoItem label="Requirement Description" value={lead.projectDescription} />
                <InfoItem label="Customer Requirements / Notes" value={lead.customerRequirements} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="followups">
            <FollowUpsTab leadId={id} onChanged={fetchLead} />
          </TabsContent>
          <TabsContent value="communication">
            <CommunicationsTab leadId={id} onChanged={fetchLead} />
          </TabsContent>
          <TabsContent value="sitevisits">
            <SiteVisitsTab leadId={id} onChanged={fetchLead} />
          </TabsContent>
          <TabsContent value="measurements">
            <MeasurementsTab leadId={id} />
          </TabsContent>
          <TabsContent value="boqs">
            <BoqTab leadId={id} />
          </TabsContent>
          <TabsContent value="quotations">
            <QuotationsTab leadId={id} />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectsTab leadId={id} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksTab leadId={id} users={users} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab leadId={id} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesTab leadId={id} />
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
