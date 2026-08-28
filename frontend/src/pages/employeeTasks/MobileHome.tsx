import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, AlertTriangle, Clock, CalendarCheck, ListChecks,
  CalendarDays, Plane, Wallet, FolderKanban, UserCircle,
  UserPlus, Boxes, Users, ClipboardList, TrendingUp, Activity,
} from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { employeePortalApi } from '@/api/employeePortalApi';
import { HomeSummary } from '@/types/employeeTask';
import { EmployeeDashboard } from '@/types/employeePortal';
import { runOrQueue } from '@/hooks/useOfflineQueue';
import TaskCard from './components/TaskCard';
import { StatusPill, inr } from '../employeePortal/_shared';
import ClockWidget from '../employeePortal/ClockWidget';

const STAT_TILES = [
  { key: 'dueToday' as const, label: 'Today', icon: CalendarCheck, color: 'text-primary' },
  { key: 'overdue' as const, label: 'Overdue', icon: AlertTriangle, color: 'text-red-600' },
  { key: 'upcoming' as const, label: 'Upcoming', icon: Clock, color: 'text-amber-600' },
  { key: 'completedToday' as const, label: 'Done Today', icon: ListChecks, color: 'text-emerald-600' },
];

export default function MobileHome() {
  const [home, setHome] = useState<HomeSummary | null>(null);
  const [dash, setDash] = useState<EmployeeDashboard | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = useCallback(() => {
    employeeTaskApi.home().then(setHome).catch(() => {});
    employeePortalApi.dashboard().then(setDash).catch(() => setDash(null));
  }, []);

  useEffect(() => { load(); }, [load]);

  const withRefresh = (fn: () => Promise<unknown>) => fn().finally(load);
  const onStart = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/start`, description: 'Start task' }));
  const onPause = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/pause`, description: 'Pause task' }));
  const onComplete = (id: number) => withRefresh(() => runOrQueue({ method: 'post', url: `/employee-tasks/${id}/complete`, description: 'Complete task' }));

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/employee/tasks${search ? `?search=${encodeURIComponent(search)}` : ''}`);
  };

  const firstName = dash?.employee?.firstName;

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Greeting + profile completion */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-lg font-bold leading-tight">{firstName ?? 'Employee'}</h1>
        </div>
        <button
          onClick={() => navigate('/employee/profile')}
          className="flex items-center gap-2 rounded-full border bg-card p-1 pr-3 shadow-sm active:bg-accent"
        >
          {dash?.employee?.profilePhotoUrl ? (
            <img src={dash.employee.profilePhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <UserCircle className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold">{dash ? `${dash.profileCompletion}%` : '–'}</span>
        </button>
      </div>

      <form onSubmit={onSearchSubmit} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks, projects…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </form>

      {/* Time-clock + hourly earnings */}
      <ClockWidget onChange={load} />

      {/* My Work: capacity + available pool shortcut */}
      {home && home.maxActiveTasks != null && (
        <button
          onClick={() => navigate('/employee/tasks?tab=AVAILABLE')}
          className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5 text-left shadow-sm active:bg-accent/40"
        >
          <div>
            <p className="text-xs text-muted-foreground">Task capacity</p>
            <p className="text-lg font-bold leading-none">{home.activeTaskCount ?? 0} / {home.maxActiveTasks}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Available for you</p>
            <p className="text-lg font-bold leading-none text-primary">{home.availableCount ?? 0} →</p>
          </div>
        </button>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Add Lead', icon: UserPlus, color: 'text-emerald-600', to: '/employee/leads' },
          { label: 'Material', icon: Boxes, color: 'text-orange-600', to: '/employee/requests/material' },
          { label: 'Manpower', icon: Users, color: 'text-emerald-600', to: '/employee/requests/manpower' },
          { label: 'Report', icon: ClipboardList, color: 'text-emerald-600', to: '/employee/daily-reports' },
        ].map(({ label, icon: Icon, color, to }) => (
          <button key={label} onClick={() => navigate(to)} className="flex flex-col items-center gap-1 rounded-xl border bg-card p-2 text-center shadow-sm active:bg-accent/40">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-[10px] font-medium leading-tight text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      {/* Self-service summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/employee/attendance')}
          className="flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left shadow-sm active:bg-accent/40"
        >
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="text-xs text-muted-foreground">Attendance</span>
          <StatusPill status={dash?.todayAttendance ?? 'NOT_MARKED'} />
        </button>

        <button
          onClick={() => navigate('/employee/leave')}
          className="flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left shadow-sm active:bg-accent/40"
        >
          <Plane className="h-5 w-5 text-emerald-600" />
          <span className="text-xs text-muted-foreground">Leave Balance</span>
          <span className="text-xl font-bold leading-none">{dash ? dash.leaveBalance : '–'}<span className="ml-1 text-xs font-normal text-muted-foreground">days</span></span>
          {dash && dash.pendingLeaves > 0 && (
            <span className="text-[11px] text-amber-600">{dash.pendingLeaves} pending</span>
          )}
        </button>

        <button
          onClick={() => navigate('/employee/salary')}
          className="flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left shadow-sm active:bg-accent/40"
        >
          <Wallet className="h-5 w-5 text-emerald-600" />
          <span className="text-xs text-muted-foreground">Salary{dash?.lastSalaryMonth ? ` · ${dash.lastSalaryMonth}` : ''}</span>
          <StatusPill status={dash?.lastSalaryStatus ?? 'NONE'} />
        </button>

        <button
          onClick={() => navigate('/employee/projects')}
          className="flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left shadow-sm active:bg-accent/40"
        >
          <FolderKanban className="h-5 w-5 text-violet-600" />
          <span className="text-xs text-muted-foreground">My Projects</span>
          <span className="text-xl font-bold leading-none">{dash ? dash.assignedProjects : '–'}</span>
        </button>
      </div>

      {/* Task stat tiles */}
      <div className="grid grid-cols-4 gap-2">
        {STAT_TILES.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => navigate(key === 'completedToday' ? '/employee/tasks?status=COMPLETED' : '/employee/tasks')}
            className="flex flex-col items-center gap-0.5 rounded-xl border bg-card p-2 text-center shadow-sm active:bg-accent/40"
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-lg font-bold leading-none">{home ? home[key] : '–'}</span>
            <span className="text-[10px] leading-tight text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>

      <div>
        <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Today &amp; Overdue</h2>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {home && home.todaysTasks.length > 0 ? (
            home.todaysTasks.map((task) => (
              <TaskCard key={task.id} task={task} onStart={onStart} onPause={onPause} onComplete={onComplete} />
            ))
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing due today. 🎉</p>
          )}
        </div>
      </div>

      {/* My Performance */}
      {dash?.performance && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> My Performance
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Done / week', value: dash.performance.tasksCompletedThisWeek },
              { label: 'Pending', value: dash.performance.tasksPending },
              { label: 'Attendance', value: `${dash.performance.attendancePercentage}%` },
              { label: 'Hrs today', value: dash.performance.hoursToday ?? 0 },
              { label: 'Hrs / week', value: dash.performance.hoursThisWeek ?? 0 },
              { label: 'Overtime', value: dash.performance.overtimeHours ?? 0 },
              { label: 'This month', value: inr(dash.performance.monthEarnings), wide: true },
              { label: 'Productivity', value: `${dash.performance.productivityScore}%`, wide: true },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl border bg-card p-2.5 shadow-sm ${s.wide ? 'col-span-1' : ''}`}>
                <p className="text-base font-bold leading-none">{s.value}</p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Requests */}
      {dash?.requests && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-muted-foreground">
            <Boxes className="h-4 w-4" /> My Requests
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Material', value: dash.requests.materialRequests, to: '/employee/requests/material' },
              { label: 'Manpower', value: dash.requests.manpowerRequests, to: '/employee/requests/manpower' },
              { label: 'Leads', value: dash.requests.leads, to: '/employee/leads' },
              { label: 'Reports', value: dash.requests.dailyReports, to: '/employee/daily-reports' },
              { label: 'Leave', value: dash.requests.leaveRequests, to: '/employee/leave' },
              { label: 'To approve', value: dash.requests.pendingApprovals, to: '/employee/requests' },
            ].map((s) => (
              <button key={s.label} onClick={() => navigate(s.to)} className="rounded-xl border bg-card p-2.5 text-left shadow-sm active:bg-accent/40">
                <p className="text-base font-bold leading-none">{s.value}</p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{s.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {dash?.recentActivity && Object.values(dash.recentActivity).some(Boolean) && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-muted-foreground">
            <Activity className="h-4 w-4" /> Recent Activity
          </h2>
          <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {[
              { key: 'latestDailyReport', label: 'Daily report' },
              { key: 'latestMaterialRequest', label: 'Material request' },
              { key: 'latestManpowerRequest', label: 'Manpower request' },
              { key: 'latestLead', label: 'Lead' },
              { key: 'lastAttendance', label: 'Attendance' },
            ].map(({ key, label }) => {
              const item = dash.recentActivity?.[key];
              if (!item) return null;
              return (
                <div key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="truncate text-sm font-medium">{item.label}</p>
                  </div>
                  {item.status && <StatusPill status={String(item.status).toUpperCase()} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
