import { useEffect, useMemo, useState } from 'react';
import { Package, RefreshCw, User, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import {
  ordersApi, OrderSummary, OrderDetail, ORDER_STATUSES, PAYMENT_STATUSES,
} from '@/api/websiteAdminApi';
import { toast } from '@/components/ui/toast';

const inr = (n?: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const when = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-emerald-100 text-emerald-700',
  PROCESSING: 'bg-emerald-100 text-emerald-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};
const PAY_STYLE: Record<string, string> = {
  UNPAID: 'bg-slate-200 text-slate-600',
  PAID: 'bg-green-100 text-green-700',
  REFUNDED: 'bg-orange-100 text-orange-700',
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${map[value] ?? 'bg-slate-100 text-slate-600'}`}>
      {value}
    </span>
  );
}

export default function OrdersAdmin() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    ordersApi.list()
      .then((data) => setOrders(data))
      .catch(() => toast.error('Could not load orders.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    ordersApi.get(selectedId).then(setDetail).catch(() => toast.error('Could not open order.'));
  }, [selectedId]);

  const visible = useMemo(
    () => (filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [orders]);

  const applyDetail = (updated: OrderDetail) => {
    setDetail(updated);
    setOrders((prev) => prev.map((o) => (o.id === updated.id
      ? { ...o, status: updated.status, paymentStatus: updated.paymentStatus } : o)));
  };

  const changeStatus = async (status: string) => {
    if (!detail || status === detail.status) return;
    setSaving(true);
    try {
      applyDetail(await ordersApi.updateStatus(detail.id, status));
      toast.success(`Order marked ${status.toLowerCase()}.`);
    } catch { toast.error('Could not update status.'); }
    finally { setSaving(false); }
  };

  const changePayment = async (paymentStatus: string) => {
    if (!detail || paymentStatus === detail.paymentStatus) return;
    setSaving(true);
    try {
      applyDetail(await ordersApi.updatePayment(detail.id, paymentStatus, detail.paymentRef));
      toast.success(`Payment marked ${paymentStatus.toLowerCase()}.`);
    } catch { toast.error('Could not update payment.'); }
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
            All ({orders.length})
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === s ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()} ({counts[s] ?? 0})
            </button>
          ))}
          <button onClick={load} className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-primary hover:border-primary">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading orders…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Package className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-muted-foreground">No orders {filter === 'ALL' ? 'yet' : `in ${filter.toLowerCase()}`}.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Order</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 font-semibold text-right tabular-nums">Total</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Payment</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={`cursor-pointer border-b last:border-0 transition-colors hover:bg-slate-50 ${
                      selectedId === o.id ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{o.orderNumber}</p>
                      <p className="text-xs text-muted-foreground">{when(o.placedAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{o.customerName || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{inr(o.total)}</td>
                    <td className="px-4 py-3"><Badge value={o.status} map={STATUS_STYLE} /></td>
                    <td className="px-4 py-3"><Badge value={o.paymentStatus} map={PAY_STYLE} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Detail ---- */}
      <aside className="lg:sticky lg:top-0 h-max">
        {!detail ? (
          <div className="rounded-lg border border-dashed py-20 text-center text-sm text-muted-foreground">
            Select an order to view details.
          </div>
        ) : (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-slate-900">{detail.orderNumber}</h2>
                  <p className="text-xs text-muted-foreground">Placed {when(detail.placedAt)}</p>
                </div>
                <Badge value={detail.status} map={STATUS_STYLE} />
              </div>
            </div>

            {/* Items */}
            <div className="border-b p-4">
              <ul className="space-y-2">
                {detail.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{it.productName} <span className="text-muted-foreground">× {it.qty}</span></span>
                    <span className="font-medium tabular-nums text-slate-800">{inr(it.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{inr(detail.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="tabular-nums">{detail.deliveryFee ? inr(detail.deliveryFee) : 'Free'}</dd></div>
                <div className="flex justify-between border-t pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{inr(detail.total)}</dd></div>
              </dl>
            </div>

            {/* Contact & delivery */}
            <div className="space-y-1.5 border-b p-4 text-sm text-slate-700">
              {detail.contactName && <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /> {detail.contactName}</p>}
              {detail.contactPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {detail.contactPhone}</p>}
              {detail.contactEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {detail.contactEmail}</p>}
              {(detail.deliveryAddress || detail.city) && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>{[detail.deliveryAddress, detail.city, detail.pincode].filter(Boolean).join(', ')}</span>
                </p>
              )}
              {detail.paymentMethod && (
                <p className="flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-slate-400" /> {detail.paymentMethod}</p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Order status</span>
                <select
                  value={detail.status}
                  disabled={saving}
                  onChange={(e) => changeStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</span>
                <select
                  value={detail.paymentStatus}
                  disabled={saving}
                  onChange={(e) => changePayment(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
