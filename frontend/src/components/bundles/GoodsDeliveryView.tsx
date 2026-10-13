import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Package, Phone, Search, Truck, X } from 'lucide-react';
import type { Bundle } from '@/api/bundleApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BaseInput } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { apiError } from '@/lib/apiError';
import { resolveFileUrl, uploadFile } from '@/lib/uploadFile';
import PhotoPickButtons from '@/pages/employeeTasks/components/PhotoPickButtons';
import { EmptyState, inr } from '@/pages/employeePortal/_shared';

const METHODS = [
  { v: 'CASH', label: 'Cash' },
  { v: 'UPI', label: 'UPI' },
  { v: 'CARD', label: 'Card' },
  { v: 'BANK_TRANSFER', label: 'Bank' },
];

const due = (b: Bundle) => Math.max(0, Number(b.balanceDue ?? 0));
const dayText = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

export interface DeliverBody {
  deliveredTo?: string; note?: string; photoUrl?: string;
  payments?: { method: string; amount: number; referenceNumber?: string }[];
}

/**
 * Goods Delivery (employee portal Requests tab and the admin Orders → Goods Delivery page): orders that are Completed — and ones still in Process — waiting to go to
 * the customer. The delivery person opens one, collects the pending amount, and marks it Delivered. An order
 * still in Process needs a remark; admins are told. Whatever is owed on the bill must be collected in full.
 */
