import { useState, useEffect } from "react";
import api from "@/lib/api";
import { format } from "date-fns";
import { Plus, Users, Building, CalendarClock, Palmtree, HandCoins, ArrowRight, LineChart, Gauge } from "lucide-react";
import HrFinanceDashboard from "./hr/HrFinanceDashboard";
import { gradeStyle } from "./hr/PerformanceScoreCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function HumanResources() {
  const [activeTab, setActiveTab] = useState("directory");
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  
  // Forms
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [deptForm, setDeptForm] = useState<any>({ name: '', description: '' });
  
  const [isEmpOpen, setIsEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState<any>({ 
      employeeCode: `EMP-${Date.now().toString().slice(-4)}`,
      firstName: '', lastName: '', email: '', dateOfJoining: '', departmentId: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = () => {
      api.get(`/hr/employees`).then(res => setEmployees(res.data.content || []));
      api.get(`/hr/departments`).then(res => setDepartments(res.data || []));
      api.get(`/hr/leaves`).then(res => setLeaves(res.data.content || []));
      api.get(`/hr/payroll`).then(res => setPayroll(res.data.content || []));
      api.get(`/hr/performance/scores`).then(res => setScores(res.data || [])).catch(() => setScores([]));
  };

  const handleSaveDepartment = () => {
      api.post(`/hr/departments`, deptForm)
          .then(() => { setIsDeptOpen(false); fetchData(); })
          .catch(_err => alert("Failed to save department"));
  };
  
  const handleSaveEmployee = () => {
      const payload = {
          ...empForm,
          department: empForm.departmentId ? { id: parseInt(empForm.departmentId) } : null
      };
      api.post(`/hr/employees`, payload)
          .then(() => { setIsEmpOpen(false); fetchData(); })
          .catch(_err => alert("Failed to save employee"));
  };
  
  const handleApproveLeave = (id: number) => {
      api.post(`/hr/leaves/${id}/approve?approvedBy=Admin`)
          .then(() => fetchData())
          .catch(_err => alert("Failed to approve leave"));
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-50">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Human Resources</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce, attendance, leaves, and payroll.</p>
        </div>
        
        {activeTab === "directory" && (
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                    api.post('/hr/sync-employees').then(() => { alert("Users synced!"); fetchData(); }).catch(() => alert("Failed to sync"));
                }}>Sync Users</Button>
                <Dialog open={isEmpOpen} onOpenChange={setIsEmpOpen}>
                    <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/> Add Employee</Button></DialogTrigger>
                    <DialogContent>
                    <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>First Name</Label>
                                <Input value={empForm.firstName} onChange={e => setEmpForm({...empForm, firstName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Last Name</Label>
                                <Input value={empForm.lastName} onChange={e => setEmpForm({...empForm, lastName: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Email <span className="text-red-500">*</span> <span className="text-xs text-slate-400 font-normal">(Required for login access)</span></Label>
                                <Input type="email" value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} placeholder="employee@company.com" required />
                            </div>
                            <div className="space-y-2">
                                <Label>Employee Code</Label>
                                <Input value={empForm.employeeCode} onChange={e => setEmpForm({...empForm, employeeCode: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Date of Joining</Label>
                                <Input type="date" value={empForm.dateOfJoining} onChange={e => setEmpForm({...empForm, dateOfJoining: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>Department</Label>
                                <select className="w-full h-10 rounded-md border border-input px-3 py-2 text-sm" value={empForm.departmentId} onChange={e => setEmpForm({...empForm, departmentId: e.target.value})}>
                                    <option value="">-- Select --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <Button onClick={handleSaveEmployee} className="w-full mt-4">Save Employee</Button>
                    </div>
                </DialogContent>
            </Dialog>
            </div>
        )}
        
        {activeTab === "departments" && (
            <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
                <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2"/> Add Department</Button></DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Department Name</Label>
                            <Input value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} />
                        </div>
                        <Button onClick={handleSaveDepartment} className="w-full mt-4">Save</Button>
                    </div>
                </DialogContent>
            </Dialog>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col h-full">
            <TabsList className="grid w-full max-w-5xl grid-cols-7 bg-white border shadow-sm p-1 h-14 rounded-xl mb-6 shrink-0">
                <TabsTrigger value="directory" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Users className="w-4 h-4 mr-2 hidden sm:block"/> Directory
                </TabsTrigger>
                <TabsTrigger value="performance" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Gauge className="w-4 h-4 mr-2 hidden sm:block"/> Performance
                </TabsTrigger>
                <TabsTrigger value="financial" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <LineChart className="w-4 h-4 mr-2 hidden sm:block"/> Financial
                </TabsTrigger>
                <TabsTrigger value="departments" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Building className="w-4 h-4 mr-2 hidden sm:block"/> Depts
                </TabsTrigger>
                <TabsTrigger value="attendance" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <CalendarClock className="w-4 h-4 mr-2 hidden sm:block"/> Attendance
                </TabsTrigger>
                <TabsTrigger value="leaves" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Palmtree className="w-4 h-4 mr-2 hidden sm:block"/> Leaves
                </TabsTrigger>
                <TabsTrigger value="payroll" className="rounded-lg h-full font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <HandCoins className="w-4 h-4 mr-2 hidden sm:block"/> Payroll
                </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto pb-8">
                {/* Financial Dashboard — employee payroll + contractor payments */}
                <TabsContent value="financial" className="mt-0 h-full">
                    <HrFinanceDashboard />
                </TabsContent>

                {/* Performance — auto-calculated scorecards for every employee */}
                <TabsContent value="performance" className="mt-0 h-full">
                    {(() => {
                        const scored = scores.filter(s => s.score != null);
                        const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;
                        const top = scored[0];
                        const dist = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
                        scored.forEach(s => { if (dist[s.grade] != null) dist[s.grade]++; });
                        return (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                                        <p className="text-xs font-bold uppercase text-slate-400">Team Average</p>
                                        <p className="text-3xl font-black text-slate-900 mt-1">{avg != null ? avg : '—'}<span className="text-base text-slate-400 font-bold">/100</span></p>
                                    </div>
                                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                                        <p className="text-xs font-bold uppercase text-slate-400">Scored Employees</p>
                                        <p className="text-3xl font-black text-slate-900 mt-1">{scored.length}<span className="text-base text-slate-400 font-bold">/{scores.length}</span></p>
                                    </div>
                                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                                        <p className="text-xs font-bold uppercase text-slate-400">Top Performer</p>
                                        <p className="text-lg font-black text-slate-900 mt-1 truncate">{top ? top.employeeName : '—'}</p>
                                        <p className="text-xs font-bold text-emerald-600">{top ? `${top.score}/100 · Grade ${top.grade}` : ''}</p>
                                    </div>
                                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                                        <p className="text-xs font-bold uppercase text-slate-400">Grade Spread</p>
                                        <div className="flex gap-2 mt-2 text-xs font-bold">
                                            <span className="text-emerald-600">A:{dist.A}</span>
                                            <span className="text-blue-600">B:{dist.B}</span>
                                            <span className="text-amber-600">C:{dist.C}</span>
                                            <span className="text-red-600">D:{dist.D}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Employee</TableHead>
                                                <TableHead>Score</TableHead>
                                                <TableHead className="hidden md:table-cell">Attendance</TableHead>
                                                <TableHead className="hidden md:table-cell">Tasks</TableHead>
                                                <TableHead className="hidden md:table-cell">Reviews</TableHead>
                                                <TableHead className="text-right">Profile</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {scores.map(s => {
                                                const gs = gradeStyle(s.grade);
                                                return (
                                                    <TableRow key={s.employeeId}>
                                                        <TableCell>
                                                            <p className="font-bold text-slate-800">{s.employeeName}</p>
                                                            <p className="text-xs text-slate-500">{s.designation || 'Employee'}{s.department ? ` · ${s.department}` : ''}</p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black text-slate-900 text-lg w-9">{s.score != null ? s.score : '—'}</span>
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${gs.bg} ${gs.text}`}>{gs.label}</span>
                                                            </div>
                                                            <div className="h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden mt-1">
                                                                <div className="h-full rounded-full bg-slate-800" style={{ width: `${s.score ?? 0}%` }} />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                                                            {s.attendance?.score != null ? `${s.attendance.score}` : '—'}
                                                            <span className="text-xs text-slate-400 block">{s.attendance?.present ?? 0}P/{s.attendance?.absent ?? 0}A</span>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                                                            {s.tasks?.score != null ? `${s.tasks.score}` : '—'}
                                                            <span className="text-xs text-slate-400 block">{s.tasks?.completed ?? 0}/{s.tasks?.total ?? 0} done</span>
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell text-sm font-semibold text-slate-600">
                                                            {s.reviews?.score != null ? `${s.reviews.score}` : '—'}
                                                            <span className="text-xs text-slate-400 block">{s.reviews?.avgRating ?? '—'}/5 ({s.reviews?.count ?? 0})</span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Link to={`/hr/employees/${s.employeeId}`}>
                                                                <Button variant="ghost" size="icon"><ArrowRight className="w-4 h-4" /></Button>
                                                            </Link>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {scores.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">No employees found.</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        );
                    })()}
                </TabsContent>

                {/* 1. Directory */}
                <TabsContent value="directory" className="mt-0 h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {employees.map(e => (
                            <div key={e.id} className="bg-white border rounded-2xl p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden text-xl font-black text-slate-400">
                                    {e.firstName[0]}{e.lastName[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-lg truncate">{e.firstName} {e.lastName}</h3>
                                    <p className="text-sm font-semibold text-blue-600 truncate">{e.designation || 'Employee'}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${e.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{e.status}</span>
                                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">{e.department?.name || 'No Dept'}</span>
                                    </div>
                                </div>
                                <Link to={`/hr/employees/${e.id}`}>
                                    <Button variant="ghost" size="icon" className="shrink-0"><ArrowRight className="w-4 h-4" /></Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </TabsContent>
                
                {/* 2. Departments */}
                <TabsContent value="departments" className="mt-0 h-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {departments.map(d => (
                            <div key={d.id} className="bg-white border rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">{d.name}</h3>
                                <p className="text-sm text-slate-500">{d.description}</p>
                            </div>
                        ))}
                    </div>
                </TabsContent>

                {/* 3. Leaves */}
                <TabsContent value="leaves" className="mt-0 h-full">
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                         <div className="flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 sticky top-0">
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Leave Type</TableHead>
                                        <TableHead>Dates</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leaves.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell>
                                                <p className="font-bold text-slate-800">{l.employee?.firstName} {l.employee?.lastName}</p>
                                                <p className="text-xs text-slate-500">{l.employee?.department?.name}</p>
                                            </TableCell>
                                            <TableCell className="font-semibold text-slate-700">{l.type}</TableCell>
                                            <TableCell>
                                                <p className="text-sm">{format(new Date(l.startDate), 'MMM d, yyyy')}</p>
                                                <p className="text-xs text-slate-500">to {format(new Date(l.endDate), 'MMM d, yyyy')}</p>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-bold rounded ${
                                                    l.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    l.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {l.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {l.status === 'PENDING' && (
                                                    <Button size="sm" onClick={() => handleApproveLeave(l.id)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {leaves.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No leave requests found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
                
                {/* 4. Payroll */}
                <TabsContent value="payroll" className="mt-0 h-full">
                    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                         <div className="flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 sticky top-0">
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Month/Year</TableHead>
                                        <TableHead>Net Salary</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Payment Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payroll.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-bold text-slate-800">{p.employee?.firstName} {p.employee?.lastName}</TableCell>
                                            <TableCell className="font-semibold text-slate-600">{p.month} / {p.year}</TableCell>
                                            <TableCell className="font-black text-slate-900">${p.netSalary?.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 text-xs font-bold rounded ${
                                                    p.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-500">
                                                {p.paymentDate ? format(new Date(p.paymentDate), 'MMM d, yyyy') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {payroll.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">No payroll records found.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>
                
                {/* 5. Attendance (stub for overview, detail in Employee profile) */}
                <TabsContent value="attendance" className="mt-0 h-full">
                    <div className="bg-white border rounded-2xl p-8 text-center text-slate-500 shadow-sm">
                        Daily attendance is managed per employee via their HR Command Center.
                    </div>
                </TabsContent>

            </div>
        </Tabs>
      </div>
    </div>
  );
}
