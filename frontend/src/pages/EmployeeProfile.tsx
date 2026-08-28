import { useState, useEffect, useMemo, Fragment } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useGoBack } from "@/hooks/useGoBack";
import api from "@/lib/api";
import { workforceApi } from "@/api/workforceApi";
import type { WorkforceDetail, WorkforceMeta } from "@/types/workforce";
import { resolveFileUrl } from "@/lib/uploadFile";
import { toast } from "@/components/ui/toast";
import { format } from "date-fns";
import {
  ArrowLeft, Briefcase, FileText, CalendarClock, HandCoins, Award, Plus, Download, Pencil,
  Mail, Phone, Calendar, IdCard, CheckSquare, FolderKanban, ChevronRight, ChevronDown, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import FileUploadField from "@/components/FileUploadField";
import PerformanceScoreCard from "./hr/PerformanceScoreCard";
import WorkforceFinanceTab from "./workforce/WorkforceFinanceTab";
import AddWorkforceDialog from "./workforce/AddWorkforceDialog";
import EmployeeOverviewTab from "./workforce/EmployeeOverviewTab";
import WageSettingsCard from "@/components/hr/WageSettingsCard";
import { inr } from "./workforce/WorkforceFinanceTab";

const DOC_TYPES = ["AADHAAR", "PAN", "OFFER_LETTER", "EXPERIENCE_LETTER", "RESUME", "CERTIFICATE", "CONTRACT", "OTHER"];
const MONTHS_SEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtTime = (t?: string | null) => (t ? String(t).slice(0, 5) : "—");
const hrs = (v: any) => `${Number(v || 0).toFixed(1)}h`;

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
};
const tenure = (doj?: string | null) => {
  if (!doj) return "—";
  const start = new Date(doj); if (isNaN(start.getTime())) return "—";
  const months = Math.max(0, Math.round((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y}y` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m";
};

const VALID_TABS = ["overview", "attendance", "payroll", "documents", "performance"];

export default function EmployeeProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const goBack = useGoBack("/workforce");
  // A deep link (e.g. a "Payroll Request" notification → ?tab=payroll) opens straight to that tab.
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(initialTab && VALID_TABS.includes(initialTab) ? initialTab : "overview");
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [workStats, setWorkStats] = useState<{ tasksDone: number; projectsDone: number } | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);

  // Daily attendance + task-hours sheet (per month)
  const nowD = new Date();
  const [dlMonth, setDlMonth] = useState(nowD.getMonth() + 1);
  const [dlYear, setDlYear] = useState(nowD.getFullYear());
  const [dailyLog, setDailyLog] = useState<any | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Edit (unified workforce dialog)
  const [meta, setMeta] = useState<WorkforceMeta | null>(null);
  const [editDetail, setEditDetail] = useState<WorkforceDetail | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Full workforce master record — drives the inline-editable Overview tab (lead-style cards).
  const [detail, setDetail] = useState<WorkforceDetail | null>(null);

  // Add Document dialog
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docForm, setDocForm] = useState<any>({ documentName: "", documentType: "AADHAAR", fileUrl: "" });
  const [savingDoc, setSavingDoc] = useState(false);

  // Add Review dialog
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState<any>({ rating: 4, comments: "", reviewerName: "" });
  const [savingReview, setSavingReview] = useState(false);

  const loadDetail = (wfId?: number) => {
    if (!wfId) { setDetail(null); return; }
    workforceApi.get(wfId).then(setDetail).catch(() => setDetail(null));
  };
  const loadEmployee = () => api.get(`/hr/employees/${id}`).then(res => {
    setEmployee(res.data);
    loadDetail(res.data?.workforce?.id);
  });
  const loadDocuments = () => api.get(`/hr/employees/${id}/documents`).then(res => setDocuments(res.data));
  const loadPerformance = () => {
    api.get(`/hr/employees/${id}/performance`).then(res => setPerformance(res.data));
    api.get(`/hr/employees/${id}/performance/score`).then(res => setScore(res.data)).catch(() => setScore(null));
  };

  useEffect(() => {
    loadEmployee();
    api.get(`/hr/employees/${id}/attendance`).then(res => setAttendance(res.data)).catch(() => setAttendance([]));
    api.get(`/hr/employees/${id}/leaves`).then(res => setLeaves(res.data)).catch(() => setLeaves([]));
    api.get(`/hr/employees/${id}/work-stats`).then(res => setWorkStats(res.data)).catch(() => setWorkStats(null));
    loadDocuments();
    loadPerformance();
    workforceApi.meta().then(setMeta).catch(() => {});
  }, [id]);

  useEffect(() => {
    api.get(`/hr/employees/${id}/daily-log?month=${dlMonth}&year=${dlYear}`)
      .then(res => setDailyLog(res.data)).catch(() => setDailyLog(null));
  }, [id, dlMonth, dlYear]);

  const presentDays = useMemo(() => attendance.filter(a => a.status === "PRESENT").length, [attendance]);

  const openEdit = () => {
    const wfId = employee?.workforce?.id;
    if (!wfId) { toast.error("No workforce record is linked to this employee."); return; }
    if (detail) { setEditDetail(detail); setIsEditOpen(true); return; }
    workforceApi.get(wfId)
      .then((d) => { setEditDetail(d); setIsEditOpen(true); })
      .catch(() => toast.error("Could not open the editor."));
  };

  const handleSaveDocument = () => {
    if (!docForm.documentName.trim() || !docForm.fileUrl) { toast.error("Please provide a document name and file."); return; }
    setSavingDoc(true);
    api.post(`/hr/documents`, { ...docForm, employee: { id: Number(id) } })
      .then(() => {
        setIsDocOpen(false);
        setDocForm({ documentName: "", documentType: "AADHAAR", fileUrl: "" });
        toast.success("Document added."); loadDocuments();
      })
      .catch(() => toast.error("Failed to save document"))
      .finally(() => setSavingDoc(false));
  };

  const handleSaveReview = () => {
    setSavingReview(true);
    api.post(`/hr/performance`, { ...reviewForm, employee: { id: Number(id) } })
      .then(() => {
        setIsReviewOpen(false);
        setReviewForm({ rating: 4, comments: "", reviewerName: "" });
        toast.success("Review added."); loadPerformance();
      })
      .catch(() => toast.error("Failed to save review"))
      .finally(() => setSavingReview(false));
  };

  if (!employee) return <div className="p-8 font-bold text-slate-500">Loading profile…</div>;

  const w = employee.workforce || {};
  const wfId = w.id as number | undefined;
  const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
  const photo = employee.profilePhotoUrl || w.profilePhotoUrl;
  const statusTone = employee.status === "ACTIVE" ? "bg-green-100 text-green-700"
    : employee.status === "ON_LEAVE" ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-700";

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* -------- Header -------- */}
      <div className="bg-white border-b px-4 md:px-8 py-6 sticky top-0 z-10">
        <div className="flex items-start gap-4 md:gap-6 max-w-7xl mx-auto w-full">
          <Button variant="ghost" size="icon" onClick={goBack} title="Back" className="rounded-full mt-1 shrink-0"><ArrowLeft className="w-5 h-5" /></Button>

          {photo
            ? <img src={resolveFileUrl(photo)} alt="" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-md shrink-0" />
            : <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-4 border-white shadow-md text-3xl font-black text-slate-400">
                {(employee.firstName?.[0] || "") + (employee.lastName?.[0] || "")}
              </div>}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">{fullName}</h1>
                <p className="text-sm font-semibold text-emerald-600">
                  {employee.designation || "No designation"} · {employee.department?.name || "No department"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${statusTone}`}>{employee.status}</span>
                <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="w-4 h-4 mr-1.5" /> Edit</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-5 text-sm">
              <Fact icon={<IdCard className="w-4 h-4" />} label="Employee ID" value={employee.employeeCode} />
              <Fact icon={<Mail className="w-4 h-4" />} label="Email" value={employee.email} />
              <Fact icon={<Phone className="w-4 h-4" />} label="Phone" value={employee.phone || w.mobile} />
              <Fact icon={<Calendar className="w-4 h-4" />} label="Joined" value={fmtDate(employee.dateOfJoining)} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* -------- Quick stats -------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatTile icon={<CheckSquare className="w-5 h-5 text-emerald-600" />} label="Tasks completed" value={workStats?.tasksDone ?? 0} />
          <StatTile icon={<FolderKanban className="w-5 h-5 text-emerald-600" />} label="Projects worked" value={workStats?.projectsDone ?? 0} />
          <StatTile icon={<CalendarClock className="w-5 h-5 text-cyan-600" />} label="Days present" value={presentDays} />
          <StatTile icon={<Briefcase className="w-5 h-5 text-amber-600" />} label="Tenure" value={tenure(employee.dateOfJoining)} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-white border shadow-sm p-1 h-auto md:h-12 rounded-xl mb-6 shrink-0">
            <TabTrig value="overview" icon={<Briefcase className="w-4 h-4 mr-2" />}>Overview</TabTrig>
            <TabTrig value="attendance" icon={<CalendarClock className="w-4 h-4 mr-2" />}>Time &amp; Leave</TabTrig>
            <TabTrig value="payroll" icon={<HandCoins className="w-4 h-4 mr-2" />}>Payroll</TabTrig>
            <TabTrig value="documents" icon={<FileText className="w-4 h-4 mr-2" />}>Documents</TabTrig>
            <TabTrig value="performance" icon={<Award className="w-4 h-4 mr-2" />}>Performance</TabTrig>
          </TabsList>

          {/* ---- Overview (inline-editable cards, lead-profile style) ---- */}
          <TabsContent value="overview">
            {detail
              ? <EmployeeOverviewTab detail={detail} meta={meta} canEdit onChanged={loadEmployee} />
              : <div className="text-center py-12 text-slate-500 bg-white border rounded-2xl">
                  No workforce record linked — profile details unavailable.
                </div>}
          </TabsContent>

          {/* ---- Time & Leave ---- */}
          <TabsContent value="attendance">
            <div className="space-y-6">
              {/* Daily sheet: real per-day worked hours, task hours & earnings */}
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800">Daily attendance &amp; earnings</h3>
                    <p className="text-xs text-slate-500">
                      Clocked hours, real task hours and what was earned each day.
                      {dailyLog?.effectiveHourlyRate != null && Number(dailyLog.effectiveHourlyRate) > 0 && (
                        <> Rate <b className="text-slate-700">{inr(dailyLog.effectiveHourlyRate)}/hr</b>
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                            {dailyLog.rateSource === "DERIVED" ? "from monthly" : "hourly"}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="h-9 rounded-md border bg-white px-2 text-sm font-semibold" value={dlMonth} onChange={e => setDlMonth(Number(e.target.value))}>
                      {MONTHS_SEL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <Input type="number" className="h-9 w-20 text-sm font-semibold" value={dlYear} onChange={e => setDlYear(Number(e.target.value))} />
                  </div>
                </div>

                {/* month summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 border-b">
                  <MiniStat label="Days worked" value={dailyLog?.daysWorked ?? 0} />
                  <MiniStat label="Worked hours" value={hrs(dailyLog?.totalWorkedHours)} />
                  <MiniStat label="Task hours" value={hrs(dailyLog?.totalTaskHours)} />
                  <MiniStat label="Earned" value={inr(dailyLog?.totalEarnings)} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-center p-3">In</th>
                        <th className="text-center p-3">Out</th>
                        <th className="text-right p-3">Worked</th>
                        <th className="text-right p-3">OT</th>
                        <th className="text-right p-3">Task hrs</th>
                        <th className="text-right p-3">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dailyLog?.rows || []).map((r: any) => {
                        const tasks = r.tasks || [];
                        const hasTasks = tasks.length > 0;
                        const open = !!expandedDays[r.date];
                        return (
                        <Fragment key={r.date}>
                        <tr className={`border-t hover:bg-slate-50/70 ${hasTasks ? "cursor-pointer" : ""}`}
                            onClick={() => hasTasks && setExpandedDays(s => ({ ...s, [r.date]: !s[r.date] }))}>
                          <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {hasTasks ? (open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />) : <span className="w-3.5 inline-block" />}
                              {fmtDate(r.date)}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${r.status === "PRESENT" ? "bg-green-100 text-green-700" : r.status === "LEAVE" ? "bg-emerald-100 text-emerald-700" : r.status === "—" ? "bg-slate-100 text-slate-500" : "bg-red-100 text-red-700"}`}>{r.status}</span>
                          </td>
                          <td className="p-3 text-center text-slate-500">{fmtTime(r.checkIn)}</td>
                          <td className="p-3 text-center text-slate-500">{fmtTime(r.checkOut)}</td>
                          <td className="p-3 text-right text-slate-700">{hrs(r.workedHours)}</td>
                          <td className="p-3 text-right text-amber-600">{Number(r.overtimeHours || 0) > 0 ? hrs(r.overtimeHours) : "—"}</td>
                          <td className="p-3 text-right text-cyan-700 font-medium">
                            {hasTasks
                              ? <span className="inline-flex items-center gap-1">{hrs(r.taskHours)}<span className="rounded-full bg-cyan-50 px-1.5 text-[10px] font-bold text-cyan-700">{tasks.length}</span></span>
                              : "—"}
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-600">{Number(r.dayEarnings || 0) > 0 ? inr(r.dayEarnings) : "—"}</td>
                        </tr>
                        {open && hasTasks && (
                          <tr className="bg-slate-50/60">
                            <td className="px-3 pb-3 pt-0" colSpan={8}>
                              <div className="ml-5 rounded-lg border bg-white divide-y">
                                {tasks.map((t: any) => (
                                  <div key={t.taskId} className="flex items-center justify-between gap-3 px-3 py-2">
                                    <div className="min-w-0 flex items-center gap-2">
                                      <ListChecks className="w-4 h-4 text-cyan-600 shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">{t.taskName}</p>
                                        {t.project && <p className="text-[11px] text-slate-400 truncate">{t.project}</p>}
                                      </div>
                                    </div>
                                    <span className="text-sm font-semibold text-cyan-700 shrink-0">{hrs(t.hours)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        );
                      })}
                      {(!dailyLog?.rows || dailyLog.rows.length === 0) && (
                        <tr><td colSpan={8} className="text-center py-10 text-slate-400">No attendance or task time recorded for {MONTHS_SEL[dlMonth - 1]} {dlYear}.</td></tr>
                      )}
                    </tbody>
                    {dailyLog?.rows?.length > 0 && (
                      <tfoot>
                        <tr className="border-t bg-slate-50 font-bold text-slate-700">
                          <td className="p-3" colSpan={4}>Total</td>
                          <td className="p-3 text-right">{hrs(dailyLog.totalWorkedHours)}</td>
                          <td className="p-3 text-right text-amber-700">{hrs(dailyLog.totalOvertimeHours)}</td>
                          <td className="p-3 text-right text-cyan-700">{hrs(dailyLog.totalTaskHours)}</td>
                          <td className="p-3 text-right text-emerald-700">{inr(dailyLog.totalEarnings)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <p className="p-3 text-[11px] text-slate-400 border-t">
                  <b>Worked</b>/<b>OT</b> come from the attendance clock; <b>Task hrs</b> is real time tracked against tasks; <b>Earned</b> is that day’s pay for hourly staff.
                </p>
              </div>

              {/* Leave history */}
              <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50"><h3 className="font-bold text-slate-800">Leave history</h3></div>
                <Table>
                  <TableBody>
                    {leaves.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="font-bold text-slate-800">{l.type}</p>
                          <p className="text-xs text-slate-500">{fmtDate(l.startDate)} to {fmtDate(l.endDate)}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`px-2 py-1 text-[10px] font-bold rounded ${l.status === "APPROVED" ? "bg-green-100 text-green-700" : l.status === "PENDING" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>{l.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {leaves.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">No records found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ---- Payroll (wage settings + full financial: structure, payslips, advances, loans) ---- */}
          <TabsContent value="payroll">
            <div className="space-y-6">
              <WageSettingsCard employee={employee} employeeId={Number(id)} onSaved={loadEmployee} />
              {wfId
                ? <WorkforceFinanceTab workforceId={wfId} />
                : <div className="bg-white border rounded-2xl p-8 text-center text-slate-500 shadow-sm">No workforce record linked — payroll unavailable.</div>}
            </div>
          </TabsContent>

          {/* ---- Documents ---- */}
          <TabsContent value="documents">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Documents ({documents.length})</h3>
              <Button onClick={() => setIsDocOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add document</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map(d => (
                <a key={d.id} href={resolveFileUrl(d.fileUrl)} target="_blank" rel="noreferrer"
                   className="bg-white border rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-emerald-300 transition-all group">
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><FileText className="w-6 h-6" /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 text-sm truncate">{d.documentName}</h3>
                    <p className="text-xs text-slate-500">{d.documentType}{d.uploadedDate ? ` · ${fmtDate(d.uploadedDate)}` : ""}</p>
                  </div>
                  {d.fileUrl && <Download className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0" />}
                </a>
              ))}
            </div>
            {documents.length === 0 && <div className="text-center py-12 text-slate-500 bg-white border rounded-2xl">No documents uploaded.</div>}
          </TabsContent>

          {/* ---- Performance ---- */}
          <TabsContent value="performance">
            <div className="space-y-6">
              {score && <PerformanceScoreCard card={score} />}
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Manual reviews ({performance.length})</h3>
                <Button onClick={() => setIsReviewOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add review</Button>
              </div>
              {performance.map(p => (
                <div key={p.id} className="bg-white border rounded-2xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800">Performance review</h3>
                      <p className="text-sm text-slate-500">by {p.reviewerName} on {fmtDate(p.reviewDate)}</p>
                    </div>
                    <div className="flex gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className={`w-5 h-5 ${i < p.rating ? "fill-current" : "text-slate-200 fill-current"}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-slate-700 text-sm bg-slate-50 p-4 rounded-lg">{p.comments}</p>
                </div>
              ))}
              {performance.length === 0 && <div className="text-center py-12 text-slate-500 bg-white border rounded-2xl">No performance reviews found.</div>}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit (unified workforce dialog) */}
      <AddWorkforceDialog open={isEditOpen} onOpenChange={setIsEditOpen} meta={meta} existing={editDetail} onSaved={() => { setIsEditOpen(false); loadEmployee(); }} />

      {/* Add Document dialog */}
      <Dialog open={isDocOpen} onOpenChange={setIsDocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Document Name</Label>
              <Input value={docForm.documentName} onChange={e => setDocForm({ ...docForm, documentName: e.target.value })} placeholder="e.g. Aadhaar Card" />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm"
                      value={docForm.documentType} onChange={e => setDocForm({ ...docForm, documentType: e.target.value })}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <FileUploadField
              module="HR_DOCUMENT" label="File" required value={docForm.fileUrl}
              onChange={({ url, fileName }) => setDocForm((f: any) => ({ ...f, fileUrl: url, documentName: f.documentName || fileName || "" }))}
            />
            <Button onClick={handleSaveDocument} disabled={savingDoc} className="w-full mt-2">{savingDoc ? "Saving…" : "Save Document"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Performance Review dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Performance Review</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                          className={`text-3xl leading-none ${n <= reviewForm.rating ? "text-amber-400" : "text-slate-200"}`}>★</button>
                ))}
                <span className="ml-2 self-center text-sm font-bold text-slate-600">{reviewForm.rating}/5</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reviewer Name</Label>
              <Input value={reviewForm.reviewerName} onChange={e => setReviewForm({ ...reviewForm, reviewerName: e.target.value })} placeholder="Manager name" />
            </div>
            <div className="space-y-2">
              <Label>Comments</Label>
              <textarea className="w-full min-h-[100px] rounded-md border border-input px-3 py-2 text-sm"
                        value={reviewForm.comments} onChange={e => setReviewForm({ ...reviewForm, comments: e.target.value })}
                        placeholder="Strengths, areas to improve, notes…" />
            </div>
            <Button onClick={handleSaveReview} disabled={savingReview} className="w-full mt-2">{savingReview ? "Saving…" : "Save Review"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabTrig({ value, icon, children }: { value: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <TabsTrigger value={value} className="rounded-lg h-11 md:h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
      {icon}{children}
    </TabsTrigger>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-slate-400 font-bold uppercase text-[10px]"><span className="text-slate-300">{icon}</span>{label}</p>
      <p className="font-semibold text-slate-800 truncate">{value || "—"}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-lg font-black text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-slate-50 grid place-items-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

