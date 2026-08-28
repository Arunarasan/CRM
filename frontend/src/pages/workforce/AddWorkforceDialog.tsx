import { useEffect, useMemo, useState } from "react";
import { workforceApi } from "@/api/workforceApi";
import type {
  WorkforceMeta, WorkforceRequest, WorkforceDetail, ResourceType,
} from "@/types/workforce";
import { WORKFORCE_STATUSES } from "@/types/workforce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import FileUploadField from "@/components/FileUploadField";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

const DOC_TYPES = ["AADHAAR", "PAN", "PHOTO", "CERTIFICATE", "AGREEMENT", "OTHER"];

type PendingDoc = { docType: string; fileUrl: string; fileName: string };

export default function AddWorkforceDialog({
  open, onOpenChange, meta, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta: WorkforceMeta | null;
  existing?: WorkforceDetail | null;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [step, setStep] = useState<1 | 2>(isEdit ? 2 : 1);
  const [form, setForm] = useState<WorkforceRequest>({ workforceType: "EMPLOYEE" });
  const [docs, setDocs] = useState<PendingDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // (Re)initialise whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDocs([]);
    if (existing) {
      const w = existing.workforce;
      const e = existing.employee || {};
      const c = existing.contractor || {};
      setStep(2);
      setForm({
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
        employee: w.workforceType === "EMPLOYEE" ? {
          employeeCode: e.employeeCode, departmentId: e.department?.id, designation: e.designation,
          joiningDate: e.dateOfJoining, salary: e.baseSalary, salaryType: e.salaryType, shift: e.shift,
          attendanceRequired: e.attendanceRequired, leavePolicy: e.leavePolicy,
          payrollEnabled: e.payrollEnabled, pfNumber: e.pfNumber, esiNumber: e.esiNumber,
          bankAccount: e.bankAccount, ifsc: e.ifsc, uan: e.uan,
        } : undefined,
        contractor: w.workforceType === "CONTRACTOR" ? {
          companyName: c.companyName, contractorCode: c.contractorCode, contactPerson: c.contactPerson,
          gstNumber: c.gstin, contractStartDate: c.agreementStartDate, contractEndDate: c.agreementEndDate,
          labourRate: c.dailyRate, paymentTerms: c.paymentTerms, agreementNumber: c.agreementNumber,
          serviceCategories: c.trades, tdsApplicable: c.tdsApplicable, insuranceDetails: c.insuranceNumber,
        } : undefined,
      });
    } else {
      setStep(1);
      setForm({ workforceType: "EMPLOYEE", status: "AVAILABLE" });
    }
  }, [open, existing]);

  const creatableTypes = useMemo(
    () => (meta?.types || []).filter((t) => t.creatable),
    [meta],
  );

  const set = (k: keyof WorkforceRequest, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setEmp = (k: string, v: unknown) =>
    setForm((f) => ({ ...f, employee: { ...(f.employee || {}), [k]: v } }));
  const setCon = (k: string, v: unknown) =>
    setForm((f) => ({ ...f, contractor: { ...(f.contractor || {}), [k]: v } }));

  const isEmployee = form.workforceType === "EMPLOYEE";
  const isContractor = form.workforceType === "CONTRACTOR";

  const save = async () => {
    if (!form.fullName?.trim()) { setError("Full name is required."); return; }
    if (isEmployee && !form.email?.trim()) { setError("Email is required for an employee."); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = isEdit && existing
        ? await workforceApi.update(existing.workforce.id, form)
        : await workforceApi.create(form);
      const id = saved.workforce.id;
      for (const d of docs) {
        if (d.fileUrl) await workforceApi.addDocument(id, d);
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this workforce record.");
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = (t: ResourceType) =>
    (meta?.types.find((x) => x.value === t)?.label) || t;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${form.fullName || "Workforce"}` : "Add Workforce"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — select type */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select workforce type to begin.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {creatableTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("workforceType", t.value)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                    form.workforceType === t.value
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full border-2 ${
                    form.workforceType === t.value ? "border-primary bg-primary" : "border-slate-300"
                  }`} />
                  <span className="font-semibold text-slate-800">{t.label}</span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => setStep(2)}>
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2 — common form + conditional fields */}
        {step === 2 && (
          <div className="space-y-5">
            {!isEdit && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <ArrowLeft className="w-3 h-3" /> Change type ({typeLabel(form.workforceType)})
              </button>
            )}

            <Section title="Basic information">
              <Grid>
                <Field label="Full name *">
                  <Input value={form.fullName ?? ""} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Mobile number">
                  <Input value={form.mobile ?? ""} onChange={(e) => set("mobile", e.target.value)} />
                </Field>
                <Field label={`Email${isEmployee ? " *" : ""}`}>
                  <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Date of birth">
                  <Input type="date" value={form.dateOfBirth ?? ""} onChange={(e) => set("dateOfBirth", e.target.value)} />
                </Field>
                <Field label="Gender">
                  <Sel value={form.gender ?? ""} onChange={(v) => set("gender", v)}
                       options={["", "MALE", "FEMALE", "OTHER"]} />
                </Field>
              </Grid>
              <div className="mt-3 max-w-sm">
                <FileUploadField
                  module="WORKFORCE"
                  label="Profile photo"
                  accept="image/*"
                  value={form.profilePhotoUrl}
                  onChange={({ url }) => set("profilePhotoUrl", url)}
                />
              </div>
            </Section>

            <Section title="Address">
              <Grid>
                <Field label="Address"><Input value={form.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} /></Field>
                <Field label="Address line 2"><Input value={form.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} /></Field>
                <Field label="City"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="State"><Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
                <Field label="Country"><Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} /></Field>
                <Field label="PIN code"><Input value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)} /></Field>
              </Grid>
            </Section>

            <Section title="Identity">
              <Grid>
                <Field label="Aadhaar number"><Input value={form.aadhaarNumber ?? ""} onChange={(e) => set("aadhaarNumber", e.target.value)} /></Field>
                <Field label="PAN number"><Input value={form.panNumber ?? ""} onChange={(e) => set("panNumber", e.target.value)} /></Field>
                <Field label="Driving license"><Input value={form.drivingLicense ?? ""} onChange={(e) => set("drivingLicense", e.target.value)} /></Field>
                <Field label="Passport (optional)"><Input value={form.passportNumber ?? ""} onChange={(e) => set("passportNumber", e.target.value)} /></Field>
              </Grid>
            </Section>

            <Section title="Emergency contact">
              <Grid>
                <Field label="Contact name"><Input value={form.emergencyContactName ?? ""} onChange={(e) => set("emergencyContactName", e.target.value)} /></Field>
                <Field label="Relationship"><Input value={form.emergencyRelationship ?? ""} onChange={(e) => set("emergencyRelationship", e.target.value)} /></Field>
                <Field label="Phone number"><Input value={form.emergencyPhone ?? ""} onChange={(e) => set("emergencyPhone", e.target.value)} /></Field>
              </Grid>
            </Section>

            <Section title="Skills">
              <Grid>
                <Field label="Primary skill">
                  <Sel value={form.primarySkill ?? ""} onChange={(v) => set("primarySkill", v)}
                       options={["", ...(meta?.skills ?? [])]} />
                </Field>
                <Field label="Secondary skills (comma separated)">
                  <Input value={form.secondarySkills ?? ""} onChange={(e) => set("secondarySkills", e.target.value)}
                         placeholder="Painting, Tiling" />
                </Field>
                <Field label="Experience (years)">
                  <Input type="number" value={form.experienceYears ?? ""} onChange={(e) => set("experienceYears", num(e.target.value))} />
                </Field>
                <Field label="Certifications"><Input value={form.certifications ?? ""} onChange={(e) => set("certifications", e.target.value)} /></Field>
              </Grid>
            </Section>

            <Section title="Project information">
              <Grid>
                <Field label="Available from">
                  <Input type="date" value={form.availableFrom ?? ""} onChange={(e) => set("availableFrom", e.target.value)} />
                </Field>
                <Field label="Current status">
                  <Sel value={form.status ?? "AVAILABLE"} onChange={(v) => set("status", v)}
                       options={WORKFORCE_STATUSES as unknown as string[]} />
                </Field>
              </Grid>
            </Section>

            {/* --- Conditional: Employee only --- */}
            {isEmployee && (
              <Section title="Employee details" tone="indigo">
                <Grid>
                  <Field label="Employee ID"><Input value={form.employee?.employeeCode ?? ""} onChange={(e) => setEmp("employeeCode", e.target.value)} placeholder="auto if blank" /></Field>
                  <Field label="Department">
                    <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                            value={form.employee?.departmentId ?? ""}
                            onChange={(e) => setEmp("departmentId", e.target.value ? Number(e.target.value) : undefined)}>
                      <option value="">—</option>
                      {(meta?.departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Designation"><Input value={form.employee?.designation ?? ""} onChange={(e) => setEmp("designation", e.target.value)} /></Field>
                  <Field label="Joining date"><Input type="date" value={form.employee?.joiningDate ?? ""} onChange={(e) => setEmp("joiningDate", e.target.value)} /></Field>
                  <Field label="Salary"><Input type="number" value={form.employee?.salary ?? ""} onChange={(e) => setEmp("salary", num(e.target.value))} /></Field>
                  <Field label="Salary type">
                    <Sel value={form.employee?.salaryType ?? ""} onChange={(v) => setEmp("salaryType", v)}
                         options={["", ...(meta?.salaryTypes ?? ["MONTHLY", "DAILY", "HOURLY"])]} />
                  </Field>
                  <Field label="Shift"><Input value={form.employee?.shift ?? ""} onChange={(e) => setEmp("shift", e.target.value)} /></Field>
                  <Field label="Leave policy"><Input value={form.employee?.leavePolicy ?? ""} onChange={(e) => setEmp("leavePolicy", e.target.value)} /></Field>
                  <Field label="PF number"><Input value={form.employee?.pfNumber ?? ""} onChange={(e) => setEmp("pfNumber", e.target.value)} /></Field>
                  <Field label="ESI number"><Input value={form.employee?.esiNumber ?? ""} onChange={(e) => setEmp("esiNumber", e.target.value)} /></Field>
                  <Field label="Bank account"><Input value={form.employee?.bankAccount ?? ""} onChange={(e) => setEmp("bankAccount", e.target.value)} /></Field>
                  <Field label="IFSC"><Input value={form.employee?.ifsc ?? ""} onChange={(e) => setEmp("ifsc", e.target.value)} /></Field>
                  <Field label="UAN (optional)"><Input value={form.employee?.uan ?? ""} onChange={(e) => setEmp("uan", e.target.value)} /></Field>
                </Grid>
                <div className="mt-3 flex flex-wrap gap-6">
                  <Check label="Attendance required" checked={form.employee?.attendanceRequired ?? true} onChange={(v) => setEmp("attendanceRequired", v)} />
                  <Check label="Payroll enabled" checked={form.employee?.payrollEnabled ?? true} onChange={(v) => setEmp("payrollEnabled", v)} />
                </div>
              </Section>
            )}

            {/* --- Conditional: Contractor only --- */}
            {isContractor && (
              <Section title="Contractor details" tone="amber">
                <Grid>
                  <Field label="Contractor company name"><Input value={form.contractor?.companyName ?? ""} onChange={(e) => setCon("companyName", e.target.value)} /></Field>
                  <Field label="Contractor code"><Input value={form.contractor?.contractorCode ?? ""} onChange={(e) => setCon("contractorCode", e.target.value)} placeholder="auto if blank" /></Field>
                  <Field label="Contact person"><Input value={form.contractor?.contactPerson ?? ""} onChange={(e) => setCon("contactPerson", e.target.value)} /></Field>
                  <Field label="GST number"><Input value={form.contractor?.gstNumber ?? ""} onChange={(e) => setCon("gstNumber", e.target.value)} /></Field>
                  <Field label="Contract start date"><Input type="date" value={form.contractor?.contractStartDate ?? ""} onChange={(e) => setCon("contractStartDate", e.target.value)} /></Field>
                  <Field label="Contract end date"><Input type="date" value={form.contractor?.contractEndDate ?? ""} onChange={(e) => setCon("contractEndDate", e.target.value)} /></Field>
                  <Field label="Labour rate"><Input type="number" value={form.contractor?.labourRate ?? ""} onChange={(e) => setCon("labourRate", num(e.target.value))} /></Field>
                  <Field label="Payment terms"><Input value={form.contractor?.paymentTerms ?? ""} onChange={(e) => setCon("paymentTerms", e.target.value)} /></Field>
                  <Field label="Agreement number"><Input value={form.contractor?.agreementNumber ?? ""} onChange={(e) => setCon("agreementNumber", e.target.value)} /></Field>
                  <Field label="Service categories (comma separated)"><Input value={form.contractor?.serviceCategories ?? ""} onChange={(e) => setCon("serviceCategories", e.target.value)} /></Field>
                  <Field label="Insurance details (optional)"><Input value={form.contractor?.insuranceDetails ?? ""} onChange={(e) => setCon("insuranceDetails", e.target.value)} /></Field>
                </Grid>
                <div className="mt-3">
                  <Check label="TDS applicable" checked={form.contractor?.tdsApplicable ?? false} onChange={(v) => setCon("tdsApplicable", v)} />
                </div>
              </Section>
            )}

            {/* --- Documents --- */}
            <Section title="Documents">
              <p className="text-xs text-muted-foreground mb-2">
                Upload Aadhaar, PAN, photo, certificates, agreements or other documents.
              </p>
              <div className="space-y-3">
                {docs.map((d, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-end sm:border-0 sm:p-0">
                    <div className="w-full sm:w-40">
                      <Label className="text-xs text-slate-500">Type</Label>
                      <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                              value={d.docType}
                              onChange={(e) => setDocs((arr) => arr.map((x, j) => j === i ? { ...x, docType: e.target.value } : x))}>
                        {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <FileUploadField
                        module="WORKFORCE"
                        label="File"
                        value={d.fileUrl}
                        onChange={({ url, fileName }) =>
                          setDocs((arr) => arr.map((x, j) => j === i ? { ...x, fileUrl: url, fileName: fileName || x.fileName || "document" } : x))}
                      />
                    </div>
                    <Button variant="ghost" size="sm" className="self-end sm:self-auto" onClick={() => setDocs((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm"
                        onClick={() => setDocs((arr) => [...arr, { docType: "OTHER", fileUrl: "", fileName: "" }])}>
                  + Add document
                </Button>
              </div>
            </Section>

            {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</div>}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : (isEdit ? "Save changes" : "Create Workforce")}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function num(v: string): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function Section({ title, tone, children }: { title: string; tone?: "indigo" | "amber"; children: React.ReactNode }) {
  const bar = tone === "indigo" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-400";
  return (
    <section>
      <h4 className={`text-xs font-bold uppercase mb-2 ${bar}`}>{title}</h4>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
            value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o === "" ? "—" : o.replace(/_/g, " ")}</option>)}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
