import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "@/lib/api";
import { resolveFileUrl } from "@/lib/uploadFile";
import { format } from "date-fns";
import { ArrowLeft, Briefcase, FileText, CalendarClock, HandCoins, Award, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import FileUploadField from "@/components/FileUploadField";
import PerformanceScoreCard from "./hr/PerformanceScoreCard";

const DOC_TYPES = ["AADHAAR", "PAN", "OFFER_LETTER", "EXPERIENCE_LETTER", "RESUME", "CERTIFICATE", "CONTRACT", "OTHER"];

export default function EmployeeProfile() {
  const { id } = useParams();
  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [score, setScore] = useState<any>(null);

  // Add Document dialog
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [docForm, setDocForm] = useState<any>({ documentName: "", documentType: "AADHAAR", fileUrl: "" });
  const [savingDoc, setSavingDoc] = useState(false);

  // Add Review dialog
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState<any>({ rating: 4, comments: "", reviewerName: "" });
  const [savingReview, setSavingReview] = useState(false);

  const loadDocuments = () => api.get(`/hr/employees/${id}/documents`).then(res => setDocuments(res.data));
  const loadPerformance = () => {
    api.get(`/hr/employees/${id}/performance`).then(res => setPerformance(res.data));
    api.get(`/hr/employees/${id}/performance/score`).then(res => setScore(res.data)).catch(() => setScore(null));
  };

  useEffect(() => {
    api.get(`/hr/employees/${id}`).then(res => setEmployee(res.data));
    api.get(`/hr/employees/${id}/attendance`).then(res => setAttendance(res.data));
    api.get(`/hr/employees/${id}/leaves`).then(res => setLeaves(res.data));
    api.get(`/hr/employees/${id}/payroll`).then(res => setPayroll(res.data));
    loadDocuments();
    loadPerformance();
  }, [id]);

  const handleSaveDocument = () => {
    if (!docForm.documentName.trim() || !docForm.fileUrl) { alert("Please provide a document name and file."); return; }
    setSavingDoc(true);
    api.post(`/hr/documents`, { ...docForm, employee: { id: Number(id) } })
      .then(() => {
        setIsDocOpen(false);
        setDocForm({ documentName: "", documentType: "AADHAAR", fileUrl: "" });
        loadDocuments();
      })
      .catch(() => alert("Failed to save document"))
      .finally(() => setSavingDoc(false));
  };

  const handleSaveReview = () => {
    setSavingReview(true);
    api.post(`/hr/performance`, { ...reviewForm, employee: { id: Number(id) } })
      .then(() => {
        setIsReviewOpen(false);
        setReviewForm({ rating: 4, comments: "", reviewerName: "" });
        loadPerformance();
      })
      .catch(() => alert("Failed to save review"))
      .finally(() => setSavingReview(false));
  };

  if (!employee) return <div className="p-8 font-bold text-slate-500">Loading Profile...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
        <div className="bg-white border-b px-8 py-6 flex items-start gap-6 sticky top-0 z-10">
            <Link to="/hr"><Button variant="ghost" size="icon" className="rounded-full mt-1"><ArrowLeft className="w-5 h-5"/></Button></Link>
            
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-4 border-white shadow-md overflow-hidden text-3xl font-black text-slate-400">
                {employee.firstName[0]}{employee.lastName[0]}
            </div>
            
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{employee.firstName} {employee.lastName}</h1>
                        <p className="text-sm font-semibold text-blue-600">{employee.designation || 'No Designation'} • {employee.department?.name || 'No Department'}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${
                        employee.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                        {employee.status}
                    </span>
                </div>
                
                <div className="grid grid-cols-4 gap-4 mt-6 text-sm">
                    <div>
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Employee ID</p>
                        <p className="font-semibold text-slate-800">{employee.employeeCode}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Email</p>
                        <p className="font-semibold text-slate-800">{employee.email}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Phone</p>
                        <p className="font-semibold text-slate-800">{employee.phone || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 font-bold uppercase text-[10px]">Date of Joining</p>
                        <p className="font-semibold text-slate-800">{format(new Date(employee.dateOfJoining), 'MMM d, yyyy')}</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
             <Tabs defaultValue="overview" className="w-full flex flex-col">
                <TabsList className="grid w-full grid-cols-5 bg-white border shadow-sm p-1 h-12 rounded-xl mb-6 shrink-0">
                    <TabsTrigger value="overview" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Briefcase className="w-4 h-4 mr-2" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="attendance" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <CalendarClock className="w-4 h-4 mr-2" /> Time & Leave
                    </TabsTrigger>
                    <TabsTrigger value="payroll" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <HandCoins className="w-4 h-4 mr-2" /> Payroll
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <FileText className="w-4 h-4 mr-2" /> Documents
                    </TabsTrigger>
                     <TabsTrigger value="performance" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Award className="w-4 h-4 mr-2" /> Performance
                    </TabsTrigger>
                </TabsList>
                
                {/* 1. Overview */}
                <TabsContent value="overview">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                            <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Emergency Contact</h3>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase">Name</p>
                                <p className="font-semibold text-slate-800">{employee.emergencyContactName || 'Not Provided'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase">Phone</p>
                                <p className="font-semibold text-slate-800">{employee.emergencyContactPhone || 'Not Provided'}</p>
                            </div>
                        </div>
                        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
                             <h3 className="font-bold text-slate-800 text-lg border-b pb-2">Compensation Snapshot</h3>
                              <div>
                                <p className="text-sm font-bold text-slate-400 uppercase">Base Salary</p>
                                <p className="text-2xl font-black text-slate-900">${employee.baseSalary?.toFixed(2) || '0.00'}</p>
                                <p className="text-xs text-slate-500">per month</p>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* 2. Attendance & Leave */}
                <TabsContent value="attendance">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                            <div className="p-4 border-b bg-slate-50 shrink-0"><h3 className="font-bold text-slate-800">Attendance Log</h3></div>
                            <div className="flex-1 overflow-y-auto">
                                <Table>
                                    <TableBody>
                                        {attendance.map(a => (
                                            <TableRow key={a.id}>
                                                <TableCell className="font-semibold text-slate-800">{format(new Date(a.date), 'MMM d, yyyy')}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 text-[10px] font-bold rounded ${a.status === 'PRESENT' ? 'bg-green-100 text-green-700' : a.status === 'LEAVE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                        {a.status}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {attendance.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">No records found.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        
                        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px]">
                            <div className="p-4 border-b bg-slate-50 shrink-0"><h3 className="font-bold text-slate-800">Leave History</h3></div>
                            <div className="flex-1 overflow-y-auto">
                                <Table>
                                    <TableBody>
                                        {leaves.map(l => (
                                            <TableRow key={l.id}>
                                                <TableCell>
                                                    <p className="font-bold text-slate-800">{l.type}</p>
                                                    <p className="text-xs text-slate-500">{format(new Date(l.startDate), 'MMM d')} to {format(new Date(l.endDate), 'MMM d')}</p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={`px-2 py-1 text-[10px] font-bold rounded ${l.status === 'APPROVED' ? 'bg-green-100 text-green-700' : l.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                        {l.status}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {leaves.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">No records found.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                
                {/* 3. Payroll */}
                <TabsContent value="payroll">
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Period</TableHead>
                                        <TableHead className="text-right">Basic</TableHead>
                                        <TableHead className="text-right">Allowances</TableHead>
                                        <TableHead className="text-right">Deductions</TableHead>
                                        <TableHead className="text-right">Net Salary</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payroll.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-bold text-slate-800">{p.month} / {p.year}</TableCell>
                                            <TableCell className="text-right font-semibold text-slate-600">${p.basic?.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-semibold text-green-600">+${p.allowances?.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-semibold text-red-600">-${p.deductions?.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-black text-slate-900">${p.netSalary?.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-bold rounded ${p.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {p.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {payroll.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No payroll records found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
                
                 {/* 4. Documents */}
                <TabsContent value="documents">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">Documents ({documents.length})</h3>
                        <Button onClick={() => setIsDocOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Document</Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {documents.map(d => (
                            <a key={d.id} href={resolveFileUrl(d.fileUrl)} target="_blank" rel="noreferrer"
                               className="bg-white border rounded-2xl p-6 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-blue-300 transition-all group">
                                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-slate-800 text-sm truncate">{d.documentName}</h3>
                                    <p className="text-xs text-slate-500">{d.documentType}{d.uploadedDate ? ` • ${format(new Date(d.uploadedDate), 'MMM d, yyyy')}` : ''}</p>
                                </div>
                                {d.fileUrl && <Download className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0" />}
                            </a>
                        ))}
                    </div>
                    {documents.length === 0 && <div className="text-center py-12 text-slate-500 bg-white border rounded-2xl">No documents uploaded.</div>}
                </TabsContent>

                 {/* 5. Performance */}
                <TabsContent value="performance">
                    <div className="space-y-6">
                        {score && <PerformanceScoreCard card={score} />}

                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800">Manual Reviews ({performance.length})</h3>
                            <Button onClick={() => setIsReviewOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add Review</Button>
                        </div>

                        {performance.map(p => (
                            <div key={p.id} className="bg-white border rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800">Performance Review</h3>
                                        <p className="text-sm text-slate-500">by {p.reviewerName} on {format(new Date(p.reviewDate), 'MMM d, yyyy')}</p>
                                    </div>
                                    <div className="flex gap-1 text-amber-400">
                                        {[...Array(5)].map((_, i) => (
                                            <svg key={i} className={`w-5 h-5 ${i < p.rating ? 'fill-current' : 'text-slate-200 fill-current'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
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
                            {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <FileUploadField
                        module="HR_DOCUMENT"
                        label="File"
                        required
                        value={docForm.fileUrl}
                        onChange={({ url, fileName }) => setDocForm((f: any) => ({
                            ...f, fileUrl: url,
                            documentName: f.documentName || fileName || "",
                        }))}
                    />
                    <Button onClick={handleSaveDocument} disabled={savingDoc} className="w-full mt-2">
                        {savingDoc ? "Saving…" : "Save Document"}
                    </Button>
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
                                        className={`text-3xl leading-none ${n <= reviewForm.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
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
                    <Button onClick={handleSaveReview} disabled={savingReview} className="w-full mt-2">
                        {savingReview ? "Saving…" : "Save Review"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