export default function GoodsDeliveryView({ loadOrders, deliver }: {
  loadOrders: () => Promise<Bundle[]>;
  deliver: (id: number, body: DeliverBody) => Promise<unknown>;
}) {
  const [orders, setOrders] = useState<Bundle[] | null>(null);
  const [tab, setTab] = useState<'READY' | 'PROCESS'>('READY');
  const [active, setActive] = useState<Bundle | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    loadOrders().then(setOrders)
      .catch((e) => { toast.error(apiError(e, 'Could not load the orders.')); setOrders([]); });
  }, [loadOrders]);
  useEffect(() => { load(); }, [load]);

  // Search: order code, customer name, phone or bill number (digits in a phone match with or without spaces).
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders ?? [];
    const qDigits = q.replace(/\D/g, '');
    return (orders ?? []).filter((o) =>
      [o.code, o.groupCode, o.customerName, o.invoiceNumber].some((v) => (v ?? '').toLowerCase().includes(q))
      || (qDigits.length >= 3 && (o.customerPhone ?? '').replace(/\D/g, '').includes(qDigits)));
  }, [orders, query]);
  const ready = useMemo(() => matches.filter((o) => o.status === 'COMPLETED'), [matches]);
  const inProcess = useMemo(() => matches.filter((o) => o.status === 'PROCESS'), [matches]);
  const list = tab === 'READY' ? ready : inProcess;

  return (
    <div className="flex flex-col pb-6">
      <div className="flex flex-col gap-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <BaseInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order, customer, phone or bill no."
            autoComplete="off" className="w-full rounded-xl border bg-card py-2.5 pl-9 pr-9 text-sm" />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-accent">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {([['READY', 'Ready', ready.length], ['PROCESS', 'In process', inProcess.length]] as const).map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${tab === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              {label} <span className="ml-1 text-xs font-medium opacity-70">{n}</span>
            </button>
          ))}
        </div>

        {tab === 'PROCESS' && inProcess.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            These are still being worked on. You can deliver one early — a remark is required and the office is told.
          </p>
        )}

        {orders === null ? (
          <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <EmptyState message={query.trim() ? 'No orders match your search.' : tab === 'READY' ? 'No completed orders waiting for delivery.' : 'No orders in process.'} />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {list.map((o) => (
              <button key={o.id} onClick={() => setActive(o)}
                className="rounded-2xl border bg-card p-3.5 text-left shadow-sm active:bg-accent/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[15px] font-bold">{o.code}</p>
                    <p className="truncate text-sm">{o.customerName || 'Walk-in'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    due(o) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {due(o) > 0 ? `Collect ${inr(due(o))}` : 'Paid'}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                  {o.handoverMode === 'DELIVERY' && <><Truck className="ml-1 h-3.5 w-3.5" /> Delivery</>}
                  {o.dueDate && <span className="ml-auto">Due {dayText(o.dueDate)}</span>}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {active && <DeliverSheet order={active} deliver={deliver} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />}
    </div>
  );
}

function DeliverSheet({ order, deliver: sendDelivery, onClose, onDone }: {
  order: Bundle; deliver: (id: number, body: DeliverBody) => Promise<unknown>; onClose: () => void; onDone: () => void;
}) {
  const owed = due(order);
  const early = order.status !== 'COMPLETED';
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(owed > 0 ? String(owed) : '');
  const [reference, setReference] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const paying = Number(amount) || 0;
  const short = owed - paying > 0.004;
  const blocked = saving || uploading || short || (early && !note.trim());

  const upload = async (files: File[]) => {
    if (!files[0]) return;
    setUploading(true); setError('');
    try { setPhotoUrl((await uploadFile(files[0], 'BUNDLE')).fileUrl); }
    catch { setError('Photo upload failed. Try again.'); }
    finally { setUploading(false); }
  };

  const deliver = async () => {
    setSaving(true); setError('');
    try {
      await sendDelivery(order.id, {
        deliveredTo: deliveredTo.trim() || undefined,
        note: note.trim() || undefined,
        photoUrl: photoUrl || undefined,
        payments: owed > 0 ? [{ method, amount: paying, referenceNumber: reference.trim() || undefined }] : undefined,
      });
      toast.success(`${order.code} delivered${owed > 0 ? ` · ${inr(paying)} collected` : ''}`);
      onDone();
    } catch (e) {
      setError(apiError(e, 'Could not deliver the order.'));
    } finally { setSaving(false); }
  };

  const phone = order.customerPhone;
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle>Deliver {order.code}</DialogTitle></DialogHeader>

        <div className="rounded-xl border p-3">
          <p className="text-sm font-semibold">{order.customerName || 'Walk-in'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {phone && <a href={`tel:${phone}`} className="flex items-center gap-1 font-medium text-emerald-700"><Phone className="h-3.5 w-3.5" /> {phone}</a>}
            {order.invoiceNumber && <span>Bill {order.invoiceNumber}</span>}
            {order.handoverMode === 'DELIVERY' && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Delivery</span>}
          </div>
          <ul className="mt-2 flex flex-col gap-0.5 border-t pt-2 text-[13px]">
            {(order.items ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{i.description}</span>
                <span className="shrink-0 text-muted-foreground">× {Number(i.quantity)}{i.unit ? ` ${i.unit}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>

        {early && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This order is still in <b>process</b>. Delivering it now closes it — add a remark saying why.
          </p>
        )}

        {owed > 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Pending amount to collect</p>
            <p className="text-2xl font-extrabold text-red-700">{inr(owed)}</p>
            <div className="mt-2.5 grid grid-cols-4 gap-1">
              {METHODS.map((m) => (
                <button key={m.v} type="button" onClick={() => setMethod(m.v)}
                  className={`rounded-lg border py-1.5 text-xs font-semibold ${method === m.v ? 'border-emerald-700 bg-emerald-700 text-white' : 'bg-white'}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <BaseInput value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal"
              placeholder="Amount received" className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
            {method !== 'CASH' && (
              <BaseInput value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / transaction no."
                className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
            )}
            {short && <p className="mt-1.5 text-xs text-red-700">Collect the full {inr(owed)} to deliver.</p>}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Nothing pending — the bill is paid.
          </p>
        )}

        <BaseInput value={deliveredTo} onChange={(e) => setDeliveredTo(e.target.value)} placeholder="Received by (name)"
          className="w-full rounded-lg border px-3 py-2 text-sm" />
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder={early ? 'Remark (required) — why is it delivered before completion?' : 'Remark (optional)'}
          className="w-full rounded-lg border px-3 py-2 text-sm" />
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Photo (optional)</p>
          {photoUrl ? (
            <div className="relative h-20 w-20">
              <img src={resolveFileUrl(photoUrl)} alt="" className="h-full w-full rounded-lg border object-cover" />
              <button type="button" onClick={() => setPhotoUrl('')} aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
            </div>
          ) : <PhotoPickButtons onPicked={upload} busy={uploading} />}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <button onClick={deliver} disabled={blocked}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {owed > 0 ? `Deliver & collect ${inr(paying)}` : 'Mark delivered'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
