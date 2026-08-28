import { useEffect, useMemo, useState } from 'react';
import { Inbox, RefreshCw, User, Phone, Mail, Send, Paperclip, FolderKanban } from 'lucide-react';
import {
  serviceRequestsApi, ServiceRequestSummary, ServiceRequestDetail, SERVICE_REQUEST_STATUSES,
} from '@/api/websiteAdminApi';
import { toast } from '@/components/ui/toast';

const when = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-emerald-100 text-emerald-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-200 text-slate-600',
};
const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-emerald-100 text-emerald-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${map[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {value.replace('_', ' ')}
    </span>
  );
}

export default function ServiceRequestsAdmin() {
  const [rows, setRows] = useState<ServiceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ServiceRequestDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState('');

  const load = () => {
    setLoading(true);
    serviceRequestsApi.list()
      .then(setRows)
      .catch(() => toast.error('Could not load service requests.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    setReplyText('');
    serviceRequestsApi.get(selectedId).then(setDetail).catch(() => toast.error('Could not open request.'));
  }, [selectedId]);

  const visible = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const applyDetail = (updated: ServiceRequestDetail) => {
    setDetail(updated);
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)));
  };

  const changeStatus = async (status: string) => {
    if (!detail || status === detail.status) return;
    setSaving(true);
    try {
      applyDetail(await serviceRequestsApi.updateStatus(detail.id, status));
      toast.success(`Marked ${status.replace('_', ' ').toLowerCase()}.`);
    } catch { toast.error('Could not update status.'); }
    finally { setSaving(false); }
  };

  const sendReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSaving(true);
    try {
      await serviceRequestsApi.reply(detail.id, replyText.trim());
      setReplyText('');
      toast.success('Reply sent to the customer.');
    } catch { toast.error('Could not send reply.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* ---- List ---- */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All ({rows.length})
          </button>
          {SERVICE_REQUEST_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === s ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.replace('_', ' ').charAt(0) + s.replace('_', ' ').slice(1).toLowerCase()} ({counts[s] ?? 0})
            </button>
          ))}
          <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-primary hover:border-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading requests…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Inbox className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-muted-foreground">No requests {filter === 'ALL' ? 'yet' : `in ${filter.replace('_', ' ').toLowerCase()}`}.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full rounded-lg border bg-white p-4 text-left transition-colors hover:border-primary/50 ${
                    selectedId === r.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{r.subject}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[r.customerName, r.issueType].filter(Boolean).join(' · ')} · {when(r.createdAt)}
                        {r.hasMedia && ' · 📎'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge value={r.status} map={STATUS_STYLE} />
                      <Badge value={r.priority} map={PRIORITY_STYLE} />
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- Detail ---- */}
      <aside className="lg:sticky lg:top-0 h-max">
        {!detail ? (
          <div className="rounded-lg border border-dashed py-20 text-center text-sm text-muted-foreground">
            Select a request to view details.
          </div>
        ) : (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-slate-900">{detail.subject}</h2>
                <Badge value={detail.priority} map={PRIORITY_STYLE} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Raised {when(detail.createdAt)}</p>
            </div>

            {detail.description && (
              <div className="border-b p-4 text-sm text-slate-700 whitespace-pre-wrap">{detail.description}</div>
            )}

            {detail.media.length > 0 && (
              <div className="border-b p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" /> Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {detail.media.map((m) => (
                    <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="block h-16 w-16 overflow-hidden rounded border hover:ring-2 hover:ring-primary">
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 border-b p-4 text-sm text-slate-700">
              {detail.customerName && <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /> {detail.customerName}</p>}
              {detail.customerPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {detail.customerPhone}</p>}
              {detail.customerEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {detail.customerEmail}</p>}
              {detail.projectName && <p className="flex items-center gap-2"><FolderKanban className="h-3.5 w-3.5 text-slate-400" /> {detail.projectName}</p>}
            </div>

            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={detail.status}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {SERVICE_REQUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ').charAt(0) + s.replace('_', ' ').slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reply to customer</span>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="Write a message — it reaches the customer in their portal…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={sendReply}
                  disabled={saving || !replyText.trim()}
                  className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Send reply
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
