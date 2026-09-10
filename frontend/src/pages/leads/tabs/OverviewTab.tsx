import { useState, useEffect } from "react";
import {
  Pencil, Check, X, Star, User, Users, MapPin, Home, ListChecks, Share2, XCircle,
  Sparkles, Flame, Flag, IndianRupee, CalendarClock, CalendarCheck, Calendar, Clock, Tag,
  Phone, Mail, MessageCircle, Building2, Globe, GitBranch, TrendingUp, Repeat, ReceiptText,
  Briefcase, PenTool, Wrench, UserCheck, Map, Hash, MapPinned, Hammer, Layers, Ruler, Palette,
  Package, DoorOpen, FileText, Contact as ContactIcon, Compass, ArrowRight, Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import api from "@/lib/api";
import { leadApi } from "../leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, REFERRAL_TYPES, TEMPERATURES,
  formatDate, formatDateTime, formatINR, avatarColor, initials,
  type Lead, type UserSummary,
} from "../constants";
import type { LeadJourney, JourneyStepId } from "../journey";
import { CheckboxField } from "../fields";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";

// The Overview tab renders the lead as a responsive two-column grid of icon-rich cards, so every
// detail is visible on one page. Each card can be edited in place — clicking Edit turns its value
// cells into inputs in the same slot, so the layout never re-flows. Content cards save via the
// full-lead update endpoint (a full replace, so we merge edits onto the whole lead); the Team card
// uses the assignment endpoint and the Referral card its own endpoint.

type IconType = React.ComponentType<{ className?: string }>;

const dateInput = (v?: string) => (v ? v.slice(0, 10) : "");
const splitProducts = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);

// Compact inline controls sized to sit inside a details cell without changing the grid.
const cellInput = "w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm";
const FIELD_GRID = "grid grid-cols-2 gap-x-5 gap-y-4";

// One field: a soft icon chip, then label + value (or, when editing, the supplied editor).
function Field({
  icon: Icon, label, editing, view, children, action,
}: {
  icon: IconType; label: string; editing?: boolean;
  view?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-primary/[0.06] text-primary/80 grid place-items-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {!editing && action}
        </div>
        {editing
          ? <div className="mt-1">{children}</div>
          : <div className="font-medium text-sm break-words">{view ?? "—"}</div>}
      </div>
    </div>
  );
}

