import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { workforceApi } from "@/api/workforceApi";
import type { WorkforceDetail, WorkforceMeta, WorkforceRequest } from "@/types/workforce";

// The employee-profile Overview tab renders the person's master record as a set of cards, each of
// which can be edited in place — the same interaction the Lead profile uses. Editing keeps the
// exact same details layout: every value cell simply turns into an input in the same slot, so the
// card never re-flows. All cards persist through workforceApi.update(), which is a FULL replace
// that mirrors shared header fields onto the Employee extension row on the backend. Because it is a
// full replace we always rebuild the complete request from the loaded detail and merge each card's
// edits on top — otherwise unsent fields would be nulled (mirrors saveLeadPatch on the lead page).

const dateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : "");
const cellInput = "w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm";
const GRID = "grid grid-cols-2 md:grid-cols-4 gap-6";

const GENDERS = ["MALE", "FEMALE", "OTHER"];

// --- shared cells (identical outer markup in view/edit so the grid never shifts) ---------------
function InfoItem({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      <span className="font-medium text-sm break-words">{value ?? "—"}</span>
    </div>
  );
}

function Cell({
  label, editing, view, children,
}: { label: string; editing: boolean; view?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground block mb-1 text-xs">{label}</span>
      {editing ? children : <span className="font-medium text-sm break-words">{view ?? "—"}</span>}
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
      className={cellInput} type={type} placeholder={placeholder} inputMode={inputMode}
      value={value ?? ""} onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectInput({
  value, onChange, options, allowEmpty = true, emptyLabel = "—",
}: {
  value: any; onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
  allowEmpty?: boolean; emptyLabel?: string;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select className={cellInput} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// --- full-replace request builder --------------------------------------------------------------
// Rebuild the complete WorkforceRequest from the loaded detail. Mirrors the edit-mode mapping in
// AddWorkforceDialog so an inline card save never drops fields it did not touch.
function buildRequest(detail: WorkforceDetail): WorkforceRequest {
  const w = detail.workforce;
  const e = detail.employee || {};
  return {
    workforceType: w.workforceType,
    fullName: w.fullName, profilePhotoUrl: w.profilePhotoUrl, mobile: w.mobile, email: w.email,
    dateOfBirth: w.dateOfBirth, gender: w.gender,
    addressLine1: w.addressLine1, addressLine2: w.addressLine2, city: w.city, state: w.state,
    country: w.country, pincode: w.pincode,
    aadhaarNumber: w.aadhaarNumber, panNumber: w.panNumber, drivingLicense: w.drivingLicense,
    passportNumber: w.passportNumber,
    emergencyContactName: w.emergencyContactName, emergencyRelationship: w.emergencyRelationship,
    emergencyPhone: w.emergencyPhone,
    primarySkill: w.primarySkill, secondarySkills: w.secondarySkills,
    experienceYears: w.experienceYears, certifications: w.certifications,
    availableFrom: w.availableFrom, status: w.status, notes: w.notes,
    employee: {
      employeeCode: e.employeeCode, departmentId: e.department?.id, designation: e.designation,
      joiningDate: dateInput(e.dateOfJoining), salary: e.baseSalary, salaryType: e.salaryType,
      shift: e.shift, attendanceRequired: e.attendanceRequired, leavePolicy: e.leavePolicy,
      payrollEnabled: e.payrollEnabled, pfNumber: e.pfNumber, esiNumber: e.esiNumber,
      bankAccount: e.bankAccount, ifsc: e.ifsc, uan: e.uan,
    },
  };
}

// --- per-card edit state (identical to the lead OverviewTab hook) ------------------------------
interface CardEdit<T> {
  editing: boolean; saving: boolean; draft: T;
  set: <K extends keyof T>(key: K) => (value: T[K]) => void;
  start: () => void; cancel: () => void; doSave: () => Promise<void>;
}

function useCardEdit<T extends object>(seed: () => T, save: (draft: T) => Promise<void>): CardEdit<T> {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<T>(seed);
  const start = () => { setDraft(seed()); setEditing(true); };
  const cancel = () => setEditing(false);
  const set = <K extends keyof T>(key: K) => (value: T[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const doSave = async () => {
    setSaving(true);
    try { await save(draft); setEditing(false); }
    catch (err: any) {
      console.error("Failed to save card", err);
      toast.error(err?.response?.data?.message || "Failed to save. Please try again.");
    } finally { setSaving(false); }
  };
  return { editing, saving, draft, set, start, cancel, doSave };
}

function CardShell({
  title, canEdit, edit, children,
}: { title: string; canEdit: boolean; edit: CardEdit<any>; children: React.ReactNode }) {
  return (
    <Card>
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

// ==============================================================================================
export default function EmployeeOverviewTab({
  detail, meta, canEdit, onChanged,
}: {
  detail: WorkforceDetail;
  meta: WorkforceMeta | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const wfId = detail.workforce.id;

  // Merge one card's header + employee edits onto the full request and persist.
  const save = async (headerPatch: Partial<WorkforceRequest>, empPatch?: Record<string, unknown>) => {
    const base = buildRequest(detail);
    const body: WorkforceRequest = {
      ...base, ...headerPatch,
      employee: { ...base.employee, ...(empPatch || {}) },
    };
    await workforceApi.update(wfId, body);
    toast.success("Saved");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <PersonalCard detail={detail} meta={meta} canEdit={canEdit} save={save} />
      <ContactCard detail={detail} canEdit={canEdit} save={save} />
      <IdentityCard detail={detail} canEdit={canEdit} save={save} />
      <EmergencyCard detail={detail} canEdit={canEdit} save={save} />
      <EmploymentCard detail={detail} meta={meta} canEdit={canEdit} save={save} />
      <BankCard detail={detail} canEdit={canEdit} save={save} />
    </div>
  );
}

type SaveFn = (headerPatch: Partial<WorkforceRequest>, empPatch?: Record<string, unknown>) => Promise<void>;
type CardProps = { detail: WorkforceDetail; canEdit: boolean; save: SaveFn };

// --- Personal ---------------------------------------------------------------------------------
function PersonalCard({ detail, meta, canEdit, save }: CardProps & { meta: WorkforceMeta | null }) {
  const w = detail.workforce;
  const edit = useCardEdit(
    () => ({
      fullName: w.fullName ?? "", dateOfBirth: dateInput(w.dateOfBirth), gender: w.gender ?? "",
      primarySkill: w.primarySkill ?? "", experienceYears: (w.experienceYears ?? "") as any,
    }),
    (d) => save({
      fullName: d.fullName, dateOfBirth: d.dateOfBirth || undefined, gender: d.gender || undefined,
      primarySkill: d.primarySkill || undefined,
      experienceYears: d.experienceYears === "" ? undefined : Number(d.experienceYears),
    }),
  );
  const e = edit.editing;
  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : undefined);
  return (
    <CardShell title="Personal" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Full name" editing={e} view={w.fullName}>
          <TextInput value={edit.draft.fullName} onChange={edit.set("fullName")} />
        </Cell>
        <Cell label="Date of birth" editing={e} view={fmtDate(w.dateOfBirth)}>
          <TextInput type="date" value={edit.draft.dateOfBirth} onChange={edit.set("dateOfBirth")} />
        </Cell>
        <Cell label="Gender" editing={e} view={w.gender}>
          <SelectInput value={edit.draft.gender} onChange={edit.set("gender")} options={GENDERS} />
        </Cell>
        <Cell label="Primary skill" editing={e} view={w.primarySkill}>
          <SelectInput value={edit.draft.primarySkill} onChange={edit.set("primarySkill")} options={meta?.skills ?? []} />
        </Cell>
        <Cell label="Experience" editing={e} view={w.experienceYears != null ? `${w.experienceYears} yrs` : undefined}>
          <TextInput type="number" inputMode="numeric" value={edit.draft.experienceYears} onChange={edit.set("experienceYears") as any} />
        </Cell>
      </div>
    </CardShell>
  );
}

// --- Contact & address ------------------------------------------------------------------------
function ContactCard({ detail, canEdit, save }: CardProps) {
  const w = detail.workforce;
  const edit = useCardEdit(
    () => ({
      email: w.email ?? "", mobile: w.mobile ?? "",
      addressLine1: w.addressLine1 ?? "", addressLine2: w.addressLine2 ?? "",
      city: w.city ?? "", state: w.state ?? "", country: w.country ?? "", pincode: w.pincode ?? "",
    }),
    (d) => save({
      email: d.email || undefined, mobile: d.mobile || undefined,
      addressLine1: d.addressLine1 || undefined, addressLine2: d.addressLine2 || undefined,
      city: d.city || undefined, state: d.state || undefined,
      country: d.country || undefined, pincode: d.pincode || undefined,
    }),
  );
  const e = edit.editing;
  const address = [w.addressLine1, w.addressLine2, w.city, w.state, w.country, w.pincode].filter(Boolean).join(", ");
  return (
    <CardShell title="Contact & address" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Email" editing={e} view={w.email}>
          <TextInput type="email" inputMode="email" value={edit.draft.email} onChange={edit.set("email")} />
        </Cell>
        <Cell label="Phone" editing={e} view={w.mobile}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.mobile} onChange={edit.set("mobile")} />
        </Cell>
        {e ? (
          <>
            <div className="col-span-2">
              <Cell label="Address line 1" editing={e}><TextInput value={edit.draft.addressLine1} onChange={edit.set("addressLine1")} /></Cell>
            </div>
            <div className="col-span-2">
              <Cell label="Address line 2" editing={e}><TextInput value={edit.draft.addressLine2} onChange={edit.set("addressLine2")} /></Cell>
            </div>
            <Cell label="City" editing={e}><TextInput value={edit.draft.city} onChange={edit.set("city")} /></Cell>
            <Cell label="State" editing={e}><TextInput value={edit.draft.state} onChange={edit.set("state")} /></Cell>
            <Cell label="Country" editing={e}><TextInput value={edit.draft.country} onChange={edit.set("country")} /></Cell>
            <Cell label="Pincode" editing={e}><TextInput inputMode="numeric" value={edit.draft.pincode} onChange={edit.set("pincode")} /></Cell>
          </>
        ) : (
          <div className="col-span-2 md:col-span-4">
            <InfoItem label="Address" value={address || undefined} />
          </div>
        )}
      </div>
    </CardShell>
  );
}

// --- Identity ---------------------------------------------------------------------------------
function IdentityCard({ detail, canEdit, save }: CardProps) {
  const w = detail.workforce;
  const edit = useCardEdit(
    () => ({
      aadhaarNumber: w.aadhaarNumber ?? "", panNumber: w.panNumber ?? "",
      drivingLicense: w.drivingLicense ?? "", passportNumber: w.passportNumber ?? "",
    }),
    (d) => save({
      aadhaarNumber: d.aadhaarNumber || undefined, panNumber: d.panNumber || undefined,
      drivingLicense: d.drivingLicense || undefined, passportNumber: d.passportNumber || undefined,
    }),
  );
  const e = edit.editing;
  return (
    <CardShell title="Identity" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Aadhaar" editing={e} view={w.aadhaarNumber}>
          <TextInput value={edit.draft.aadhaarNumber} onChange={edit.set("aadhaarNumber")} />
        </Cell>
        <Cell label="PAN" editing={e} view={w.panNumber}>
          <TextInput value={edit.draft.panNumber} onChange={edit.set("panNumber")} />
        </Cell>
        <Cell label="Driving license" editing={e} view={w.drivingLicense}>
          <TextInput value={edit.draft.drivingLicense} onChange={edit.set("drivingLicense")} />
        </Cell>
        <Cell label="Passport" editing={e} view={w.passportNumber}>
          <TextInput value={edit.draft.passportNumber} onChange={edit.set("passportNumber")} />
        </Cell>
      </div>
    </CardShell>
  );
}

// --- Emergency contact ------------------------------------------------------------------------
function EmergencyCard({ detail, canEdit, save }: CardProps) {
  const w = detail.workforce;
  const edit = useCardEdit(
    () => ({
      emergencyContactName: w.emergencyContactName ?? "",
      emergencyRelationship: w.emergencyRelationship ?? "",
      emergencyPhone: w.emergencyPhone ?? "",
    }),
    (d) => save({
      emergencyContactName: d.emergencyContactName || undefined,
      emergencyRelationship: d.emergencyRelationship || undefined,
      emergencyPhone: d.emergencyPhone || undefined,
    }),
  );
  const e = edit.editing;
  return (
    <CardShell title="Emergency contact" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Name" editing={e} view={w.emergencyContactName}>
          <TextInput value={edit.draft.emergencyContactName} onChange={edit.set("emergencyContactName")} />
        </Cell>
        <Cell label="Relationship" editing={e} view={w.emergencyRelationship}>
          <TextInput value={edit.draft.emergencyRelationship} onChange={edit.set("emergencyRelationship")} />
        </Cell>
        <Cell label="Phone" editing={e} view={w.emergencyPhone}>
          <TextInput type="tel" inputMode="tel" value={edit.draft.emergencyPhone} onChange={edit.set("emergencyPhone")} />
        </Cell>
      </div>
    </CardShell>
  );
}

// --- Employment (employee-extension fields) ---------------------------------------------------
function EmploymentCard({ detail, meta, canEdit, save }: CardProps & { meta: WorkforceMeta | null }) {
  const emp = detail.employee || {};
  const salaryTypes = meta?.salaryTypes?.length ? meta.salaryTypes : ["MONTHLY", "DAILY", "HOURLY"];
  const deptOptions = (meta?.departments ?? []).map((d) => ({ value: String(d.id), label: d.name }));
  const edit = useCardEdit(
    () => ({
      departmentId: emp.department?.id ? String(emp.department.id) : "",
      designation: emp.designation ?? "",
      joiningDate: dateInput(emp.dateOfJoining),
      shift: emp.shift ?? "",
      salaryType: emp.salaryType ?? "",
      attendanceRequired: emp.attendanceRequired ?? true,
      leavePolicy: emp.leavePolicy ?? "",
    }),
    (d) => save({}, {
      departmentId: d.departmentId ? Number(d.departmentId) : undefined,
      designation: d.designation || undefined,
      joiningDate: d.joiningDate || undefined,
      shift: d.shift || undefined,
      salaryType: d.salaryType || undefined,
      attendanceRequired: d.attendanceRequired,
      leavePolicy: d.leavePolicy || undefined,
    }),
  );
  const e = edit.editing;
  const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : undefined);
  return (
    <CardShell title="Employment" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        {/* Employee ID is system-assigned and not editable inline. */}
        <InfoItem label="Employee ID" value={emp.employeeCode} />
        <Cell label="Department" editing={e} view={emp.department?.name}>
          <SelectInput value={edit.draft.departmentId} onChange={edit.set("departmentId")} options={deptOptions} />
        </Cell>
        <Cell label="Designation" editing={e} view={emp.designation}>
          <TextInput value={edit.draft.designation} onChange={edit.set("designation")} />
        </Cell>
        <Cell label="Date of joining" editing={e} view={fmtDate(emp.dateOfJoining)}>
          <TextInput type="date" value={edit.draft.joiningDate} onChange={edit.set("joiningDate")} />
        </Cell>
        <Cell label="Shift" editing={e} view={emp.shift}>
          <TextInput value={edit.draft.shift} onChange={edit.set("shift")} />
        </Cell>
        <Cell label="Salary type" editing={e} view={emp.salaryType}>
          <SelectInput value={edit.draft.salaryType} onChange={edit.set("salaryType")} options={salaryTypes} />
        </Cell>
        <Cell label="Attendance" editing={e} view={emp.attendanceRequired ? "Required" : "Not required"}>
          <label className="flex items-center gap-2 h-9 text-sm">
            <input type="checkbox" className="h-4 w-4"
                   checked={edit.draft.attendanceRequired}
                   onChange={(ev) => edit.set("attendanceRequired")(ev.target.checked)} />
            Required
          </label>
        </Cell>
        <Cell label="Leave policy" editing={e} view={emp.leavePolicy}>
          <TextInput value={edit.draft.leavePolicy} onChange={edit.set("leavePolicy")} />
        </Cell>
      </div>
    </CardShell>
  );
}

// --- Bank & statutory (employee-extension fields) ---------------------------------------------
function BankCard({ detail, canEdit, save }: CardProps) {
  const emp = detail.employee || {};
  const edit = useCardEdit(
    () => ({
      bankAccount: emp.bankAccount ?? "", ifsc: emp.ifsc ?? "",
      pfNumber: emp.pfNumber ?? "", esiNumber: emp.esiNumber ?? "", uan: emp.uan ?? "",
    }),
    (d) => save({}, {
      bankAccount: d.bankAccount || undefined, ifsc: d.ifsc || undefined,
      pfNumber: d.pfNumber || undefined, esiNumber: d.esiNumber || undefined, uan: d.uan || undefined,
    }),
  );
  const e = edit.editing;
  return (
    <CardShell title="Bank & statutory" canEdit={canEdit} edit={edit}>
      <div className={GRID}>
        <Cell label="Bank account" editing={e} view={emp.bankAccount}>
          <TextInput value={edit.draft.bankAccount} onChange={edit.set("bankAccount")} />
        </Cell>
        <Cell label="IFSC" editing={e} view={emp.ifsc}>
          <TextInput value={edit.draft.ifsc} onChange={edit.set("ifsc")} />
        </Cell>
        <Cell label="PF number" editing={e} view={emp.pfNumber}>
          <TextInput value={edit.draft.pfNumber} onChange={edit.set("pfNumber")} />
        </Cell>
        <Cell label="ESI number" editing={e} view={emp.esiNumber}>
          <TextInput value={edit.draft.esiNumber} onChange={edit.set("esiNumber")} />
        </Cell>
        <Cell label="UAN" editing={e} view={emp.uan}>
          <TextInput value={edit.draft.uan} onChange={edit.set("uan")} />
        </Cell>
      </div>
    </CardShell>
  );
}
