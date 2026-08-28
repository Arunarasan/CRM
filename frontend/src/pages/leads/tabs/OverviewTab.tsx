import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { leadApi } from "../leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, REFERRAL_TYPES, TEMPERATURES,
  formatDate, formatDateTime, formatINR,
  type Lead, type UserSummary,
} from "../constants";
import { CheckboxField } from "../fields";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";

// The Overview tab renders the lead's static profile as a set of cards, each of which can be
// edited in place. Editing keeps the exact same details layout — every value cell simply turns
// into an input box in the same slot — so the card never re-flows. Content cards save via the
// full-lead update endpoint (a full replace, so we merge edits onto the whole lead); the Team
// card uses the assignment endpoint.

const dateInput = (v?: string) => (v ? v.slice(0, 10) : "");

// Compact inline controls sized to sit inside a details cell without changing the grid.
const cellInput = "w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm";

// One details cell: label on top, then the static value (view) or the supplied editor (edit).
// InfoItem and Cell share identical outer markup so the grid layout is unchanged between modes.
function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm">{value ?? "—"}</span>
    </div>
  );
}

function Cell({
  label, editing, view, children,
}: { label: string; editing: boolean; view?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      {editing
        ? children
        : <span className="font-medium text-sm">{view ?? "—"}</span>}
    </div>
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

// Local editing state for one card: seeds a draft on edit, exposes a per-field setter, and runs
// the async save. Keeping it per-card lets each section be edited independently.
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

function CardShell({
  title, canEdit, edit, className, children,
}: {
  title: string;
  canEdit: boolean;
  edit: CardEdit<any>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {canEdit && (edit.editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={edit.cancel} disabled={edit.saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={edit.doSave} disabled={edit.saving}>
              <Check className="h-4 w-4 mr-1" /> {edit.saving ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={edit.start}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        ))}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const GRID = "grid grid-cols-2 md:grid-cols-4 gap-6";

export default function OverviewTab({
  lead, users, canEdit, onChanged,
}: {
  lead: Lead;
  users: UserSummary[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-4">
      <SummaryCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
      <ReferralCard lead={lead} users={users} canEdit={canEdit} onChanged={onChanged} />
      <TeamCard lead={lead} users={users} canEdit={canEdit} onChanged={onChanged} />
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
      <ContactCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
      <AddressCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
      <PropertyCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
      <ScopeCard lead={lead} canEdit={canEdit} onChanged={onChanged} />
    </div>
  );
}

// --- Referral (who referred the lead) --------------------------------------
// Saved through its own endpoint so it never collides with the full-lead update the other cards
// use. Rendered whenever referral data exists, or whenever the lead is editable (so it can be
// added/corrected). Type drives which referrer picker shows.
type ReferralDraft = {
  referralType: string;
  referredByCustomerId: string;
  referredByCustomerName: string;
  referredByEmployeeId: string;
  referrerName: string;
  referrerContact: string;
  referralNotes: string;
};

function ReferralCard({ lead, users, canEdit, onChanged }: CardProps & { users: UserSummary[] }) {
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
  if (!hasReferral && !canEdit) return null;

  const e = edit.editing;
  const referrer = lead.referredByCustomer?.name || lead.referredByEmployee?.name || lead.referrerName;
  const type = edit.draft.referralType;

  return (
    <CardShell title="Referral" canEdit={canEdit} edit={edit}>
      {e ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-muted-foreground block mb-1 text-xs">Referred By</span>
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
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => edit.patch({ referredByCustomerId: "", referredByCustomerName: "", referrerName: "", referrerContact: "" })}
                  >
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
        <div className={GRID}>
          <InfoItem label="Referred By" value={lead.referralType} />
          <InfoItem label="Referrer" value={referrer} />
          <InfoItem label="Referrer Contact" value={lead.referrerContact} />
          {lead.referralNotes && (
            <div className="col-span-2 md:col-span-4">
              <InfoItem label="Referral Notes" value={lead.referralNotes} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No referrer recorded. Use Edit to add referral details.</p>
      )}
    </CardShell>
  );
}

// --- Lead Summary -----------------------------------------------------------
type SummaryDraft = Pick<Lead,
  "leadSource" | "leadType" | "leadTemperature" | "estimatedBudget" |
  "expectedProjectValue" | "expectedStartDate" | "expectedEndDate">;

function SummaryCard({ lead, canEdit, onChanged }: CardProps) {
  const edit = useCardEdit<SummaryDraft>(
    () => ({
      leadSource: lead.leadSource, leadType: lead.leadType, leadTemperature: lead.leadTemperature,
      estimatedBudget: lead.estimatedBudget, expectedProjectValue: lead.expectedProjectValue,
      expectedStartDate: dateInput(lead.expectedStartDate), expectedEndDate: dateInput(lead.expectedEndDate),
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  return (
    <CardShell title="Lead Summary" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Lead Source" editing={e} view={lead.leadSource}>
          <SelectInput value={edit.draft.leadSource} onChange={edit.set("leadSource")} options={LEAD_SOURCES} />
        </Cell>
        <Cell label="Lead Type" editing={e} view={lead.leadType}>
          <SelectInput value={edit.draft.leadType} onChange={edit.set("leadType")} options={LEAD_TYPES} />
        </Cell>
        <InfoItem label="Stage" value={lead.stage} />
        <Cell label="Temperature" editing={e} view={lead.leadTemperature}>
          <SelectInput value={edit.draft.leadTemperature} onChange={edit.set("leadTemperature")} options={TEMPERATURES} allowEmpty={false} />
        </Cell>
        <Cell label="Estimated Budget" editing={e} view={<span className="text-lg">{formatINR(lead.estimatedBudget)}</span>}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.estimatedBudget} onChange={edit.set("estimatedBudget") as any} />
        </Cell>
        <Cell label="Expected Project Value" editing={e} view={formatINR(lead.expectedProjectValue)}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.expectedProjectValue} onChange={edit.set("expectedProjectValue") as any} />
        </Cell>
        <Cell label="Expected Start" editing={e} view={formatDate(lead.expectedStartDate)}>
          <TextInput type="date" value={edit.draft.expectedStartDate} onChange={edit.set("expectedStartDate")} />
        </Cell>
        <Cell label="Expected Completion" editing={e} view={formatDate(lead.expectedEndDate)}>
          <TextInput type="date" value={edit.draft.expectedEndDate} onChange={edit.set("expectedEndDate")} />
        </Cell>
        <InfoItem label="Follow-ups Logged" value={lead.followUpCount ?? 0} />
        <InfoItem label="Next Follow-up" value={formatDate(lead.nextFollowUpDate)} />
        <InfoItem label="Created" value={formatDateTime(lead.createdAt)} />
        <InfoItem label="Created By" value={lead.createdBy} />
      </div>
    </CardShell>
  );
}

// --- Team (assignment endpoint) --------------------------------------------
const TEAM_ROLES = ["Sales Executive", "Designer", "Engineer", "Project Manager"] as const;
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
    // Assignment endpoint reassigns per role and does not support clearing, so we only push roles
    // that changed to a (non-empty) member.
    const changed = TEAM_ROLES.filter((r) => draft[r] && draft[r] !== base[r]);
    if (!changed.length) { toast.success("No team changes"); return; }
    await Promise.all(changed.map((r) => leadApi.assign(lead.id, Number(draft[r]), r)));
    toast.success("Team updated");
    onChanged();
  });
  const e = edit.editing;
  return (
    <CardShell title="Team" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        {TEAM_ROLES.map((role) => (
          <Cell key={role} label={role} editing={e} view={current[role] || "Unassigned"}>
            <select
              className={cellInput}
              value={edit.draft[role]}
              onChange={(ev) => edit.set(role)(ev.target.value)}
            >
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Cell>
        ))}
      </div>
    </CardShell>
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
  return (
    <CardShell title="Contact Details" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Customer Name" editing={e} view={lead.name}>
          <TextInput value={edit.draft.name} onChange={edit.set("name")} />
        </Cell>
        <Cell label="Company" editing={e} view={lead.companyName}>
          <TextInput value={edit.draft.companyName} onChange={edit.set("companyName")} />
        </Cell>
        <Cell label="Contact Person" editing={e} view={lead.contactPerson}>
          <TextInput value={edit.draft.contactPerson} onChange={edit.set("contactPerson")} />
        </Cell>
        <Cell label="Primary Mobile" editing={e} view={lead.mobileNumber}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.mobileNumber} onChange={edit.set("mobileNumber")} />
        </Cell>
        <Cell label="Alternative Mobile" editing={e} view={lead.alternateMobile}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.alternateMobile} onChange={edit.set("alternateMobile")} />
        </Cell>
        <Cell label="WhatsApp" editing={e} view={lead.whatsappNumber}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.whatsappNumber} onChange={edit.set("whatsappNumber")} />
        </Cell>
        <Cell label="Email" editing={e} view={lead.email}>
          <TextInput type="email" inputMode="email" value={edit.draft.email} onChange={edit.set("email")} />
        </Cell>
        <Cell label="GST Number" editing={e} view={lead.gstNumber}>
          <TextInput value={edit.draft.gstNumber} onChange={edit.set("gstNumber")} />
        </Cell>
      </div>
    </CardShell>
  );
}

// --- Address ----------------------------------------------------------------
type AddressDraft = Pick<Lead, "address" | "city" | "district" | "state" | "pincode" | "siteAddress">;

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
    <CardShell title="Address" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <div className="col-span-2">
          <Cell label="Address" editing={e} view={lead.address}>
            <AreaInput value={edit.draft.address} onChange={edit.set("address")} />
          </Cell>
        </div>
        <Cell label="City" editing={e} view={lead.city}>
          <TextInput value={edit.draft.city} onChange={edit.set("city")} />
        </Cell>
        <Cell label="District" editing={e} view={lead.district}>
          <TextInput value={edit.draft.district} onChange={edit.set("district")} />
        </Cell>
        <Cell label="State" editing={e} view={lead.state}>
          <TextInput value={edit.draft.state} onChange={edit.set("state")} />
        </Cell>
        <Cell label="Pincode" editing={e} view={lead.pincode}>
          <TextInput inputMode="numeric" value={edit.draft.pincode} onChange={edit.set("pincode")} />
        </Cell>
        <div className="col-span-2">
          <Cell label="Project / Site Address" editing={e} view={lead.siteAddress}>
            <AreaInput value={edit.draft.siteAddress} onChange={edit.set("siteAddress")} />
          </Cell>
        </div>
      </div>
    </CardShell>
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
    <CardShell title="Property Details" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Property Type" editing={e} view={lead.propertyType}>
          <TextInput value={edit.draft.propertyType} onChange={edit.set("propertyType")} placeholder="e.g. Flat" />
        </Cell>
        <Cell label="Construction Status" editing={e} view={lead.currentConstructionStage}>
          <SelectInput value={edit.draft.currentConstructionStage} onChange={edit.set("currentConstructionStage")} options={CONSTRUCTION_STATUSES} />
        </Cell>
        <Cell label="Floors" editing={e} view={lead.floorCount}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.floorCount} onChange={edit.set("floorCount") as any} />
        </Cell>
        <Cell label="Area (sq.ft)" editing={e} view={lead.areaSqft}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.areaSqft} onChange={edit.set("areaSqft") as any} />
        </Cell>
        <Cell label="Design Style" editing={e} view={lead.preferredDesignStyle}>
          <TextInput value={edit.draft.preferredDesignStyle} onChange={edit.set("preferredDesignStyle")} placeholder="e.g. Modern" />
        </Cell>
        <Cell label="Preferred Materials" editing={e} view={lead.preferredMaterial}>
          <TextInput value={edit.draft.preferredMaterial} onChange={edit.set("preferredMaterial")} />
        </Cell>
        <Cell label="Color Theme" editing={e} view={lead.preferredColorTheme}>
          <TextInput value={edit.draft.preferredColorTheme} onChange={edit.set("preferredColorTheme")} />
        </Cell>
        <Cell label="Duration" editing={e} view={lead.estimatedDuration}>
          <TextInput value={edit.draft.estimatedDuration} onChange={edit.set("estimatedDuration")} />
        </Cell>
      </div>
    </CardShell>
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
  "roomsRequired" | "specialRequests" | "projectDescription" | "customerRequirements">;

