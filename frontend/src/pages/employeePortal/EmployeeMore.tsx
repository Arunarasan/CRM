import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCircle, CalendarDays, Plane, Wallet, FolderKanban, FileText, Bell, LogOut, ChevronRight,
  Clock, Settings as SettingsIcon, ListTodo,
} from 'lucide-react';
import { employeePortalApi } from '@/api/employeePortalApi';
import { EmployeeProfile } from '@/types/employeePortal';
import { useT } from '@/i18n';

const ITEMS = [
  { to: '/employee/profile', labelKey: 'portal.more.myProfile', icon: UserCircle, color: 'text-primary' },
  { to: '/employee/attendance', labelKey: 'portal.more.attendance', icon: CalendarDays, color: 'text-emerald-600' },
  { to: '/employee/timesheet', labelKey: 'portal.more.timesheet', icon: Clock, color: 'text-teal-600' },
  { to: '/employee/task-management', labelKey: 'portal.more.taskManagement', icon: ListTodo, color: 'text-fuchsia-600' },
  { to: '/employee/leave', labelKey: 'portal.more.leave', icon: Plane, color: 'text-emerald-600' },
  { to: '/employee/salary', labelKey: 'portal.more.salary', icon: Wallet, color: 'text-amber-600' },
  { to: '/employee/projects', labelKey: 'portal.more.myProjects', icon: FolderKanban, color: 'text-violet-600' },
  { to: '/employee/documents', labelKey: 'portal.more.documents', icon: FileText, color: 'text-rose-600' },
  { to: '/employee/notifications', labelKey: 'portal.more.notifications', icon: Bell, color: 'text-orange-500' },
  { to: '/employee/settings', labelKey: 'portal.more.settings', icon: SettingsIcon, color: 'text-slate-600' },
];

export default function EmployeeMore() {
  const [p, setP] = useState<EmployeeProfile | null>(null);
  const navigate = useNavigate();
  const { t } = useT();

  useEffect(() => { employeePortalApi.me().then(setP).catch(() => {}); }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRoles');
    window.location.href = import.meta.env.BASE_URL + 'login';
  };

  return (
    <div className="flex flex-col">
      <button onClick={() => navigate('/employee/profile')} className="flex items-center gap-3 border-b bg-card px-4 py-4 text-left active:bg-accent/40">
        {p?.profilePhotoUrl ? (
          <img src={p.profilePhotoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <UserCircle className="h-14 w-14 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{p ? `${p.firstName} ${p.lastName}` : '…'}</p>
          <p className="truncate text-xs text-muted-foreground">{p?.designation || t('portal.more.employee')} · {p?.employeeCode}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="m-3 divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {ITEMS.map(({ to, labelKey, icon: Icon, color }) => (
          <button key={to} onClick={() => navigate(to)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-accent/40">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="flex-1 text-sm font-medium">{t(labelKey)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>

      <button onClick={logout} className="mx-3 mb-8 flex items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card py-3 text-sm font-semibold text-destructive shadow-sm active:bg-destructive/10">
        <LogOut className="h-4 w-4" /> {t('portal.more.signOut')}
      </button>
    </div>
  );
}