// Read-only star display for a lead's 1-5 rating — always renders all five so it reads as a
// rating even when unrated (empty stars).
function Stars({ value }: { value?: number | null }) {
  const v = value || 0;
  return (
    <span className="inline-flex items-center gap-0.5" title={v ? `${v}/5` : "Unrated"}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

function TextInput({
  value, onChange, type = "text", placeholder, inputMode,
}: {
  value: any; onChange: (v: string) => void; type?: string; placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
}) {
  return (
    <input
      className={cellInput}
      type={type}
      placeholder={placeholder}
      inputMode={inputMode}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectInput({
  value, onChange, options, allowEmpty = true, emptyLabel = "Select...",
}: {
  value: any; onChange: (v: string) => void; options: string[];
  allowEmpty?: boolean; emptyLabel?: string;
}) {
  return (
    <select className={cellInput} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function AreaInput({
  value, onChange, rows = 2, placeholder,
}: { value: any; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea
      className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm"
      rows={rows}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Merge a card's edited fields onto the full lead and persist. updateLead() on the backend is a
// full replace, so we must send every field; mirrors the payload cleanup in LeadFormDialog.
function saveLeadPatch(lead: Lead, patch: Partial<Lead>): Promise<void> {
  const payload: any = { ...lead, ...patch };
  ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue",
    "areaSqft", "expectedWorkArea", "floorCount"].forEach((k) => {
    if (payload[k] === "" || payload[k] === null) delete payload[k];
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
  delete payload.projectManager;
  delete payload.convertedToCustomer;
  delete payload.convertedToProject;
  // Referral is set once at creation and untouched by the update endpoint; drop the nested refs.
  delete payload.referredByCustomer;
  delete payload.referredByEmployee;
  return leadApi.update(lead.id, payload).then(() => { toast.success("Saved"); });
}

interface CardEdit<T> {
  editing: boolean;
  saving: boolean;
  draft: T;
  set: <K extends keyof T>(key: K) => (value: T[K]) => void;
  patch: (partial: Partial<T>) => void;
  start: () => void;
  cancel: () => void;
  doSave: () => Promise<void>;
}

function useCardEdit<T extends object>(seed: () => T, save: (draft: T) => Promise<void>): CardEdit<T> {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<T>(seed);
  const start = () => { setDraft(seed()); setEditing(true); };
  const cancel = () => setEditing(false);
  const set = <K extends keyof T>(key: K) => (value: T[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const patch = (partial: Partial<T>) => setDraft((d) => ({ ...d, ...partial }));
  const doSave = async () => {
    setSaving(true);
    try { await save(draft); setEditing(false); }
    catch (err: any) {
      console.error("Failed to save card", err);
      toast.error(err?.response?.data?.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  };
  return { editing, saving, draft, set, patch, start, cancel, doSave };
}

// A rounded card with an icon-badged title, inline edit controls, and a body.
function CardBox({
  icon: Icon, title, canEdit, edit, className, children,
}: {
  icon: IconType; title: string; canEdit: boolean; edit: CardEdit<any>;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-card shadow-sm p-5 ${className || ""}`}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
        </div>
        {canEdit && (edit.editing ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={edit.cancel} disabled={edit.saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={edit.doSave} disabled={edit.saving}>
              <Check className="h-4 w-4 mr-1" /> {edit.saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={edit.start} className="rounded-lg">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        ))}
      </div>
      {children}
    </div>
  );
}

type CardProps = { lead: Lead; canEdit: boolean; onChanged: () => void };

// ===========================================================================
export default function OverviewTab({
  lead, users, canEdit, journey, onGoStep, onChanged,
}: {
  lead: Lead;
  users: UserSummary[];
  canEdit: boolean;
  journey: LeadJourney;
  onGoStep: (id: JourneyStepId) => void;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Two independent columns so each packs tightly top-to-bottom (no row-alignment gaps between
          cards of unequal height). Left leads with Scope + Contact; right with Summary + Address +
          the Next Step guide (which also fills the right column so it doesn't end short). */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col gap-4">
          <ScopeCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
          <ContactCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
          <PropertyCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
        </div>
        <div className="flex flex-col gap-4">
          <NextStepCard journey={journey} onGoStep={onGoStep} />
          <SummaryCard lead={lead} users={users} canEdit={canEdit} onChanged={onChanged} />
          <AddressCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
          {lead.status === "Lost" && <LostCard lead={lead} />}
        </div>
      </div>
      {/* Team spans the full width at the bottom — one row of role tiles. */}
      <TeamCard lead={lead} users={users} canEdit={canEdit} onChanged={onChanged} />
    </div>
  );
}

// --- Next Step (drives the sales journey) -----------------------------------
// Just the green CTA — jumps to the current step in the Sales Journey tab. Renders nothing once
// the lead is converted or closed (no next step to take).
function NextStepCard({ journey, onGoStep }: { journey: LeadJourney; onGoStep: (id: JourneyStepId) => void }) {
  const current = journey.currentStep;
  if (journey.loading || !current) return null;
  return (
    <button
      onClick={() => onGoStep(current.id)}
      className="w-full text-left rounded-2xl p-4 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm flex items-center gap-3 group"
    >
      <div className="h-11 w-11 rounded-xl bg-white/15 grid place-items-center shrink-0">
        <Compass className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide opacity-90">Next step · Do next</div>
        <div className="font-semibold leading-tight">{current.label}</div>
        <div className="text-xs opacity-90 mt-0.5">{current.summary}</div>
      </div>
      <ArrowRight className="h-5 w-5 opacity-80 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  );
}

// --- Lost lead (read-only) --------------------------------------------------
function LostCard({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.03] shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive grid place-items-center">
          <XCircle className="h-[18px] w-[18px]" />
        </div>
        <h3 className="font-semibold tracking-tight text-destructive">Lost Lead Details</h3>
      </div>
      <div className={FIELD_GRID}>
        <Field icon={Flag} label="Reason" view={lead.lostReason} />
        <Field icon={Users} label="Competitor" view={lead.competitor} />
        <div className="col-span-2">
          <Field icon={FileText} label="Customer Feedback" view={lead.customerFeedback} />
        </div>
      </div>
    </div>
  );
}

// --- Lead Summary -----------------------------------------------------------
type SummaryDraft = Pick<Lead,
  "leadSource" | "leadType" | "leadTemperature" | "rating" | "estimatedBudget" |
  "expectedProjectValue" | "expectedStartDate" | "expectedEndDate">;

function SummaryCard({ lead, users, canEdit, onChanged }: CardProps & { users: UserSummary[] }) {
  const edit = useCardEdit<SummaryDraft>(
    () => ({
      leadSource: lead.leadSource, leadType: lead.leadType, leadTemperature: lead.leadTemperature,
      rating: lead.rating,
      estimatedBudget: lead.estimatedBudget, expectedProjectValue: lead.expectedProjectValue,
      expectedStartDate: dateInput(lead.expectedStartDate), expectedEndDate: dateInput(lead.expectedEndDate),
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  return (
    <CardBox icon={Sparkles} title="Lead Summary" canEdit={canEdit} edit={edit}>
      <div className={FIELD_GRID}>
        <Field icon={Globe} label="Lead Source" editing={e} view={lead.leadSource}>
          <SelectInput value={edit.draft.leadSource} onChange={edit.set("leadSource")} options={LEAD_SOURCES} />
        </Field>
        <Field icon={Tag} label="Lead Type" editing={e} view={lead.leadType}>
          <SelectInput value={edit.draft.leadType} onChange={edit.set("leadType")} options={LEAD_TYPES} />
        </Field>
        <Field icon={GitBranch} label="Stage" view={lead.stage} />
        <Field icon={Flame} label="Temperature" editing={e} view={lead.leadTemperature}>
          <SelectInput value={edit.draft.leadTemperature} onChange={edit.set("leadTemperature")} options={TEMPERATURES} allowEmpty={false} />
        </Field>
        <Field icon={Star} label="Rating" editing={e} view={<Stars value={lead.rating} />}>
          <div className="flex items-center gap-1 h-9">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => edit.set("rating")(s === (edit.draft.rating || 0) ? undefined : s)}
                className="hover:scale-110 transition-transform"
                aria-label={`Set rating ${s}`}
              >
                <Star className={`h-5 w-5 ${s <= (edit.draft.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              </button>
            ))}
          </div>
        </Field>
        <Field icon={IndianRupee} label="Estimated Budget" editing={e} view={<span className="font-semibold">{formatINR(lead.estimatedBudget)}</span>}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.estimatedBudget} onChange={edit.set("estimatedBudget") as any} />
        </Field>
        <Field icon={TrendingUp} label="Expected Project Value" editing={e} view={formatINR(lead.expectedProjectValue)}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.expectedProjectValue} onChange={edit.set("expectedProjectValue") as any} />
        </Field>
        <Field icon={Calendar} label="Expected Start" editing={e} view={formatDate(lead.expectedStartDate)}>
          <TextInput type="date" value={edit.draft.expectedStartDate} onChange={edit.set("expectedStartDate")} />
        </Field>
        <Field icon={CalendarCheck} label="Expected Completion" editing={e} view={formatDate(lead.expectedEndDate)}>
          <TextInput type="date" value={edit.draft.expectedEndDate} onChange={edit.set("expectedEndDate")} />
        </Field>
        <Field icon={Repeat} label="Follow-ups Logged" view={lead.followUpCount ?? 0} />
        <Field icon={CalendarClock} label="Next Follow-up" view={formatDate(lead.nextFollowUpDate)} />
        <Field icon={Clock} label="Created" view={formatDateTime(lead.createdAt)} />
        <Field icon={User} label="Created By" view={lead.createdBy} />
      </div>
      <ReferralSection lead={lead} users={users} canEdit={canEdit} onChanged={onChanged} />
    </CardBox>
  );
}

// --- Contact Details --------------------------------------------------------
type ContactDraft = Pick<Lead,
  "name" | "companyName" | "contactPerson" | "mobileNumber" |
  "alternateMobile" | "whatsappNumber" | "email" | "gstNumber">;

function ContactCard({ lead, canEdit, onChanged }: CardProps) {
  const edit = useCardEdit<ContactDraft>(
    () => ({
      name: lead.name, companyName: lead.companyName, contactPerson: lead.contactPerson,
      mobileNumber: lead.mobileNumber, alternateMobile: lead.alternateMobile,
      whatsappNumber: lead.whatsappNumber, email: lead.email, gstNumber: lead.gstNumber,
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  const phoneActions = lead.mobileNumber && (
    <span className="flex items-center gap-1">
      <a href={`tel:${lead.mobileNumber}`} className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center hover:bg-emerald-100" title="Call">
        <Phone className="h-3 w-3" />
      </a>
      <a href={`https://wa.me/${(lead.whatsappNumber || lead.mobileNumber).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
        className="h-6 w-6 rounded-full bg-green-50 text-green-600 grid place-items-center hover:bg-green-100" title="WhatsApp">
        <MessageCircle className="h-3 w-3" />
      </a>
    </span>
  );
  return (
    <CardBox icon={ContactIcon} title="Contact Details" canEdit={canEdit} edit={edit}>
      <div className={FIELD_GRID}>
        <Field icon={User} label="Customer Name" editing={e} view={lead.name}>
          <TextInput value={edit.draft.name} onChange={edit.set("name")} />
        </Field>
        <Field icon={Building2} label="Company" editing={e} view={lead.companyName}>
          <TextInput value={edit.draft.companyName} onChange={edit.set("companyName")} />
        </Field>
        <Field icon={Phone} label="Primary Mobile" editing={e} view={lead.mobileNumber} action={phoneActions}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.mobileNumber} onChange={edit.set("mobileNumber")} />
        </Field>
        <Field icon={Phone} label="Alternative Mobile" editing={e} view={lead.alternateMobile}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.alternateMobile} onChange={edit.set("alternateMobile")} />
        </Field>
        <Field icon={MessageCircle} label="WhatsApp" editing={e} view={lead.whatsappNumber}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.whatsappNumber} onChange={edit.set("whatsappNumber")} />
        </Field>
        <Field icon={Mail} label="Email" editing={e} view={lead.email}>
          <TextInput type="email" inputMode="email" value={edit.draft.email} onChange={edit.set("email")} />
        </Field>
        <Field icon={ReceiptText} label="GST Number" editing={e} view={lead.gstNumber}>
          <TextInput value={edit.draft.gstNumber} onChange={edit.set("gstNumber")} />
        </Field>
        <Field icon={ContactIcon} label="Contact Person" editing={e} view={lead.contactPerson}>
          <TextInput value={edit.draft.contactPerson} onChange={edit.set("contactPerson")} />
        </Field>
      </div>
    </CardBox>
  );
}

// --- Team (assignment endpoint) --------------------------------------------
const TEAM_ROLES = ["Sales Executive", "Designer", "Engineer", "Project Manager"] as const;
const TEAM_ICONS: Record<(typeof TEAM_ROLES)[number], IconType> = {
  "Sales Executive": Briefcase, "Designer": PenTool, "Engineer": Wrench, "Project Manager": UserCheck,
};
type TeamDraft = Record<(typeof TEAM_ROLES)[number], string>;

function TeamCard({ lead, users, canEdit, onChanged }: CardProps & { users: UserSummary[] }) {
  const seed = (): TeamDraft => ({
    "Sales Executive": lead.assignedSalesExecutive?.id ? String(lead.assignedSalesExecutive.id) : "",
    "Designer": lead.assignedDesigner?.id ? String(lead.assignedDesigner.id) : "",
    "Engineer": lead.assignedEngineer?.id ? String(lead.assignedEngineer.id) : "",
    "Project Manager": lead.projectManager?.id ? String(lead.projectManager.id) : "",
  });
  const current: Record<(typeof TEAM_ROLES)[number], string | undefined> = {
    "Sales Executive": lead.assignedSalesExecutive?.name,
    "Designer": lead.assignedDesigner?.name,
    "Engineer": lead.assignedEngineer?.name,
    "Project Manager": lead.projectManager?.name,
  };
  const edit = useCardEdit<TeamDraft>(seed, async (draft) => {
    const base = seed();
    const changed = TEAM_ROLES.filter((r) => draft[r] && draft[r] !== base[r]);
    if (!changed.length) { toast.success("No team changes"); return; }
    await Promise.all(changed.map((r) => leadApi.assign(lead.id, Number(draft[r]), r)));
    toast.success("Team updated");
    onChanged();
  });
  const e = edit.editing;
  return (
    <CardBox icon={Users} title="Team" canEdit={canEdit} edit={edit}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {TEAM_ROLES.map((role) => {
          const RoleIcon = TEAM_ICONS[role];
          const name = current[role];
          return (
            <div key={role} className="rounded-xl border bg-muted/20 p-3">
              {e ? (
                <>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <RoleIcon className="h-3.5 w-3.5" /> {role}
                  </div>
                  <select
                    className={cellInput}
                    value={edit.draft[role]}
                    onChange={(ev) => edit.set(role)(ev.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  {name ? (
                    <div className={`h-9 w-9 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${avatarColor(name)}`}>
                      {initials(name)}
                    </div>
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted grid place-items-center shrink-0 text-muted-foreground">
                      <RoleIcon className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">{role}</div>
                    <div className={`text-sm font-medium truncate ${name ? "" : "text-muted-foreground"}`}>{name || "Unassigned"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CardBox>
  );
}

// --- Referral ---------------------------------------------------------------
type ReferralDraft = {
  referralType: string;
  referredByCustomerId: string;
  referredByCustomerName: string;
  referredByEmployeeId: string;
  referrerName: string;
  referrerContact: string;
  referralNotes: string;
};

function ReferralSection({ lead, users, canEdit, onChanged }: CardProps & { users: UserSummary[] }) {
  const edit = useCardEdit<ReferralDraft>(
    () => ({
      referralType: lead.referralType || "",
      referredByCustomerId: lead.referredByCustomer?.id ? String(lead.referredByCustomer.id) : "",
      referredByCustomerName: lead.referredByCustomer?.name || "",
      referredByEmployeeId: lead.referredByEmployee?.id ? String(lead.referredByEmployee.id) : "",
      referrerName: lead.referrerName || "",
      referrerContact: lead.referrerContact || "",
      referralNotes: lead.referralNotes || "",
    }),
    async (d) => {
      await leadApi.updateReferral(lead.id, {
        referralType: d.referralType || null,
        referredByCustomerId: d.referralType === "Existing Customer" && d.referredByCustomerId ? Number(d.referredByCustomerId) : null,
        referredByEmployeeId: d.referralType === "Employee" && d.referredByEmployeeId ? Number(d.referredByEmployeeId) : null,
        referrerName: d.referrerName || null,
        referrerContact: d.referrerContact || null,
        referralNotes: d.referralNotes || null,
      });
      toast.success("Referral updated");
      onChanged();
    },
  );

  const hasReferral = lead.referralType || lead.referrerName
    || lead.referredByCustomer?.id || lead.referredByEmployee?.id;
  const e = edit.editing;
  if (!hasReferral && !canEdit && !e) return null;

  const referrer = lead.referredByCustomer?.name || lead.referredByEmployee?.name || lead.referrerName;
  const type = edit.draft.referralType;

  return (
    <div className="pt-4 mt-2 border-t">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Share2 className="h-4 w-4" /> Referral
        </div>
        {canEdit && (e ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={edit.cancel} disabled={edit.saving}><X className="h-4 w-4 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={edit.doSave} disabled={edit.saving}><Check className="h-4 w-4 mr-1" /> {edit.saving ? "Saving..." : "Save"}</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={edit.start} className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5 mr-1" /> {hasReferral ? "Edit" : "Add"}
          </Button>
        ))}
      </div>
      {e ? (
        <div className="space-y-4">
          <div>
            <span className="text-muted-foreground block mb-1 text-xs">Referred By</span>
            <div className="max-w-xs">
              <SelectInput
                value={type}
                onChange={(v) => edit.patch({
                  referralType: v,
                  referredByCustomerId: "", referredByCustomerName: "",
                  referredByEmployeeId: "", referrerName: "", referrerContact: "",
                })}
                options={REFERRAL_TYPES}
                emptyLabel="Not a referral"
              />
            </div>
          </div>

          {type === "Existing Customer" && (
            <div className="space-y-1.5 max-w-md">
              <span className="text-muted-foreground block text-xs">Referring Customer</span>
              {edit.draft.referredByCustomerId ? (
                <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="font-medium">{edit.draft.referredByCustomerName || edit.draft.referrerName}</span>
                  <button type="button" className="text-xs text-primary hover:underline"
                    onClick={() => edit.patch({ referredByCustomerId: "", referredByCustomerName: "", referrerName: "", referrerContact: "" })}>
                    Change
                  </button>
                </div>
              ) : (
                <ExistingCustomerSearch
                  placeholder="Search the customer who referred..."
                  onPick={(id, c) => edit.patch({
                    referredByCustomerId: String(id),
                    referredByCustomerName: c?.name || "",
                    referrerName: c?.name || "",
                    referrerContact: c?.phone || "",
                  })}
                />
              )}
            </div>
          )}

          {type === "Employee" && (
            <div className="space-y-1.5 max-w-md">
              <span className="text-muted-foreground block text-xs">Referring Employee</span>
              <select
                className={cellInput}
                value={edit.draft.referredByEmployeeId}
                onChange={(ev) => {
                  const u = users.find((x) => x.id === Number(ev.target.value));
                  edit.patch({ referredByEmployeeId: ev.target.value, referrerName: u?.name || "" });
                }}
              >
                <option value="">Select employee...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          {type === "Other" && (
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <div>
                <span className="text-muted-foreground block mb-1 text-xs">Referrer Name</span>
                <TextInput value={edit.draft.referrerName} onChange={edit.set("referrerName")} />
              </div>
              <div>
                <span className="text-muted-foreground block mb-1 text-xs">Referrer Contact</span>
                <TextInput type="tel" inputMode="tel" value={edit.draft.referrerContact} onChange={edit.set("referrerContact")} />
              </div>
            </div>
          )}

          {type && (
            <div>
              <span className="text-muted-foreground block mb-1 text-xs">Referral Notes</span>
              <AreaInput value={edit.draft.referralNotes} onChange={edit.set("referralNotes")} />
            </div>
          )}
        </div>
      ) : hasReferral ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <span><span className="text-muted-foreground">By: </span><span className="font-medium">{lead.referralType || "—"}</span></span>
          <span><span className="text-muted-foreground">Referrer: </span><span className="font-medium">{referrer || "—"}</span></span>
          {lead.referrerContact && <span><span className="text-muted-foreground">Contact: </span><span className="font-medium">{lead.referrerContact}</span></span>}
          {lead.referralNotes && <span className="w-full text-muted-foreground">{lead.referralNotes}</span>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No referrer recorded.</p>
      )}
    </div>
  );
}

// --- Address ----------------------------------------------------------------
type AddressDraft = Pick<Lead, "address" | "city" | "district" | "state" | "pincode" | "siteAddress">;

// A small "Map" link that opens the given address parts as a Google Maps search in a new tab,
// so a site visit can be navigated to with one tap. Renders nothing when there is nothing to locate.
function MapsLink({ parts }: { parts: (string | undefined | null)[] }) {
  const query = parts.map((p) => (p || "").trim()).filter(Boolean).join(", ");
  if (!query) return null;
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
      title={`Open in Google Maps: ${query}`}
    >
      <Navigation className="h-3.5 w-3.5" /> Map
    </a>
  );
}

function AddressCard({ lead, canEdit, onChanged }: CardProps) {
  const edit = useCardEdit<AddressDraft>(
    () => ({
      address: lead.address, city: lead.city, district: lead.district,
      state: lead.state, pincode: lead.pincode, siteAddress: lead.siteAddress,
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  return (
    <CardBox icon={MapPin} title="Address" canEdit={canEdit} edit={edit}>
      <div className={FIELD_GRID}>
        <div className="col-span-2">
          <Field
            icon={MapPin} label="Address" editing={e} view={lead.address}
            action={<MapsLink parts={[lead.address, lead.city, lead.district, lead.state, lead.pincode]} />}
          >
            <AreaInput value={edit.draft.address} onChange={edit.set("address")} />
          </Field>
        </div>
        <Field icon={Building2} label="City" editing={e} view={lead.city}>
          <TextInput value={edit.draft.city} onChange={edit.set("city")} />
        </Field>
        <Field icon={Map} label="District" editing={e} view={lead.district}>
          <TextInput value={edit.draft.district} onChange={edit.set("district")} />
        </Field>
        <Field icon={Map} label="State" editing={e} view={lead.state}>
          <TextInput value={edit.draft.state} onChange={edit.set("state")} />
        </Field>
        <Field icon={Hash} label="Pincode" editing={e} view={lead.pincode}>
          <TextInput inputMode="numeric" value={edit.draft.pincode} onChange={edit.set("pincode")} />
        </Field>
        <div className="col-span-2">
          <Field
            icon={MapPinned} label="Project / Site Address" editing={e} view={lead.siteAddress}
            action={<MapsLink parts={[lead.siteAddress || lead.address, lead.city, lead.district, lead.state, lead.pincode]} />}
          >
            <AreaInput value={edit.draft.siteAddress} onChange={edit.set("siteAddress")} />
          </Field>
        </div>
      </div>
    </CardBox>
  );
}

// --- Property Details -------------------------------------------------------
type PropertyDraft = Pick<Lead,
  "propertyType" | "currentConstructionStage" | "floorCount" | "areaSqft" |
  "preferredDesignStyle" | "preferredMaterial" | "preferredColorTheme" | "estimatedDuration">;

function PropertyCard({ lead, canEdit, onChanged }: CardProps) {
  const edit = useCardEdit<PropertyDraft>(
    () => ({
      propertyType: lead.propertyType, currentConstructionStage: lead.currentConstructionStage,
      floorCount: lead.floorCount, areaSqft: lead.areaSqft,
      preferredDesignStyle: lead.preferredDesignStyle, preferredMaterial: lead.preferredMaterial,
      preferredColorTheme: lead.preferredColorTheme, estimatedDuration: lead.estimatedDuration,
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  return (
    <CardBox icon={Home} title="Property Details" canEdit={canEdit} edit={edit}>
      <div className={FIELD_GRID}>
        <Field icon={Home} label="Property Type" editing={e} view={lead.propertyType}>
          <TextInput value={edit.draft.propertyType} onChange={edit.set("propertyType")} placeholder="e.g. Flat" />
        </Field>
        <Field icon={Hammer} label="Construction Status" editing={e} view={lead.currentConstructionStage}>
          <SelectInput value={edit.draft.currentConstructionStage} onChange={edit.set("currentConstructionStage")} options={CONSTRUCTION_STATUSES} />
        </Field>
        <Field icon={Layers} label="Floors" editing={e} view={lead.floorCount}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.floorCount} onChange={edit.set("floorCount") as any} />
        </Field>
        <Field icon={Ruler} label="Area (sq.ft)" editing={e} view={lead.areaSqft}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.areaSqft} onChange={edit.set("areaSqft") as any} />
        </Field>
        <Field icon={Palette} label="Design Style" editing={e} view={lead.preferredDesignStyle}>
          <TextInput value={edit.draft.preferredDesignStyle} onChange={edit.set("preferredDesignStyle")} placeholder="e.g. Modern" />
        </Field>
        <Field icon={Package} label="Preferred Materials" editing={e} view={lead.preferredMaterial}>
          <TextInput value={edit.draft.preferredMaterial} onChange={edit.set("preferredMaterial")} />
        </Field>
        <Field icon={Palette} label="Color Theme" editing={e} view={lead.preferredColorTheme}>
          <TextInput value={edit.draft.preferredColorTheme} onChange={edit.set("preferredColorTheme")} />
        </Field>
        <Field icon={Clock} label="Duration" editing={e} view={lead.estimatedDuration}>
          <TextInput value={edit.draft.estimatedDuration} onChange={edit.set("estimatedDuration")} />
        </Field>
      </div>
    </CardBox>
  );
}

// --- Scope of Work ----------------------------------------------------------
const SCOPE_ITEMS: [keyof Lead, string][] = [
  ["reqKitchen", "Modular Kitchen"], ["reqWardrobe", "Wardrobe"], ["reqTvUnit", "TV Unit"],
  ["reqFalseCeiling", "False Ceiling"], ["reqPainting", "Painting"], ["reqFlooring", "Flooring"],
  ["reqElectrical", "Electrical"], ["reqPlumbing", "Plumbing"], ["reqWoodFinish", "Wood Finish"],
];
type ScopeDraft = Pick<Lead,
  "reqKitchen" | "reqWardrobe" | "reqTvUnit" | "reqFalseCeiling" | "reqPainting" | "reqFlooring" |
  "reqElectrical" | "reqPlumbing" | "reqWoodFinish" |
  "requirementCategory" | "requirementProduct" |
  "roomsRequired" | "specialRequests" | "projectDescription" | "customerRequirements">;

type Cat = { id: number; name: string; slug: string };
type Prod = { id: number; name: string; slug: string; categorySlug?: string };

function ScopeCard({ lead, canEdit, onChanged }: CardProps) {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [catalog, setCatalog] = useState<Prod[]>([]);
  const edit = useCardEdit<ScopeDraft>(
    () => ({
      reqKitchen: lead.reqKitchen, reqWardrobe: lead.reqWardrobe, reqTvUnit: lead.reqTvUnit,
      reqFalseCeiling: lead.reqFalseCeiling, reqPainting: lead.reqPainting, reqFlooring: lead.reqFlooring,
      reqElectrical: lead.reqElectrical, reqPlumbing: lead.reqPlumbing, reqWoodFinish: lead.reqWoodFinish,
      requirementCategory: lead.requirementCategory, requirementProduct: lead.requirementProduct,
      roomsRequired: lead.roomsRequired, specialRequests: lead.specialRequests,
      projectDescription: lead.projectDescription, customerRequirements: lead.customerRequirements,
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;

  // The website catalog powers the category + product pickers (only fetched when editing starts).
  useEffect(() => {
    if (!e || categories.length) return;
    api.get("/public/categories").then((r) => setCategories(r.data || [])).catch(() => {});
    api.get("/public/products").then((r) => setCatalog(r.data || [])).catch(() => {});
  }, [e, categories.length]);

  const anySelected = SCOPE_ITEMS.some(([key]) => lead[key]);
  const products = splitProducts(lead.requirementProduct);
  const draftProducts = splitProducts(edit.draft.requirementProduct);
  const selectedCat = categories.find((c) => c.name === edit.draft.requirementCategory);
  const productOptions = catalog
    .filter((p) => !selectedCat || p.categorySlug === selectedCat.slug)
    .map((p) => p.name);
  const setDraftProducts = (names: string[]) => edit.set("requirementProduct")(names.join(", "));

  return (
    <CardBox icon={ListChecks} title="Scope of Work" canEdit={canEdit} edit={edit}>
      <div className="space-y-5">
        {e ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Requirement Category</label>
              <select
                className={cellInput}
                value={edit.draft.requirementCategory ?? ""}
                onChange={(ev) => edit.set("requirementCategory")(ev.target.value)}
              >
                <option value="">Select category...</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Products</label>
              <select
                className={cellInput}
                value=""
                onChange={(ev) => { const v = ev.target.value; if (v && !draftProducts.includes(v)) setDraftProducts([...draftProducts, v]); }}
              >
                <option value="">Add a product...</option>
                {productOptions.filter((p) => !draftProducts.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {draftProducts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {draftProducts.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                      {p}
                      <button type="button" onClick={() => setDraftProducts(draftProducts.filter((x) => x !== p))} aria-label={`Remove ${p}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
            <Field icon={Tag} label="Requirement Category" view={lead.requirementCategory} />
            <div className="md:col-span-2">
              <Field
                icon={Package}
                label="Products"
                view={products.length ? (
                  <span className="flex flex-wrap gap-1.5">
                    {products.map((p) => (
                      <span key={p} className="px-2.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">{p}</span>
                    ))}
                  </span>
                ) : undefined}
              />
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-2">Work Required</div>
          {e ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SCOPE_ITEMS.map(([key, label]) => (
                <CheckboxField
                  key={key as string}
                  label={label}
                  checked={edit.draft[key as keyof ScopeDraft] as boolean | undefined}
                  onChange={edit.set(key as keyof ScopeDraft) as any}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {SCOPE_ITEMS.filter(([key]) => lead[key]).map(([, label]) => (
                <span key={label} className="px-3 py-1 bg-emerald-50 text-emerald-700 text-sm rounded-full font-medium">
                  ✓ {label}
                </span>
              ))}
              {!anySelected && <span className="text-sm text-muted-foreground">No work items selected.</span>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          <Field icon={DoorOpen} label="Rooms Required" editing={e} view={lead.roomsRequired}>
            <AreaInput value={edit.draft.roomsRequired} onChange={edit.set("roomsRequired")} placeholder="e.g. 3 Bedrooms, Living Room, Kitchen" />
          </Field>
          <Field icon={Sparkles} label="Special Requests" editing={e} view={lead.specialRequests}>
            <AreaInput value={edit.draft.specialRequests} onChange={edit.set("specialRequests")} />
          </Field>
          <Field icon={FileText} label="Requirement Description" editing={e} view={lead.projectDescription}>
            <AreaInput rows={3} value={edit.draft.projectDescription} onChange={edit.set("projectDescription")} />
          </Field>
          <Field icon={FileText} label="Customer Requirements / Notes" editing={e} view={lead.customerRequirements}>
            <AreaInput rows={3} value={edit.draft.customerRequirements} onChange={edit.set("customerRequirements")} />
          </Field>
        </div>
      </div>
    </CardBox>
  );
}
