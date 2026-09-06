import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, RefreshCw, User, Phone, Mail, MapPin, Rocket, ExternalLink, Tag, IndianRupee } from 'lucide-react';
import {
  enquiriesApi, EnquirySummary, EnquiryDetail, ENQUIRY_STATUSES, ENQUIRY_CHANNEL_LABELS,
} from '@/api/websiteAdminApi';
import { toast } from '@/components/ui/toast';

const when = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-600',
};
const CHANNEL_STYLE: Record<string, string> = {
  CONTACT: 'bg-slate-100 text-slate-600',
  CONSULTATION: 'bg-violet-100 text-violet-700',
  PRODUCT_QUOTE: 'bg-teal-100 text-teal-700',
};

const pretty = (s: string) => s.replace('_', ' ').charAt(0) + s.replace('_', ' ').slice(1).toLowerCase();

function Badge({ value, map, label }: { value: string; map: Record<string, string>; label?: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${map[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {label ?? pretty(value)}
    </span>
  );
}

export default function EnquiriesAdmin() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<EnquirySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EnquiryDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    enquiriesApi.list()
      .then(setRows)
      .catch(() => toast.error('Could not load enquiries.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    enquiriesApi.get(selectedId).then(setDetail).catch(() => toast.error('Could not open enquiry.'));
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

  const applyDetail = (updated: EnquiryDetail) => {
    setDetail(updated);
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status, converted: updated.converted } : r)));
  };

  const changeStatus = async (status: string) => {
    if (!detail || status === detail.status) return;
    setSaving(true);
    try {
      applyDetail(await enquiriesApi.updateStatus(detail.id, status));
      toast.success(`Marked ${pretty(status).toLowerCase()}.`);
    } catch { toast.error('Could not update status.'); }
    finally { setSaving(false); }
  };

  const convert = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await enquiriesApi.convert(detail.id);
      applyDetail(updated);
      toast.success('Converted to a lead.');
      if (updated.leadId) navigate(`/leads/${updated.leadId}`);
    } catch { toast.error('Could not convert to lead.'); }
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
          {ENQUIRY_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === s ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {pretty(s)} ({counts[s] ?? 0})
            </button>
          ))}
          <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-primary hover:border-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading enquiries…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Inbox className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-muted-foreground">No enquiries {filter === 'ALL' ? 'yet' : `in ${pretty(filter).toLowerCase()}`}.</p>
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
                      <p className="truncate font-semibold text-slate-800">{r.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[r.interest, when(r.createdAt)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge value={r.status} map={STATUS_STYLE} />
                      <Badge value={r.channel} map={CHANNEL_STYLE} label={ENQUIRY_CHANNEL_LABELS[r.channel] ?? r.channel} />
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
            Select an enquiry to view details.
          </div>
        ) : (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-slate-900">{detail.name}</h2>
                <Badge value={detail.channel} map={CHANNEL_STYLE} label={ENQUIRY_CHANNEL_LABELS[detail.channel] ?? detail.channel} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{detail.sourceLabel || 'Website enquiry'} · {when(detail.createdAt)}</p>
            </div>

            {/* contact */}
            <div className="space-y-1.5 border-b p-4 text-sm text-slate-700">
              {detail.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {detail.phone}</p>}
              {detail.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {detail.email}</p>}
              {detail.city && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {detail.city}</p>}
              {!detail.phone && !detail.email && !detail.city && <p className="text-xs text-muted-foreground">No contact details provided.</p>}
            </div>

            {/* interest */}
            {(detail.interest || detail.propertyType || detail.area || detail.budget) && (
              <div className="grid grid-cols-2 gap-3 border-b p-4 text-sm">
                {detail.interest && <Field icon={Tag} label="Interested in" value={detail.interest} />}
                {detail.propertyType && <Field icon={User} label="Property" value={detail.propertyType} />}
                {detail.area && <Field icon={MapPin} label="Area" value={detail.area} />}
                {detail.budget && <Field icon={IndianRupee} label="Budget" value={detail.budget} />}
              </div>
            )}

            {detail.message && (
              <div className="border-b p-4 text-sm text-slate-700 whitespace-pre-wrap">{detail.message}</div>
            )}

            {/* actions */}
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={detail.status}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {ENQUIRY_STATUSES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
                </select>
              </label>

              {detail.leadId ? (
                <button
                  onClick={() => navigate(`/leads/${detail.leadId}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <ExternalLink className="h-4 w-4" /> Open lead #{detail.leadId}
                </button>
              ) : (
                <button
                  onClick={convert}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Rocket className="h-4 w-4" /> Convert to lead
                </button>
              )}
              <p className="text-center text-[11px] text-muted-foreground">
                Converting creates a CRM lead and starts the sales journey.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div>
      <span className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}
