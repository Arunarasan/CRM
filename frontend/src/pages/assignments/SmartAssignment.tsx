import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  smartAssignmentApi,
  assignmentLookups,
  AssignSelection,
  ProjectOption,
  TaskOption,
  DepartmentOption,
} from '../../api/smartAssignmentApi';
import {
  RecommendResult,
  EmployeeRecommendation,
  AssignmentSettings,
  AssignmentHistoryRow,
  AssignmentDashboard,
} from '../../types/assignment';

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-rose-600';
}
function scoreRing(score: number) {
  if (score >= 85) return 'border-emerald-500';
  if (score >= 70) return 'border-emerald-500';
  if (score >= 55) return 'border-amber-500';
  return 'border-rose-500';
}

export default function SmartAssignment() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Smart Employee Auto Assignment</h1>
        <p className="text-muted-foreground text-sm">
          Analyse availability, workload, skills and performance to recommend the best-fit employees for a task.
        </p>
      </div>

      <Tabs defaultValue="assign" className="w-full">
        <TabsList>
          <TabsTrigger value="assign">Auto Assign</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Manager Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="assign" className="mt-4">
          <AutoAssignTab />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================ Auto Assign

function AutoAssignTab() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  const [projectId, setProjectId] = useState<number | ''>('');
  const [taskId, setTaskId] = useState<number | ''>('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [requiredRole, setRequiredRole] = useState('');
  const [skills, setSkills] = useState('');
  const [count, setCount] = useState(1);
  const [allowOvertime, setAllowOvertime] = useState(false);

  const [result, setResult] = useState<RecommendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [showExcluded, setShowExcluded] = useState(false);

  useEffect(() => {
    assignmentLookups.projects().then(setProjects).catch(() => setProjects([]));
    assignmentLookups.departments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (projectId === '') { setTasks([]); return; }
    assignmentLookups.tasksByProject(Number(projectId)).then(setTasks).catch(() => setTasks([]));
  }, [projectId]);

  // Auto-fill hours + skills when a task is chosen.
  useEffect(() => {
    if (taskId === '') return;
    const t = tasks.find((x) => x.id === Number(taskId));
    if (t) {
      if (t.estimatedHours != null) setEstimatedHours(t.estimatedHours);
      if (t.requiredSkills) setSkills(t.requiredSkills);
    }
  }, [taskId, tasks]);

  async function runRecommend() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setSelected({});
    try {
      const res = await smartAssignmentApi.recommend({
        taskId: taskId === '' ? null : Number(taskId),
        projectId: projectId === '' ? null : Number(projectId),
        estimatedHours: estimatedHours === '' ? null : Number(estimatedHours),
        departmentId: departmentId === '' ? null : Number(departmentId),
        requiredRole: requiredRole || null,
        requiredSkills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        requiredCount: count,
        allowOvertime,
        includeExcluded: true,
      });
      setResult(res);
      // Pre-select the top picks.
      const pre: Record<number, boolean> = {};
      res.topPicks.forEach((p) => { pre[p.resourceId] = true; });
      setSelected(pre);
    } catch (e: any) {
      setError(e?.message || 'Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  }

  const selectedList = useMemo(
    () => (result?.recommendations ?? []).filter((r) => selected[r.resourceId]),
    [result, selected],
  );

  async function assignSelected() {
    if (taskId === '') { setError('Select a task before assigning.'); return; }
    if (selectedList.length === 0) { setError('Select at least one employee.'); return; }
    setAssigning(true);
    setError(null);
    try {
      const selections: AssignSelection[] = selectedList.map((r) => ({
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        suitabilityScore: r.suitabilityScore,
        reason: (r.reasons || []).join('; '),
      }));
      const res = await smartAssignmentApi.assign(Number(taskId), selections, 'AUTO');
      setMessage(`Assigned ${res.assigned} employee(s) to the task.`);
      await runRecommend();
    } catch (e: any) {
      setError(e?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  async function assignOne(r: EmployeeRecommendation) {
    if (taskId === '') { setError('Select a task before assigning.'); return; }
    setAssigning(true);
    setError(null);
    try {
      await smartAssignmentApi.assign(
        Number(taskId),
        [{ resourceType: r.resourceType, resourceId: r.resourceId, suitabilityScore: r.suitabilityScore, reason: (r.reasons || []).join('; ') }],
        'AUTO',
      );
      setMessage(`Assigned ${r.name}.`);
      await runRecommend();
    } catch (e: any) {
      setError(e?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* --- Requirement form --- */}
      <Card className="h-fit">
        <CardHeader><CardTitle>Task Requirement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <select className={selectCls} value={projectId}
              onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : ''); setTaskId(''); }}>
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}{p.priority ? ` · ${p.priority}` : ''}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Task</Label>
            <select className={selectCls} value={taskId} disabled={projectId === ''}
              onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{projectId === '' ? 'Pick a project first' : 'Select task…'}</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.taskName}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Est. hours</Label>
              <Input type="number" min={0} step={0.5} value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 4" />
            </div>
            <div className="space-y-1.5">
              <Label>Employees needed</Label>
              <Input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <select className={selectCls} value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Any department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Required role (optional)</Label>
            <Input value={requiredRole} onChange={(e) => setRequiredRole(e.target.value)} placeholder="e.g. Technician" />
          </div>

          <div className="space-y-1.5">
            <Label>Required skills (comma separated)</Label>
            <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Electrical, CCTV" />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Allow overtime</p>
              <p className="text-xs text-muted-foreground">Recommend employees over capacity</p>
            </div>
            <Switch checked={allowOvertime} onCheckedChange={setAllowOvertime} />
          </div>

          <Button className="w-full" onClick={runRecommend} disabled={loading}>
            {loading ? 'Analysing…' : '⚡ Auto Assign Employees'}
          </Button>
        </CardContent>
      </Card>

      {/* --- Results --- */}
      <div className="space-y-4">
        {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
        {message && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</div>}

        {!result && !loading && (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            Fill in the task requirement and click <span className="font-medium">Auto Assign Employees</span> to see ranked recommendations.
          </CardContent></Card>
        )}

        {result && (
          <>
            {result.warning && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                ⚠ {result.warning}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {result.availableCount} eligible · need {result.requiredCount} · {result.excluded.length} excluded
              </p>
              <Button onClick={assignSelected} disabled={assigning || taskId === '' || selectedList.length === 0}>
                {assigning ? 'Assigning…' : `Assign Selected (${selectedList.length})`}
              </Button>
            </div>
            {taskId === '' && (
              <p className="text-xs text-amber-700">Select a task in the form to enable assignment.</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {result.recommendations.map((r) => (
                <RecommendationCard key={r.resourceId} r={r}
                  selected={!!selected[r.resourceId]}
                  onToggle={() => setSelected((s) => ({ ...s, [r.resourceId]: !s[r.resourceId] }))}
                  onAssign={() => assignOne(r)}
                  canAssign={taskId !== '' && !assigning} />
              ))}
            </div>

            {result.recommendations.length === 0 && (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                No employees passed the eligibility rules. Loosen the filters or check the excluded list below.
              </CardContent></Card>
            )}

            {result.excluded.length > 0 && (
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => setShowExcluded((v) => !v)}>
                  <CardTitle className="text-base">
                    {showExcluded ? '▾' : '▸'} Excluded candidates ({result.excluded.length})
                  </CardTitle>
                </CardHeader>
                {showExcluded && (
                  <CardContent className="space-y-1.5">
                    {result.excluded.map((e) => (
                      <div key={e.employeeId} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                        <span className="font-medium">{e.name}
                          {e.designation && <span className="text-muted-foreground font-normal"> · {e.designation}</span>}
                        </span>
                        <span className="text-rose-600 text-xs">{e.reason}</span>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}</span>;
}

function RecommendationCard({
  r, selected, onToggle, onAssign, canAssign,
}: {
  r: EmployeeRecommendation; selected: boolean; onToggle: () => void; onAssign: () => void; canAssign: boolean;
}) {
  const initials = r.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Card className={selected ? 'ring-2 ring-primary' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {r.photoUrl
            ? <img src={r.photoUrl} alt={r.name} className="h-12 w-12 rounded-full object-cover" />
            : <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">{initials}</div>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{r.name}</p>
              {r.recommended && <Badge>Top pick</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {r.employeeCode ? `${r.employeeCode} · ` : ''}{r.designation || '—'}{r.department ? ` · ${r.department}` : ''}
            </p>
            {r.starRating != null && <div className="text-sm mt-0.5"><Stars n={r.starRating} /></div>}
          </div>
          <div className={`h-14 w-14 shrink-0 rounded-full border-4 ${scoreRing(r.suitabilityScore)} flex flex-col items-center justify-center`}>
            <span className={`text-base font-bold leading-none ${scoreColor(r.suitabilityScore)}`}>{Math.round(r.suitabilityScore)}</span>
            <span className="text-[9px] text-muted-foreground">score</span>
          </div>
        </div>

        {r.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.skills.slice(0, 6).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Tasks today" value={r.tasksToday} />
          <Metric label="Assigned h" value={r.assignedHours} />
          <Metric label="Remaining h" value={r.remainingHours} highlight />
        </div>

        {r.reasons.length > 0 && (
          <ul className="space-y-0.5 text-xs text-emerald-700">
            {r.reasons.slice(0, 4).map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        )}
        {r.warnings.length > 0 && (
          <ul className="space-y-0.5 text-xs text-amber-700">
            {r.warnings.map((x, i) => <li key={i}>⚠ {x}</li>)}
          </ul>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant={selected ? 'secondary' : 'outline'} className="flex-1" onClick={onToggle}>
            {selected ? '✓ Selected' : 'Select'}
          </Button>
          <Button size="sm" className="flex-1" onClick={onAssign} disabled={!canAssign}>Assign</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <p className={`font-semibold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ============================================================ Dashboard

function DashboardTab() {
  const [d, setD] = useState<AssignmentDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    smartAssignmentApi.dashboard().then(setD).catch((e) => setError(e?.message || 'Failed to load dashboard'));
  }, []);

  if (error) return <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>;
  if (!d) return <div className="text-muted-foreground">Loading widgets…</div>;

  const widgets: { label: string; value: string | number; tone: string }[] = [
    { label: 'Available Today', value: d.availableToday, tone: 'text-emerald-600' },
    { label: 'Working Now', value: d.workingNow, tone: 'text-emerald-600' },
    { label: 'Free Employees', value: d.freeEmployees, tone: 'text-emerald-600' },
    { label: 'On Leave', value: d.onLeave, tone: 'text-amber-600' },
    { label: 'In Overtime', value: d.inOvertime, tone: 'text-rose-600' },
    { label: 'Pending Assignments', value: d.pendingAssignments, tone: 'text-amber-600' },
    { label: 'AI Recommended', value: d.aiRecommendedAssignments, tone: 'text-purple-600' },
    { label: 'Total Employees', value: d.totalEmployees, tone: 'text-foreground' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map((w) => (
          <Card key={w.label}>
            <CardContent className="p-5">
              <p className={`text-3xl font-bold ${w.tone}`}>{w.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{w.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Highest Workload</p>
          <p className="text-lg font-semibold mt-1">
            {d.highestWorkload ? `${d.highestWorkload.name} · ${d.highestWorkload.hours}h` : '—'}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Lowest Workload</p>
          <p className="text-lg font-semibold mt-1">
            {d.lowestWorkload ? `${d.lowestWorkload.name} · ${d.lowestWorkload.hours}h` : '—'}
          </p>
        </CardContent></Card>
      </div>
    </div>
  );
}

// ============================================================ History

function HistoryTab() {
  const [rows, setRows] = useState<AssignmentHistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartAssignmentApi.history()
      .then(setRows)
      .catch((e) => setError(e?.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Assignment History</CardTitle></CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Loading…</p> : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center">No assignments logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Task</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">By</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-3 font-medium">{h.employeeName || '—'}</td>
                    <td className="py-2 pr-3">{h.taskName || '—'}</td>
                    <td className="py-2 pr-3">{h.projectName || '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={h.assignmentMethod === 'MANUAL' ? 'secondary' : 'default'}>{h.assignmentMethod}</Badge>
                    </td>
                    <td className="py-2 pr-3">{h.suitabilityScore != null ? Number(h.suitabilityScore).toFixed(0) : '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{h.assignedByName || '—'}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={h.status === 'ACTIVE' ? 'default' : 'secondary'}>{h.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================ Settings

function SettingsTab() {
  const [s, setS] = useState<AssignmentSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    smartAssignmentApi.getSettings().then(setS).catch((e) => setError(e?.message || 'Failed to load settings'));
  }, []);

  function set<K extends keyof AssignmentSettings>(k: K, v: AssignmentSettings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!s) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const saved = await smartAssignmentApi.updateSettings(s);
      setS(saved);
      setMessage('Settings saved.');
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (error && !s) return <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>;
  if (!s) return <div className="text-muted-foreground">Loading settings…</div>;

  const toggles: { key: keyof AssignmentSettings; label: string; desc: string }[] = [
    { key: 'autoBalanceEnabled', label: 'Automatic workload balancing', desc: 'Prefer lighter-loaded employees' },
    { key: 'allowOvertime', label: 'Allow overtime assignments', desc: 'Recommend employees over capacity' },
    { key: 'allowLowPriorityReassign', label: 'Reassign from low-priority projects', desc: 'For HIGH / CRITICAL projects' },
    { key: 'mandatorySkillMatching', label: 'Mandatory skill matching', desc: 'Exclude employees missing a required skill' },
    { key: 'preferSameProjectTeam', label: 'Prefer same project team', desc: 'Boost employees already on the project' },
    { key: 'preferNearest', label: 'Prefer nearest employees', desc: 'Favour employees near the site' },
  ];

  const weights: { key: keyof AssignmentSettings; label: string }[] = [
    { key: 'weightAvailability', label: 'Availability' },
    { key: 'weightWorkload', label: 'Current Workload' },
    { key: 'weightSkills', label: 'Required Skills' },
    { key: 'weightDepartment', label: 'Department Match' },
    { key: 'weightPerformance', label: 'Performance' },
    { key: 'weightLocation', label: 'Location' },
    { key: 'weightExperience', label: 'Experience' },
  ];
  const weightSum = weights.reduce((acc, w) => acc + Number(s[w.key] || 0), 0);

  return (
    <div className="space-y-4 max-w-3xl">
      {message && <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{message}</div>}
      {error && <div className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <Card>
        <CardHeader><CardTitle>Capacity Limits</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Max tasks per day" value={s.maxTasksPerDay} onChange={(v) => set('maxTasksPerDay', v)} />
          <NumberField label="Max working hours" value={s.maxWorkingHours} step={0.5} onChange={(v) => set('maxWorkingHours', v)} />
          <NumberField label="Max overtime hours" value={s.maxOvertimeHours} step={0.5} onChange={(v) => set('maxOvertimeHours', v)} />
          <NumberField label="Min suitability score" value={s.minSuitabilityScore} onChange={(v) => set('minSuitabilityScore', v)} />
          <NumberField label="Min performance score" value={s.minPerformanceScore} onChange={(v) => set('minPerformanceScore', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assignment Rules</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Switch checked={Boolean(s[t.key])} onCheckedChange={(v) => set(t.key, v as AssignmentSettings[typeof t.key])} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suitability Weights</CardTitle>
          <p className={`text-xs ${weightSum === 100 ? 'text-muted-foreground' : 'text-amber-600'}`}>
            Total: {weightSum}% {weightSum !== 100 && '(engine normalises automatically, but 100% is recommended)'}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {weights.map((w) => (
            <NumberField key={w.key} label={`${w.label} (%)`} value={Number(s[w.key])} onChange={(v) => set(w.key, v as AssignmentSettings[typeof w.key])} />
          ))}
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</Button>
    </div>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" step={step ?? 1} value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
    </div>
  );
}
