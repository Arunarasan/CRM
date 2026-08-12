import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { workforceApi } from "@/api/workforceApi";
import type { WorkforceDetail, WorkforceMeta } from "@/types/workforce";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPE_STYLES, WORKFORCE_STATUS_TONE } from "@/types/workforce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, FileText, ExternalLink } from "lucide-react";
import AddWorkforceDialog from "./AddWorkforceDialog";
import WorkforceFinanceTab from "./WorkforceFinanceTab";

export default function WorkforceProfilePage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<WorkforceDetail | null>(null);
  const [meta, setMeta] = useState<WorkforceMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState<"profile" | "financial">("profile");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    workforceApi.get(Number(id)).then(setDetail).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { workforceApi.meta().then(setMeta).catch(console.error); }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!detail) return <div className="p-8 text-center text-muted-foreground">Workforce not found.</div>;

  const w = detail.workforce;
  const emp = detail.employee;
  const con = detail.contractor;
  const isEmployee = w.workforceType === "EMPLOYEE";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/workforce" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Back to directory
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {w.profilePhotoUrl
            ? <img src={w.profilePhotoUrl} alt="" className="w-16 h-16 rounded-full object-cover border" />
            : <div className="w-16 h-16 rounded-full bg-slate-200 grid place-items-center text-xl font-bold text-slate-500">
                {w.fullName?.charAt(0) ?? "?"}
              </div>}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{w.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={RESOURCE_TYPE_STYLES[w.workforceType]}>{RESOURCE_TYPE_LABELS[w.workforceType]}</Badge>
              <Badge className={WORKFORCE_STATUS_TONE[w.status]}>{w.status.replace(/_/g, " ")}</Badge>
              {w.primarySkill && <span className="text-sm text-muted-foreground">{w.primarySkill}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => setEdit(true)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
      </div>

      <div className="flex gap-2 border-b">
        {(["profile", "financial"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "financial" ? (isEmployee ? "Payroll" : "Payments") : "Profile"}
          </button>
        ))}
      </div>

      {tab === "financial" && <WorkforceFinanceTab workforceId={detail.workforce.id} />}

      {tab === "profile" && (<>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Active projects" value={detail.activeProjects} />
        <Stat label="Attendance" value={detail.attendanceRequired ? "Required" : "Not required"} />
        <Stat label="Experience" value={w.experienceYears != null ? `${w.experienceYears} yrs` : "—"} />
      </div>

      <Card title="Contact & address">
        <Info label="Mobile" value={w.mobile} />
        <Info label="Email" value={w.email} />
        <Info label="Date of birth" value={w.dateOfBirth} />
        <Info label="Gender" value={w.gender} />
        <Info label="Address" value={[w.addressLine1, w.addressLine2, w.city, w.state, w.country, w.pincode].filter(Boolean).join(", ")} />
      </Card>

      <Card title="Identity">
        <Info label="Aadhaar" value={w.aadhaarNumber} />
        <Info label="PAN" value={w.panNumber} />
        <Info label="Driving license" value={w.drivingLicense} />
        <Info label="Passport" value={w.passportNumber} />
      </Card>

      <Card title="Emergency contact">
        <Info label="Name" value={w.emergencyContactName} />
        <Info label="Relationship" value={w.emergencyRelationship} />
        <Info label="Phone" value={w.emergencyPhone} />
      </Card>

      {/* Type-specific extension + deep-link into the operational module */}
      {isEmployee && emp && (
        <Card title="Employment (payroll & HR)"
              action={<Link to={`/hr/employees/${emp.id}`} className="text-sm text-primary flex items-center gap-1">
                Payroll & leave <ExternalLink className="w-3.5 h-3.5" /></Link>}>
          <Info label="Employee ID" value={emp.employeeCode} />
          <Info label="Department" value={emp.department?.name} />
          <Info label="Designation" value={emp.designation} />
          <Info label="Joining date" value={emp.dateOfJoining} />
          <Info label="Salary" value={emp.baseSalary != null ? `₹${emp.baseSalary}` : undefined} />
          <Info label="Salary type" value={emp.salaryType} />
          <Info label="Shift" value={emp.shift} />
          <Info label="PF / ESI" value={[emp.pfNumber, emp.esiNumber].filter(Boolean).join(" / ")} />
          <Info label="Bank" value={[emp.bankAccount, emp.ifsc].filter(Boolean).join(" · ")} />
          <Info label="UAN" value={emp.uan} />
        </Card>
      )}

      {!isEmployee && con && (
        <Card title="Contract & commercials"
              action={<Link to={`/contractors/directory/${con.id}`} className="text-sm text-primary flex items-center gap-1">
                Work packages, bills & ledger <ExternalLink className="w-3.5 h-3.5" /></Link>}>
          <Info label="Company" value={con.companyName} />
          <Info label="Contractor code" value={con.contractorCode} />
          <Info label="Contact person" value={con.contactPerson} />
          <Info label="GST" value={con.gstin} />
          <Info label="Contract" value={[con.agreementStartDate, con.agreementEndDate].filter(Boolean).join(" → ")} />
          <Info label="Labour rate" value={con.dailyRate != null ? `₹${con.dailyRate}` : undefined} />
          <Info label="Payment terms" value={con.paymentTerms} />
          <Info label="Agreement no." value={con.agreementNumber} />
          <Info label="Service categories" value={con.trades} />
          <Info label="TDS applicable" value={con.tdsApplicable == null ? undefined : (con.tdsApplicable ? "Yes" : "No")} />
        </Card>
      )}

      <Card title="Documents">
        {detail.documents.length === 0
          ? <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          : <ul className="divide-y">
              {detail.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-sm">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="font-medium w-28">{d.docType}</span>
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" title={d.fileName} className="text-primary hover:underline truncate min-w-0">
                    {d.fileName}
                  </a>
                </li>
              ))}
            </ul>}
      </Card>
      </>)}

      <AddWorkforceDialog open={edit} onOpenChange={setEdit} meta={meta} existing={detail} onSaved={load} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1 border-b border-slate-50">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right">{value || "—"}</span>
    </div>
  );
}
