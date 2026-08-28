import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, CheckCircle2, User, FileText, Image as ImageIcon, Save, History, Building, Ruler, UserPlus, X, PlayCircle, XCircle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import SignatureCanvas from "react-signature-canvas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { siteVisitApi, type SiteRoomMeasurement } from "@/lib/siteVisitApi";
import { measurementApi } from "@/api/measurementApi";
import CameraCaptureButton from "@/components/CameraCaptureButton";
import { SelectField, TextField, selectClass } from "@/pages/leads/fields";

export default function SiteVisitProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const sigCanvas = useRef<any>(null);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);

  const handleBack = () => {
    // Prefer the last visited screen (browser history); the routes below are only fallbacks for when
    // the page was opened directly with no in-app history to return to.
    if (window.history.length > 2) {
      navigate(-1);
    } else if (location.state?.from) {
      navigate(location.state.from);
    } else if (visit?.lead?.id) {
      navigate(`/leads/${visit.lead.id}`);
    } else if (visit?.customer?.id) {
      navigate(`/customers/${visit.customer.id}`);
    } else if (visit?.project?.id) {
      navigate(`/projects/${visit.project.id}`);
    } else {
      navigate("/site-visits");
    }
  };
  const [history, setHistory] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomMeasurements, setRoomMeasurements] = useState<Record<number, SiteRoomMeasurement[]>>({});
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [dimForm, setDimForm] = useState<SiteRoomMeasurement>({});
  const [assignments, setAssignments] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ assignmentRoles: string[]; outcomes: string[]; mediaCategories: string[] }>({
    assignmentRoles: [], outcomes: [], mediaCategories: [],
  });
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: "", role: "Site Engineer", remarks: "" });

  // Site Visit & Measurement is one combined step — once the visit is done, nudge the user to capture
  // the measurement in the same trip. Look up any measurement already recorded for this lead so the
  // banner shows the right state (continue vs. already captured). null = not checked yet.
  const [leadMeasurements, setLeadMeasurements] = useState<any[] | null>(null);
  useEffect(() => {
    const leadId = visit?.lead?.id;
    if (!leadId) { setLeadMeasurements([]); return; }
    measurementApi.list({ size: 50, filters: { leadId } as any })
      .then((r) => setLeadMeasurements(r.content || []))
      .catch(() => setLeadMeasurements([]));
  }, [visit?.lead?.id]);

  useEffect(() => {
    fetchVisit();
    fetchHistory();
    fetchRooms();
    fetchAssignments();
    fetchMedia();
    fetchChecklist();
    siteVisitApi.meta().then(setMeta).catch(() => {});
    siteVisitApi.getAssignableUsers().then((res) => setAssignableUsers(res.data || res)).catch(() => {});
  }, [id]);

  const fetchVisit = () => {
    if (!id) return;
    siteVisitApi.get(id).then((data) => { setVisit(data); setLoading(false); }).catch(() => setLoading(false));
  };

  const fetchHistory = () => { if (id) siteVisitApi.getHistory(id).then(setHistory).catch(() => {}); };
  const fetchRooms = () => {
    if (!id) return;
    siteVisitApi.getRooms(id).then((data: any[]) => {
      setRooms(data);
      Promise.all(data.map((room) =>
        siteVisitApi.getRoomMeasurements(room.id)
          .then((m: SiteRoomMeasurement[]) => [room.id, m] as const)
          .catch(() => [room.id, []] as const)
      )).then((entries) => setRoomMeasurements(Object.fromEntries(entries)));
    }).catch(() => {});
  };

  const startEditingDimensions = (room: any) => {
    setEditingRoomId(room.id);
    setDimForm(roomMeasurements[room.id]?.[0] ?? {});
  };

  const setDim = (key: keyof SiteRoomMeasurement) => (value: any) =>
    setDimForm((f) => ({ ...f, [key]: value === "" ? undefined : value }));

  const handleSaveDimensions = (roomId: number) => {
    const numeric: (keyof SiteRoomMeasurement)[] = ["length", "width", "height", "ceilingHeight", "doors", "windows"];
    const payload: SiteRoomMeasurement = { ...dimForm };
    numeric.forEach((k) => {
      const raw = payload[k];
      (payload as any)[k] = raw === undefined || raw === null || raw === "" ? undefined : Number(raw);
    });
    siteVisitApi.addRoomMeasurement(roomId, payload)
      .then(() => { setEditingRoomId(null); setDimForm({}); fetchRooms(); })
      .catch(() => alert("Failed to save measurements"));
  };
  const fetchAssignments = () => { if (id) siteVisitApi.getAssignments(id).then(setAssignments).catch(() => {}); };
  const fetchMedia = () => { if (id) siteVisitApi.getMedia(id).then(setMedia).catch(() => {}); };
  const fetchChecklist = () => { if (id) siteVisitApi.getChecklist(id).then(setChecklist).catch(() => {}); };

  const handleSign = () => {
    if (sigCanvas.current.isEmpty()) {
      alert("Please provide a signature first.");
      return;
    }
    // getTrimmedCanvas() pulls in the `trim-canvas` package, whose default export
    // breaks under Vite's ESM interop ("import_build.default is not a function").
    // getCanvas() gives the full signature canvas and avoids that dependency.
    const base64 = sigCanvas.current.getCanvas().toDataURL('image/png');
    siteVisitApi.sign(id!, base64, visit.customerName)
      .then((data) => { setVisit(data); setIsSignDialogOpen(false); fetchHistory(); })
      .catch(() => alert("Failed to save signature"));
  };

  const handleSaveVisit = () => {
    siteVisitApi.update(id!, visit)
      .then(() => alert("Saved successfully!"))
      .catch(() => alert("Failed to save"));
  };

  const handleStart = () => siteVisitApi.start(id!).then((data) => { setVisit(data); fetchHistory(); });
  const handleCancel = () => {
    const reason = window.prompt("Cancellation reason?");
    if (reason == null) return;
    siteVisitApi.cancel(id!, reason).then((data) => { setVisit(data); fetchHistory(); });
  };
  const handleComplete = () => {
    if (!visit.outcome) { alert("Select an outcome before completing the visit."); return; }
    siteVisitApi.complete(id!, visit.outcome, visit.nextActionNotes)
      .then((data) => { setVisit(data); fetchHistory(); });
  };
  const handleScheduleFollowUp = () => {
    siteVisitApi.scheduleFollowUp(id!)
      .then(() => { alert("Follow-up visit created."); fetchHistory(); })
      .catch((err) => alert(err?.response?.data?.message || "Failed to schedule follow-up"));
  };

  const submitAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.userId) return;
    siteVisitApi.assignEmployee(id!, assignForm.userId, assignForm.role, assignForm.remarks)
      .then(() => { setAssignOpen(false); setAssignForm({ userId: "", role: "Site Engineer", remarks: "" }); fetchAssignments(); fetchHistory(); })
      .catch((err) => alert(err?.response?.data?.message || "Failed to assign employee"));
  };

  const removeAssignment = (assignmentId: number) => {
    if (!window.confirm("Remove this employee from the visit?")) return;
    siteVisitApi.removeAssignment(id!, assignmentId).then(() => { fetchAssignments(); fetchHistory(); });
  };

  const toggleChecklistItem = (item: any) => {
    siteVisitApi.updateChecklistItem(id!, item.id, !item.isCompleted, item.remarks)
      .then(() => fetchChecklist());
  };

  const uploadMediaFile = (file: File, category: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      const mediaType = file.type.startsWith("video") ? "Video" : file.type.startsWith("audio") ? "Voice" : file.type === "application/pdf" ? "PDF" : "Image";
      siteVisitApi.addMedia(id!, { mediaType, category, fileUrl: reader.result as string, description: file.name })
        .then(() => fetchMedia())
        .catch(() => alert("Failed to upload file"));
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadMediaFile(file, category);
  };

  if (loading) return <div className="p-8 animate-pulse text-muted-foreground">Loading visit details...</div>;
  if (!visit) return <div className="p-8 text-destructive">Failed to load site visit.</div>;

  const mediaCategories = meta.mediaCategories.length ? meta.mediaCategories : ["Before Photo", "During Visit Photo", "After Photo", "Video", "Voice Note", "Document"];

  return (
    <div className="p-8 space-y-6 h-full bg-background flex flex-col">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={handleBack} title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Visit {visit.visitNumber}: {visit.customerName || "—"}</h1>
              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                visit.status === 'Completed' ? 'bg-green-100 text-green-700' :
                visit.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                'bg-accent/20 text-accent-foreground'
              }`}>
                {visit.status}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              {visit.scheduledTime && (
                <>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(visit.scheduledTime), "MMM d, yyyy")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(visit.scheduledTime), "h:mm a")}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {visit.status === 'Scheduled' || visit.status === 'Assigned' || visit.status === 'Accepted' ? (
            <Button variant="outline" onClick={handleStart}><PlayCircle className="mr-2 h-4 w-4" /> Start Visit</Button>
          ) : null}
          {visit.status !== 'Completed' && visit.status !== 'Cancelled' && (
            <Button variant="outline" className="text-destructive" onClick={handleCancel}><XCircle className="mr-2 h-4 w-4" /> Cancel</Button>
          )}
          {visit.status !== 'Completed' && (
            <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Sign & Complete
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Customer Signature</DialogTitle>
                </DialogHeader>
                <div className="border rounded-lg bg-white overflow-hidden my-4">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{className: "w-full h-64"}}
                  />
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => sigCanvas.current.clear()}>Clear</Button>
                  <Button onClick={handleSign}>Confirm Completion</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={handleSaveVisit}><Save className="mr-2 h-4 w-4" /> Save Changes</Button>
        </div>
      </div>

      {/* Combined "Site Visit & Measurement" step: once the visit is complete, guide the user straight
          into the measurement — same trip, one task. Shows "already captured" if one exists. */}
      {visit.status === 'Completed' && leadMeasurements !== null && (
        leadMeasurements.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Ruler className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Next: capture the measurement</p>
                <p className="text-sm text-amber-800">
                  Site Visit &amp; Measurement is one step — take the measurements now while you're on site.
                  The property details you just recorded carry over automatically.
                </p>
              </div>
            </div>
            <Button className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => navigate(`/measurements/new?siteVisitId=${id}`)}>
              <Ruler className="mr-2 h-4 w-4" /> Continue to Measurement
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 mt-0.5" />
              <p className="text-sm font-medium text-emerald-900">
                Measurement already captured for this lead — the Site Visit &amp; Measurement step is complete.
              </p>
            </div>
            <Button variant="outline" className="shrink-0 border-emerald-300 text-emerald-800" onClick={() => navigate(`/measurements/${leadMeasurements[0].id}`)}>
              <Ruler className="mr-2 h-4 w-4" /> Open Measurement
            </Button>
          </div>
        )
      )}

      <Tabs defaultValue="overview" className="w-full mt-6">
        <TabsList className="w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0 space-x-6 flex-wrap">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Overview</TabsTrigger>
          <TabsTrigger value="employees" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Employees</TabsTrigger>
          <TabsTrigger value="checklist" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Checklist</TabsTrigger>
          <TabsTrigger value="property" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Property & Requirements</TabsTrigger>
          <TabsTrigger value="measurements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Measurements</TabsTrigger>
          <TabsTrigger value="media" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Media</TabsTrigger>
          <TabsTrigger value="outcome" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Outcome & Follow-up</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2">Timeline</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center"><FileText className="mr-2 h-4 w-4"/> Visit Notes</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Visit Notes (shared)</label>
                    <textarea
                      className="w-full min-h-[100px] p-3 rounded-md border border-input bg-background text-sm"
                      placeholder="Enter detailed notes from the visit..."
                      value={visit.visitNotes || ''}
                      onChange={e => setVisit({...visit, visitNotes: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Internal Notes (staff only)</label>
                    <textarea
                      className="w-full min-h-[70px] p-3 rounded-md border border-input bg-background text-sm"
                      value={visit.internalNotes || ''}
                      onChange={e => setVisit({...visit, internalNotes: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Customer Notes</label>
                    <textarea
                      className="w-full min-h-[70px] p-3 rounded-md border border-input bg-background text-sm"
                      value={visit.customerNotes || ''}
                      onChange={e => setVisit({...visit, customerNotes: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center"><User className="mr-2 h-4 w-4"/> Contact & Location</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <TextField label="Contact Person" value={visit.customerContactPerson} onChange={(v) => setVisit({ ...visit, customerContactPerson: v })} />
                      <TextField label="Customer Mobile" value={visit.customerMobile} onChange={(v) => setVisit({ ...visit, customerMobile: v })} />
                      <TextField label="Google Maps Link" value={visit.googleMapsLink} onChange={(v) => setVisit({ ...visit, googleMapsLink: v })} />
                      {visit.googleMapsLink && (
                        <a href={visit.googleMapsLink} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Open in Google Maps →</a>
                      )}
                    </CardContent>
                  </Card>

                  {visit.status === 'Completed' && visit.signatureBase64 && (
                    <Card className="border-green-200">
                      <CardHeader className="bg-green-50/50"><CardTitle className="text-lg text-green-800">Sign-off Complete</CardTitle></CardHeader>
                      <CardContent className="p-6 flex flex-col items-center justify-center">
                        <img src={visit.signatureBase64} alt="Customer Signature" className="max-h-32 border-b border-dashed mb-2" />
                        <p className="text-sm text-muted-foreground">Signed by {visit.signedByCustomer} on {visit.signatureDate ? format(new Date(visit.signatureDate), 'MMM d, yyyy') : 'site'}.</p>
                      </CardContent>
                    </Card>
                  )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center"><User className="mr-2 h-4 w-4" /> Assigned Team</CardTitle>
                  <CardDescription>Assign one or more employees to this visit and track their progress.</CardDescription>
                </div>
                <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Assign Employee</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Assign Employee</DialogTitle></DialogHeader>
                    <form onSubmit={submitAssign} className="space-y-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Employee</label>
                        <select className={selectClass} required value={assignForm.userId}
                          onChange={(e) => setAssignForm(f => ({ ...f, userId: e.target.value }))}>
                          <option value="">Select employee...</option>
                          {assignableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      </div>
                      <SelectField label="Role" value={assignForm.role} onChange={(v) => setAssignForm(f => ({ ...f, role: v }))}
                        options={meta.assignmentRoles.length ? meta.assignmentRoles : ["Sales Executive", "Interior Designer", "Site Engineer", "Project Manager", "Supervisor"]}
                        allowEmpty={false} />
                      <TextField label="Remarks" value={assignForm.remarks} onChange={(v) => setAssignForm(f => ({ ...f, remarks: v }))} />
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
                        <Button type="submit">Assign</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{a.employeeName || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {a.acceptedTime && <span>✓ Accepted {format(new Date(a.acceptedTime), "MMM d, h:mm a")}</span>}
                        {a.arrivalTime && <span>· Arrived {format(new Date(a.arrivalTime), "h:mm a")}</span>}
                        {a.completedTime && <span>· Done {format(new Date(a.completedTime), "h:mm a")}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        a.status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-accent/20 text-accent-foreground'
                      }`}>{a.status}</span>
                      {!a.acceptedTime && (
                        <Button size="sm" variant="outline" onClick={() => siteVisitApi.acceptAssignment(id!, a.id).then(fetchAssignments)}>Accept</Button>
                      )}
                      {a.acceptedTime && !a.arrivalTime && (
                        <Button size="sm" variant="outline" onClick={() => siteVisitApi.markArrival(id!, a.id).then(fetchAssignments)}>Mark Arrival</Button>
                      )}
                      {a.arrivalTime && !a.completedTime && (
                        <Button size="sm" variant="outline" onClick={() => siteVisitApi.completeAssignment(id!, a.id).then(fetchAssignments)}>Mark Done</Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removeAssignment(a.id)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-muted-foreground text-sm">No team assigned yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checklist">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center"><CheckCircle2 className="mr-2 h-4 w-4" /> Visit Checklist</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {checklist.map(item => (
                  <label key={item.id} className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" checked={!!item.isCompleted} onChange={() => toggleChecklistItem(item)} />
                    <span className={item.isCompleted ? "line-through text-muted-foreground" : ""}>{item.item}</span>
                  </label>
                ))}
                {checklist.length === 0 && <p className="text-muted-foreground text-sm">No checklist items.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="property">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center"><Building className="mr-2 h-4 w-4"/> Property Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Property Type</label>
                        <Input value={visit.propertyType || ''} onChange={e => setVisit({...visit, propertyType: e.target.value})} placeholder="e.g. Apartment, Villa" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Area (SqFt)</label>
                        <Input type="number" value={visit.areaSqft || ''} onChange={e => setVisit({...visit, areaSqft: parseFloat(e.target.value)})} placeholder="e.g. 1500" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Construction Stage</label>
                        <Input value={visit.constructionStage || ''} onChange={e => setVisit({...visit, constructionStage: e.target.value})} placeholder="e.g. Raw, Finished" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Total Floors</label>
                        <Input type="number" value={visit.totalFloors || ''} onChange={e => setVisit({...visit, totalFloors: parseInt(e.target.value)})} placeholder="e.g. 2" />
                      </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Site Condition</label>
                    <textarea className="w-full p-2 border rounded text-sm" value={visit.siteCondition || ''} onChange={e => setVisit({...visit, siteCondition: e.target.value})} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Customer Requirements</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Preferred Style</label>
                        <Input value={visit.preferredStyle || ''} onChange={e => setVisit({...visit, preferredStyle: e.target.value})} placeholder="e.g. Modern, Minimalist" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Budget</label>
                        <Input type="number" value={visit.budget || ''} onChange={e => setVisit({...visit, budget: parseFloat(e.target.value)})} placeholder="e.g. 500000" />
                      </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Special Instructions</label>
                    <textarea className="w-full p-2 border rounded text-sm min-h-[100px]" value={visit.specialInstructions || ''} onChange={e => setVisit({...visit, specialInstructions: e.target.value})} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="measurements">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center"><Ruler className="mr-2 h-4 w-4"/> Site Measurements</CardTitle>
                        <CardDescription>
                          Rough dimensions captured on site. These carry over to the Measurement module — you won't need to re-enter them.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => {
                        const name = window.prompt("Room name?");
                        if (name) siteVisitApi.addRoom(id!, name).then(fetchRooms);
                      }}>+ Add Room</Button>
                      <Button onClick={() => navigate(`/measurements/new?siteVisitId=${id}`)}>
                        <Ruler className="mr-2 h-4 w-4" /> Create Measurement
                      </Button>
                    </div>
                </CardHeader>
                <CardContent>
                  {rooms.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                          <p>No rooms added yet.</p>
                          <p className="text-xs mt-1">Add the rooms you walked through — they become measurement rooms automatically.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {rooms.map(room => {
                            const dims = roomMeasurements[room.id]?.[0];
                            const isEditing = editingRoomId === room.id;
                            return (
                              <div key={room.id} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold">{room.roomName}</h4>
                                    {!isEditing && (
                                      <Button variant="ghost" size="sm" onClick={() => startEditingDimensions(room)}>
                                        {dims ? "Edit dimensions" : "+ Add dimensions"}
                                      </Button>
                                    )}
                                  </div>

                                  {!isEditing && dims && (
                                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                                      <span>L × W × H: {dims.length ?? "—"} × {dims.width ?? "—"} × {dims.height ?? "—"} ft</span>
                                      <span>Ceiling: {dims.ceilingHeight ?? "—"} ft</span>
                                      <span>Doors: {dims.doors ?? "—"}</span>
                                      <span>Windows: {dims.windows ?? "—"}</span>
                                      {dims.floorType && <span>Floor: {dims.floorType}</span>}
                                      {dims.wallFinish && <span>Walls: {dims.wallFinish}</span>}
                                      {dims.notes && <span className="col-span-2 md:col-span-4">Notes: {dims.notes}</span>}
                                    </div>
                                  )}

                                  {!isEditing && !dims && (
                                    <p className="mt-1 text-xs text-muted-foreground">No dimensions recorded.</p>
                                  )}

                                  {isEditing && (
                                    <div className="mt-3 space-y-3">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <TextField label="Length (ft)" type="number" value={dimForm.length ?? ""} onChange={setDim("length")} />
                                        <TextField label="Width (ft)" type="number" value={dimForm.width ?? ""} onChange={setDim("width")} />
                                        <TextField label="Height (ft)" type="number" value={dimForm.height ?? ""} onChange={setDim("height")} />
                                        <TextField label="Ceiling Height (ft)" type="number" value={dimForm.ceilingHeight ?? ""} onChange={setDim("ceilingHeight")} />
                                        <TextField label="Doors" type="number" value={dimForm.doors ?? ""} onChange={setDim("doors")} />
                                        <TextField label="Windows" type="number" value={dimForm.windows ?? ""} onChange={setDim("windows")} />
                                        <TextField label="Floor Type" value={dimForm.floorType ?? ""} onChange={setDim("floorType")} />
                                        <TextField label="Wall Finish" value={dimForm.wallFinish ?? ""} onChange={setDim("wallFinish")} />
                                      </div>
                                      <TextField label="Notes" value={dimForm.notes ?? ""} onChange={setDim("notes")} />
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => { setEditingRoomId(null); setDimForm({}); }}>Cancel</Button>
                                        <Button size="sm" onClick={() => handleSaveDimensions(room.id)}>Save</Button>
                                      </div>
                                    </div>
                                  )}
                              </div>
                            );
                          })}
                      </div>
                  )}
                </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="media">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center"><ImageIcon className="mr-2 h-4 w-4" /> Site Media</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {mediaCategories.map((category) => {
                  const items = media.filter((m) => m.category === category);
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</h4>
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-primary cursor-pointer hover:underline">
                            + Upload
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, category)} />
                          </label>
                          <CameraCaptureButton onCapture={(f) => uploadMediaFile(f, category)} label="Camera"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline" />
                        </div>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No files yet.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
                          {items.map((m) => (
                            <div key={m.id} className="border rounded-lg overflow-hidden bg-muted/30">
                              {m.mediaType === "Image" ? (
                                <img src={m.fileUrl} alt={m.description} className="w-full h-24 object-cover" />
                              ) : (
                                <div className="w-full h-24 flex items-center justify-center text-xs text-muted-foreground">{m.mediaType}</div>
                              )}
                              <div className="p-1 text-[10px] truncate text-muted-foreground">{m.description}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outcome">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Visit Outcome</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <SelectField label="Outcome" value={visit.outcome} onChange={(v) => setVisit({ ...visit, outcome: v })}
                    options={meta.outcomes.length ? meta.outcomes : ["Interested", "Need Follow-up", "Quotation Required", "Completed"]} />
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Next Action Notes</label>
                    <textarea className="w-full p-2 border rounded text-sm min-h-[80px]" value={visit.nextActionNotes || ''} onChange={e => setVisit({...visit, nextActionNotes: e.target.value})} />
                  </div>
                  {visit.status !== 'Completed' && (
                    <Button onClick={handleComplete} className="w-full"><CheckCircle2 className="mr-2 h-4 w-4" /> Mark Outcome & Complete</Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center"><CalendarClock className="mr-2 h-4 w-4" /> Follow-up Visit</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary"
                      checked={!!visit.nextVisitRequired}
                      onChange={(e) => setVisit({ ...visit, nextVisitRequired: e.target.checked })} />
                    Next visit required
                  </label>
                  {visit.nextVisitRequired && (
                    <>
                      <TextField label="Next Visit Date" type="date" value={visit.nextVisitDate} onChange={(v) => setVisit({ ...visit, nextVisitDate: v })} />
                      <TextField label="Purpose" value={visit.nextVisitPurpose} onChange={(v) => setVisit({ ...visit, nextVisitPurpose: v })} />
                      {visit.followUpFromVisitNumber && (
                        <p className="text-xs text-muted-foreground">This visit is itself a follow-up to {visit.followUpFromVisitNumber}.</p>
                      )}
                      <Button variant="outline" className="w-full" onClick={handleScheduleFollowUp}>
                        <CalendarClock className="mr-2 h-4 w-4" /> Create Follow-up Visit
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline">
             <Card>
                <CardHeader><CardTitle className="text-lg flex items-center"><History className="mr-2 h-4 w-4"/> Visit Timeline</CardTitle></CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                      <p className="text-muted-foreground py-4 text-center">No history recorded.</p>
                  ) : (
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                          {history.map((item, idx) => (
                              <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-300 group-[.is-active]:bg-primary text-slate-50 group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                      <History className="h-4 w-4" />
                                  </div>
                                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border shadow-sm">
                                      <div className="flex items-center justify-between space-x-2 mb-1">
                                          <div className="font-bold text-slate-900">{item.action}</div>
                                          <time className="text-xs font-medium text-primary">{format(new Date(item.actionTimestamp), "MMM d, h:mm a")}</time>
                                      </div>
                                      <div className="text-sm text-slate-500">{item.remarks}</div>
                                      {item.performedByName && <div className="text-xs text-muted-foreground mt-1">by {item.performedByName}</div>}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                </CardContent>
              </Card>
          </TabsContent>

        </div>
      </Tabs>
    </div>
  );
}
