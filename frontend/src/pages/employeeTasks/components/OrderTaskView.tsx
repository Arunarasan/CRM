import { useState } from 'react';
import {
  Phone, MessageCircle, Check, ChevronDown, History, StickyNote, Scissors, Package, Store, Truck, Wrench,
} from 'lucide-react';
import type { OrderStep, OrderView, TaskDetail } from '@/types/employeeTask';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { formatSpec, parseSpec } from '@/components/bundles/workSpec';
import { resolveFileUrl } from '@/lib/uploadFile';
import { humanizeDue } from '../taskUtils';

/** The shop-floor flow every order follows. */
export const ORDER_STEPS: { key: OrderStep; label: string }[] = [
  { key: 'ORDER', label: 'Order' },
  { key: 'PROCESS', label: 'Process' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DELIVERED', label: 'Delivered' },
];
export const stepLabel = (s?: string | null) => ORDER_STEPS.find((x) => x.key === s)?.label ?? s ?? '';
const WORK_LABEL: Record<string, string> = { STITCHING: 'Stitching', MAKING: 'Making', FITTING: 'Fitting', OTHER: 'Work' };
export const workLabel = (w?: string | null) => WORK_LABEL[(w ?? '').toUpperCase()] ?? 'Stitching';
const digits = (s?: string | null) => (s || '').replace(/[^\d+]/g, '');
const qty = (n?: number | null) => (n == null ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));

