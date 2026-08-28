import { useNavigate } from 'react-router-dom';
import {
  Boxes, Users, UserPlus, ClipboardList, Plane, ChevronRight,
} from 'lucide-react';

/**
 * Requests hub — the "Requests" bottom-nav tab. A launchpad for every self-service request an
 * employee can raise. Entries marked `soon` are wired as their backend/frontend phases land
 * (Material, Manpower, Leads, Daily Reports); Leave is already live.
 */
const ITEMS: {
  to: string;
  label: string;
  hint: string;
  icon: typeof Boxes;
  color: string;
  soon?: boolean;
}[] = [
  { to: '/employee/requests/material', label: 'Material Requests', hint: 'Request materials for a task', icon: Boxes, color: 'text-orange-600' },
  { to: '/employee/requests/manpower', label: 'Manpower Requests', hint: 'Request additional workers', icon: Users, color: 'text-emerald-600' },
  { to: '/employee/leads', label: 'My Leads', hint: 'Add a new customer lead', icon: UserPlus, color: 'text-emerald-600' },
  { to: '/employee/daily-reports', label: 'Daily Reports', hint: 'Submit today’s work report', icon: ClipboardList, color: 'text-emerald-600' },
  { to: '/employee/leave', label: 'Leave', hint: 'Apply for leave & view balance', icon: Plane, color: 'text-violet-600' },
];

export default function Requests() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <h1 className="text-lg font-bold leading-tight">Requests</h1>
        <p className="text-xs text-muted-foreground">Raise and track your requests</p>
      </div>

      <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
        {ITEMS.map(({ to, label, hint, icon: Icon, color, soon }) => (
          <button
            key={to}
            disabled={soon}
            onClick={() => !soon && navigate(to)}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${soon ? 'opacity-60' : 'active:bg-accent/40'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-accent/50 ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold">{label}</span>
                {soon && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Soon
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
            {!soon && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
      </div>
    </div>
  );
}
