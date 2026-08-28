import { useEffect, useState } from 'react';
import { Star, RefreshCw, EyeOff, Eye, Trash2, MessageSquare } from 'lucide-react';
import { reviewsApi, ServiceReview } from '@/api/websiteAdminApi';
import { toast } from '@/components/ui/toast';

const when = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium' }) : '—');

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" title={`${n} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

/** Moderate service reviews written by customers in the portal. Hide/show or delete each. */
export default function ReviewsAdmin() {
  const [rows, setRows] = useState<ServiceReview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    reviewsApi.list().then(setRows).catch(() => toast.error('Could not load reviews.')).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setStatus = async (id: number, status: string) => {
    try {
      await reviewsApi.setStatus(id, status);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(status === 'HIDDEN' ? 'Review hidden.' : 'Review shown.');
    } catch (e: any) { toast.error(e?.message || 'Could not update.'); }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      await reviewsApi.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success('Review deleted.');
    } catch (e: any) { toast.error(e?.message || 'Could not delete.'); }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reviews customers left on your services in the portal. Only <b>shown</b> reviews are visible to others.
        </p>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-primary hover:border-primary">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Loading reviews…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-muted-foreground">No reviews yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border bg-white p-4 ${r.status === 'HIDDEN' ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="text-sm font-semibold text-slate-800">{r.serviceTitle}</span>
                    {r.status === 'HIDDEN' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">HIDDEN</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.customerName} · {when(r.createdAt)}</p>
                  {r.comment && <p className="mt-2 text-sm text-slate-700">{r.comment}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {r.status === 'HIDDEN' ? (
                    <button onClick={() => setStatus(r.id, 'APPROVED')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                      <Eye className="h-3.5 w-3.5" /> Show
                    </button>
                  ) : (
                    <button onClick={() => setStatus(r.id, 'HIDDEN')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                      <EyeOff className="h-3.5 w-3.5" /> Hide
                    </button>
                  )}
                  <button onClick={() => remove(r.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