/** Order → Process → Completed → Delivered as four segments, done in green and the current one in blue. */
export function OrderStepBar({ status, labels = true }: { status?: string | null; labels?: boolean }) {
  const idx = ORDER_STEPS.findIndex((s) => s.key === status);
  return (
    <div>
      {labels && (
        <div className="mb-1 grid grid-cols-4 text-[11px]">
          {ORDER_STEPS.map((s, i) => (
            <span key={s.key} className={`${i === 0 ? 'text-left' : i === 3 ? 'text-right' : 'text-center'} ${
              i < idx ? 'text-[#0A6B42]' : i === idx ? 'font-bold text-[#1A211E]' : 'text-[#9A9E96]'}`}>
              {s.label}{i < idx ? ' ✓' : ''}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        {ORDER_STEPS.map((s, i) => (
          <span key={s.key} className={`h-1.5 flex-1 rounded-full ${i < idx ? 'bg-[#1E9E5E]' : i === idx ? 'bg-[#2563A8]' : 'bg-[#E3E6E2]'}`} />
        ))}
      </div>
    </div>
  );
}

/** "Cushion fabric × 3 Mtr — Cushion Cover · 16 × 16 in · 6 pcs" → product line + material line. */
function itemLines(it: OrderView['items'][number]) {
  const spec = formatSpec(parseSpec(it.workSpec));
  const amount = it.quantity != null ? `${qty(it.quantity)} ${it.unit ?? ''}`.trim() : null;
  if (spec) return { main: spec, sub: [it.description, amount].filter(Boolean).join(' · ') || null };
  // No work spec: the bill line itself, with how many.
  return { main: it.description || 'Item', sub: amount ? `Qty ${amount}` : null };
}

/**
 * Stitching / making task body: who it's for, where the order is in its flow, and exactly what to make —
 * one tickable row per item (with its size / pieces spec and photos). The step button lives in the task's
 * bottom bar; this view only reads and ticks items.
 */
export default function OrderTaskView({ task, order, canWork, onChanged }: {
  task: TaskDetail;
  order: OrderView;
  /** The employee holds this task — items can be ticked. */
  canWork: boolean;
  onChanged: () => void;
}) {
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const due = humanizeDue(order.dueDate ?? task.dueDate, task.status);
  const doneCount = order.items.filter((i) => i.done).length;
  const phone = order.customerPhone;
  const closed = order.status === 'COMPLETED' || order.status === 'DELIVERED' || order.status === 'CANCELLED';

  const toggle = async (itemId: number, done: boolean) => {
    if (!canWork) { setErr('Take this task first, then tick items as you finish them.'); return; }
    setBusyItem(itemId); setErr('');
    try { await employeeTaskApi.setOrderItemDone(task.id, itemId, done); onChanged(); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Could not update the item.'); }
    finally { setBusyItem(null); }
  };

  const HandIcon = order.handoverMode === 'INSTALL' ? Wrench : order.handoverMode === 'DELIVERY' ? Truck : Store;
  const handText = order.handoverMode === 'INSTALL' ? 'Installed at customer' : order.handoverMode === 'DELIVERY' ? 'Delivered to customer' : 'Customer picks up';

  return (
    <div className="flex flex-col gap-3">
      {/* Who and when */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6ECDD] text-[#9B6B32]">
            <Scissors className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[18px] font-bold text-[#1A211E]">
              <span className="font-mono">{order.code}</span>
              {order.bundleTotal && order.bundleTotal > 1 && (
                <span className="text-[12px] font-medium text-[#7A817C]">{order.bundleNo} of {order.bundleTotal}</span>
              )}
            </p>
            <p className="truncate text-[14px] text-[#33392F]">{order.customerName || task.customer || 'Customer'}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[12px] font-semibold ${due.tone === 'overdue' ? 'text-[#C9302C]' : due.tone === 'soon' ? 'text-[#B27A12]' : 'text-[#6B726E]'}`}>{due.text}</p>
            <p className="mt-0.5 text-[11px] text-[#7A817C]">{workLabel(order.workType)}</p>
          </div>
        </div>
        {phone && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={'tel:' + digits(phone)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
              <Phone className="h-4 w-4" /> Call
            </a>
            <a href={'https://wa.me/' + digits(phone).replace('+', '')} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        )}
        <div className="mt-3.5"><OrderStepBar status={order.status} /></div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[#6B726E]">
          <HandIcon className="h-3.5 w-3.5" /> {handText}
          {order.rackLocation && <span className="ml-auto">Rack {order.rackLocation}</span>}
        </p>
      </div>

      {/* What to make */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#9B6B32]" />
          <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">What to make</h3>
          <span className="text-[12px] font-semibold text-[#7A817C]">{doneCount}/{order.items.length} done</span>
        </div>
        <ul className="flex flex-col gap-2">
          {order.items.map((it) => {
            const { main, sub } = itemLines(it);
            const photos = (it.photoUrls || '').split(',').map((x) => x.trim()).filter(Boolean);
            return (
              <li key={it.id} className={`flex gap-3 rounded-xl border p-2.5 ${it.done ? 'border-[#CFE6D8] bg-[#F3FAF6]' : 'border-[#EEEDE9]'}`}>
                {photos[0] ? (
                  <a href={resolveFileUrl(photos[0])} target="_blank" rel="noopener noreferrer" className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#ECEAE5]">
                    <img src={resolveFileUrl(photos[0])} alt="" className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F5F3EE] text-[#C9C2B2]"><Scissors className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-semibold leading-snug ${it.done ? 'text-[#4F6B5A] line-through decoration-[#9CC7AE]' : 'text-[#1A211E]'}`}>{main}</p>
                  {sub && <p className="mt-0.5 text-[12px] text-[#6B726E]">{sub}</p>}
                  {it.notes && <p className="mt-1 text-[12px] italic text-[#8A5A12]">{it.notes}</p>}
                </div>
                {!closed && (
                  <button type="button" onClick={() => toggle(it.id, !it.done)} disabled={busyItem === it.id}
                    aria-label={it.done ? 'Mark not done' : 'Mark done'}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg border-2 transition active:scale-90 disabled:opacity-50 ${
                      it.done ? 'border-[#1E9E5E] bg-[#1E9E5E] text-white' : 'border-[#CBD2CD] bg-white text-transparent'}`}>
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {err && <p className="mt-2 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{err}</p>}
      </div>

      {/* The customer's / counter's note */}
      {order.notes && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#F0E3C8] bg-[#FDF6E7] px-3.5 py-3 text-[13.5px] text-[#7A5414]">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" /> {order.notes}
        </p>
      )}

      {/* History: every step, who moved it, notes and photos */}
      {order.events.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white">
          <button type="button" onClick={() => setHistoryOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
            <History className="h-4 w-4 text-[#9B6B32]" />
            <span className="flex-1 text-[14px] font-medium text-[#22271F]">History</span>
            <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">{order.events.length}</span>
            <ChevronDown className={`h-4 w-4 text-[#B4B0A4] transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          {historyOpen && (
            <ul className="flex flex-col gap-2.5 border-t border-[#F1ECE2] px-3.5 py-3">
              {order.events.map((e) => (
                <li key={e.id} className="flex gap-2.5 text-[12.5px]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0A573B]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[#1A211E]">
                      <span className="font-semibold">{e.fromStatus ? `${stepLabel(e.fromStatus)} → ${stepLabel(e.toStatus)}` : stepLabel(e.toStatus) || 'Update'}</span>
                      {e.userName && <span className="text-[#7A817C]"> · {e.userName}</span>}
                    </p>
                    <p className="text-[11px] text-[#8A918C]">{new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
                    {e.note && <p className="mt-0.5 text-[#4B524E]">{e.note}</p>}
                    {e.photoUrl && (
                      <a href={resolveFileUrl(e.photoUrl)} target="_blank" rel="noopener noreferrer" className="mt-1 block h-14 w-14 overflow-hidden rounded-lg border border-[#ECEAE5]">
                        <img src={resolveFileUrl(e.photoUrl)} alt="" className="h-full w-full object-cover" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