function ScopeCard({ lead, canEdit, onChanged }: CardProps) {
  const edit = useCardEdit<ScopeDraft>(
    () => ({
      reqKitchen: lead.reqKitchen, reqWardrobe: lead.reqWardrobe, reqTvUnit: lead.reqTvUnit,
      reqFalseCeiling: lead.reqFalseCeiling, reqPainting: lead.reqPainting, reqFlooring: lead.reqFlooring,
      reqElectrical: lead.reqElectrical, reqPlumbing: lead.reqPlumbing, reqWoodFinish: lead.reqWoodFinish,
      roomsRequired: lead.roomsRequired, specialRequests: lead.specialRequests,
      projectDescription: lead.projectDescription, customerRequirements: lead.customerRequirements,
    }),
    async (d) => { await saveLeadPatch(lead, d); onChanged(); },
  );
  const e = edit.editing;
  const anySelected = SCOPE_ITEMS.some(([key]) => lead[key]);
  return (
    <CardShell title="Scope of Work" canEdit={canEdit} edit={edit}>
      <div className="space-y-4">
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
              <span key={label} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full font-medium">
                ✓ {label}
              </span>
            ))}
            {!anySelected && <span className="text-sm text-muted-foreground">No scope items selected.</span>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Cell label="Rooms Required" editing={e} view={lead.roomsRequired}>
            <AreaInput value={edit.draft.roomsRequired} onChange={edit.set("roomsRequired")} placeholder="e.g. 3 Bedrooms, Living Room, Kitchen" />
          </Cell>
          <Cell label="Special Requests" editing={e} view={lead.specialRequests}>
            <AreaInput value={edit.draft.specialRequests} onChange={edit.set("specialRequests")} />
          </Cell>
        </div>
        <Cell label="Requirement Description" editing={e} view={lead.projectDescription}>
          <AreaInput rows={3} value={edit.draft.projectDescription} onChange={edit.set("projectDescription")} />
        </Cell>
        <Cell label="Customer Requirements / Notes" editing={e} view={lead.customerRequirements}>
          <AreaInput rows={3} value={edit.draft.customerRequirements} onChange={edit.set("customerRequirements")} />
        </Cell>
      </div>
    </CardShell>
  );
}

type CardProps = { lead: Lead; canEdit: boolean; onChanged: () => void };
