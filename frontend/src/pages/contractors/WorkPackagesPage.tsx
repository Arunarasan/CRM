import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { contractorApi } from "@/api/contractorApi";
import type { ContractorWorkPackage, ProjectRef, PhaseRef, RoomRef } from "@/types/contractor";
import { TRADES, RATE_TYPES, RATE_TYPE_LABEL, WP_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Wand2, AlertTriangle } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const STATUSES = [
  "DRAFT", "PENDING_ASSIGNMENT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD",
  "WORK_COMPLETED", "INSPECTION_PENDING", "REWORK", "COMPLETED", "CANCELLED",
];

export default function WorkPackagesPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ContractorWorkPackage[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const projectId = params.get("projectId") ?? "";
  const status = params.get("status") ?? "";
  const trade = params.get("trade") ?? "";
  const search = params.get("search") ?? "";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const load = useCallback(() => {
    setLoading(true);
    contractorApi.listWorkPackages({
      projectId: projectId ? Number(projectId) : undefined,
      status: status || undefined,
      trade: trade || undefined,
      search: search || undefined,
      size: 100,
    })
      .then((p) => setRows(p.content ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, status, trade, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get("/projects?size=200")
      .then((r) => setProjects(r.data?.content ?? r.data ?? []))
      .catch(() => {});
  }, []);

  const generate = async () => {
    if (!projectId) { setMessage("Pick a project first — packages are generated from that project's BOQ."); return; }
    try {
      const res = await contractorApi.generateFromBoq(Number(projectId));
      const total = res.packagesCreated + res.packagesUpdated + res.itemsLinked;
      setMessage(total === 0
        ? `Already in sync — ${res.boqItemsConsidered} approved BOQ item(s), nothing new to package.`
        : `Created ${res.packagesCreated} package(s), updated ${res.packagesUpdated}, linked ${res.itemsLinked} BOQ item(s)` +
          (res.itemsSkipped ? `, skipped ${res.itemsSkipped} already allocated elsewhere.` : "."));
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not generate work packages.");
    }
  };

  const totals = useMemo(() => ({
    estimated: rows.reduce((s, r) => s + Number(r.estimatedCost ?? 0), 0),
    billed: rows.reduce((s, r) => s + Number(r.billedAmount ?? 0), 0),
    delayed: rows.filter((r) => r.delayed).length,
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search package name or code…"
                 defaultValue={search} onBlur={(e) => setParam("search", e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={projectId}
                onChange={(e) => setParam("projectId", e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={trade}
                onChange={(e) => setParam("trade", e.target.value)}>
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={status}
                onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <Button variant="outline" onClick={generate}><Wand2 className="w-4 h-4 mr-1" /> Generate from BOQ</Button>
        <NewWorkPackageButton projects={projects} defaultProjectId={projectId} onCreated={load} />
      </div>

      {message && (
        <div className="text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3">{message}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Tile label="Packages" value={String(rows.length)} />
        <Tile label="Estimated value" value={currency(totals.estimated)} />
        <Tile label="Billed to date" value={currency(totals.billed)}
              hint={totals.delayed ? `${totals.delayed} delayed` : undefined} />
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Package</th>
                <th className="p-3 font-semibold">Project · Phase · Room</th>
                <th className="p-3 font-semibold">Trade</th>
                <th className="p-3 font-semibold">Rate</th>
                <th className="p-3 font-semibold">Dates</th>
                <th className="p-3 font-semibold">Progress</th>
                <th className="p-3 font-semibold text-right">Estimated</th>
                <th className="p-3 font-semibold text-right">Billed</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No work packages. Pick a project and use “Generate from BOQ”, or create one manually.
                </td></tr>
              )}
              {rows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <Link to={`/contractors/work-packages/${w.id}`} className="font-bold text-slate-800 hover:text-primary">
                      {w.packageName}
                    </Link>
                    <div className="font-mono text-[11px] text-slate-400">{w.packageCode}</div>
                  </td>
                  <td className="p-3 text-xs text-slate-600">
                    <div className="font-semibold">{w.project?.projectName}</div>
                    <div className="text-muted-foreground">
                      {[w.phase?.name, w.room?.roomName].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="p-3">
                    {w.trade ? <Badge className="bg-slate-100 text-slate-700">{w.trade.replace(/_/g, " ")}</Badge> : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{RATE_TYPE_LABEL[w.rateType] ?? w.rateType}</div>
                    {w.rate != null && <div className="text-muted-foreground">{currency(w.rate)}{w.unit ? ` / ${w.unit}` : ""}</div>}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{w.startDate ?? "—"}</div>
                    <div className={w.delayed ? "text-rose-600 font-semibold inline-flex items-center gap-1" : "text-muted-foreground"}>
                      {w.delayed && <AlertTriangle className="w-3 h-3" />}{w.endDate ?? "—"}
                    </div>
                  </td>
                  <td className="p-3 w-32">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${w.completionPercentage}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{w.completionPercentage}%</div>
                  </td>
                  <td className="p-3 text-right font-semibold">{currency(w.estimatedCost)}</td>
                  <td className="p-3 text-right">{currency(w.billedAmount)}</td>
                  <td className="p-3">
                    <Badge className={WP_STATUS_TONE[w.status]}>{w.status.replace(/_/g, " ")}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-400">{label}</div>
      <div className="text-xl font-black text-slate-900 mt-1">{value}</div>
      {hint && <div className="text-xs text-rose-600 font-semibold">{hint}</div>}
    </div>
  );
}

function NewWorkPackageButton({ projects, defaultProjectId, onCreated }: {
  projects: ProjectRef[]; defaultProjectId: string; onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [phases, setPhases] = useState<PhaseRef[]>([]);
  const [rooms, setRooms] = useState<RoomRef[]>([]);
  const [phaseId, setPhaseId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({
    packageName: "", trade: "CARPENTRY", priority: "MEDIUM", rateType: "FIXED_CONTRACT", retentionPercentage: 5,
  });

  useEffect(() => { setProjectId(defaultProjectId); }, [defaultProjectId]);

  useEffect(() => {
    setPhaseId(""); setRooms([]); setRoomId("");
    if (!projectId) { setPhases([]); return; }
    api.get(`/projects/${projectId}/phases`)
      .then((r) => setPhases(r.data ?? []))
      .catch(() => setPhases([]));
  }, [projectId]);

  useEffect(() => {
    setRoomId("");
    if (!phaseId) { setRooms([]); return; }
    api.get(`/projects/phases/${phaseId}/rooms`)
      .then((r) => setRooms(r.data ?? []))
      .catch(() => setRooms([]));
  }, [phaseId]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!projectId) { setError("A work package must belong to a project."); return; }
    if (!form.packageName) { setError("Package name is required."); return; }
    setSaving(true); setError(null);
    try {
      await contractorApi.createWorkPackage({
        projectId: Number(projectId),
        phaseId: phaseId ? Number(phaseId) : undefined,
        roomId: roomId ? Number(roomId) : undefined,
        workPackage: form,
      });
      setOpen(false);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the work package.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button onClick={() => { setError(null); setOpen(true); }}>
        <Plus className="w-4 h-4 mr-1" /> New Work Package
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Work Package</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            A package is always a slice of a project — pick the project, then narrow it to a phase and room.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Project *">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                </select>
              </Field>
              <Field label="Phase">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={phaseId} onChange={(e) => setPhaseId(e.target.value)} disabled={!phases.length}>
                  <option value="">Whole project</option>
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Room">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!rooms.length}>
                  <option value="">Whole phase</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.roomName}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Package name *">
              <Input value={String(form.packageName ?? "")} onChange={(e) => set("packageName", e.target.value)}
                     placeholder="e.g. Bedroom Wardrobe Installation" />
            </Field>
            <Field label="Scope of work">
              <Input value={String(form.scopeOfWork ?? "")} onChange={(e) => set("scopeOfWork", e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Trade">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={String(form.trade ?? "")} onChange={(e) => set("trade", e.target.value)}>
                  {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={String(form.priority ?? "MEDIUM")} onChange={(e) => set("priority", e.target.value)}>
                  {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Rate type">
                <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                        value={String(form.rateType ?? "")} onChange={(e) => set("rateType", e.target.value)}>
                  {RATE_TYPES.map((t) => <option key={t} value={t}>{RATE_TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="Retention %">
                <Input type="number" value={String(form.retentionPercentage ?? "")}
                       onChange={(e) => set("retentionPercentage", Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Rate (₹)">
                <Input type="number" value={String(form.rate ?? "")} onChange={(e) => set("rate", Number(e.target.value))} />
              </Field>
              <Field label="Quantity">
                <Input type="number" value={String(form.quantity ?? "")} onChange={(e) => set("quantity", Number(e.target.value))} />
              </Field>
              <Field label="Unit">
                <Input value={String(form.unit ?? "")} onChange={(e) => set("unit", e.target.value)} placeholder="Sqft" />
              </Field>
              <Field label="Estimated cost (₹)">
                <Input type="number" value={String(form.estimatedCost ?? "")}
                       onChange={(e) => set("estimatedCost", Number(e.target.value))} placeholder="auto = rate × qty" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <Input type="date" value={String(form.startDate ?? "")} onChange={(e) => set("startDate", e.target.value)} />
              </Field>
              <Field label="End date">
                <Input type="date" value={String(form.endDate ?? "")} onChange={(e) => set("endDate", e.target.value)} />
              </Field>
            </div>

            {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create Package"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
