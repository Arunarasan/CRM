import { ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Briefcase, AlertCircle, Check, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

interface NotificationItem {
  id: number; title: string; message: string; type: string; read: boolean; createdAt: string; actionUrl?: string;
}

const ICONS: Record<string, ReactElement> = {
  TASK: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
  PROJECT: <Briefcase className="h-5 w-5 text-orange-500" />,
  LEAD: <AlertCircle className="h-5 w-5 text-purple-500" />,
};

export default function MobileNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const navigate = useNavigate();

  const load = () => api.get('/notifications?size=50').then((res) => setItems(res.data.content || []));
  useEffect(() => { load(); }, []);

  const markAsRead = (id: number) => api.post(`/notifications/${id}/read`).then(load);
  const markAllAsRead = () => api.post('/notifications/mark-all-read').then(load);
  const remove = (id: number) => api.delete(`/notifications/${id}`).then(load).catch(() => {});
  const clearAll = () => {
    if (items.length === 0) return;
    if (confirm('Clear all notifications?')) api.delete('/notifications').then(load).catch(() => {});
  };

  // Route a notification's actionUrl to the right PORTAL screen. Backend action URLs are a mix of
  // desktop routes ("/tasks/5", "/projects") and portal routes ("/employee/..."), so map both.
  const openNotification = (n: NotificationItem) => {
    if (!n.read) markAsRead(n.id);
    const url = n.actionUrl;
    if (!url) return;

    // Any task URL — "/tasks/5" or "/employee/tasks/5" — opens the mobile task detail (start work there).
    const task = url.match(/\/tasks\/(\d+)/);
    if (task) { navigate(`/employee/tasks/${task[1]}`); return; }

    // Already a portal route (leave, salary, material request, etc.) — go straight there.
    if (url.startsWith('/employee/')) { navigate(url); return; }

    // Map known desktop routes to their portal equivalents.
    if (url.startsWith('/projects')) { navigate('/employee/projects'); return; }
    if (url.startsWith('/leads')) { navigate('/employee/leads'); return; }
    if (url.includes('material-request')) { navigate('/employee/requests/material'); return; }
    // Unknown target: leave the user on the notifications list rather than a dead link.
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-bold">Notifications</h1>
        <div className="flex items-center gap-3">
          <button onClick={markAllAsRead} className="flex items-center gap-1 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> Mark all read
          </button>
          <button onClick={clearAll} className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 text-slate-300" />
            You're all caught up.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`flex items-stretch gap-2 border-b last:border-0 ${n.read ? 'bg-card' : 'bg-blue-50/50'}`}
            >
              <button onClick={() => openNotification(n)} className="flex min-w-0 flex-1 gap-3 p-3 text-left">
                <span className="mt-0.5 shrink-0">{ICONS[n.type] ?? <Bell className="h-5 w-5 text-slate-500" />}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.message}</span>
                  <span className="block text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
              </button>
              <button onClick={() => remove(n.id)} className="flex shrink-0 items-center px-3 text-muted-foreground active:text-destructive" aria-label="Delete notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
