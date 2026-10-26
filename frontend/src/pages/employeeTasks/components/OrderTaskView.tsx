import { useEffect, useMemo, useState } from 'react';
import {
  Phone, MessageCircle, Check, ChevronDown, History, StickyNote, Scissors, Package, Store, Truck, Wrench,
  Copy, MessageSquare, X, CheckCircle2, AlertTriangle, RotateCcw, Printer, Hammer, Ruler,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import PhotoPickButtons from './PhotoPickButtons';
import AudioCaptureField, { type CapturedAudio } from '@/components/AudioCaptureField';
import AudioPlayer from '@/components/AudioPlayer';
import type { Bundle } from '@/api/bundleApi';
import { fetchCompanyProfile, type CompanyProfile } from '@/lib/companyProfile';
import {
  LABEL_SIZES, getLabelSize, printBundleStickers, printJobCard, printPackingStickers, setLabelSize, type LabelSize,
} from '@/components/bundles/printStickers';
import type { OrderStep, OrderView, TaskDetail } from '@/types/employeeTask';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { formatSpec, parseSpec, specNotes } from '@/components/bundles/workSpec';
import { resolveFileUrl } from '@/lib/uploadFile';
import { humanizeDue } from '../taskUtils';
import { useT, tNow, dateLocale, currentLang } from '@/i18n';

/** The shop-floor flow every order follows. */
export const ORDER_STEPS: { key: OrderStep }[] = [
  { key: 'ORDER' }, { key: 'PROCESS' }, { key: 'COMPLETED' }, { key: 'DELIVERED' },
];
export const stepLabel = (s?: string | null) => (s && ORDER_STEPS.some((x) => x.key === s) ? tNow(`pw.ot.step.${s}`) : s ?? '');
const WORK_KEYS = ['STITCHING', 'MAKING', 'FITTING', 'OTHER'];
const WORK_ICON: Record<string, typeof Scissors> = { STITCHING: Scissors, MAKING: Hammer, FITTING: Ruler };
export const workLabel = (w?: string | null) => {
  const k = (w ?? '').toUpperCase();
  return tNow(`pw.ot.work.${WORK_KEYS.includes(k) ? k : 'STITCHING'}`);
};
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
              {stepLabel(s.key)}{i < idx ? ' ✓' : ''}
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
  return { main: it.description || tNow('pw.ot.item'), sub: amount ? tNow('pw.ot.qty', { q: amount }) : null };
}

/** The order task's data in the shape the sticker printer expects. */
function toBundle(order: OrderView): Bundle {
  return {
    id: order.id, code: order.code, groupCode: order.code, bundleNo: order.bundleNo ?? 1, bundleTotal: order.bundleTotal ?? 1,
    status: order.status, workType: order.workType ?? 'STITCHING', handoverMode: order.handoverMode ?? 'PICKUP',
    dueDate: order.dueDate, priority: order.priority ?? 'NORMAL', notes: order.notes, overdue: !!order.overdue,
    invoiceId: order.invoiceNumber ? 1 : null, invoiceNumber: order.invoiceNumber, balanceDue: order.balanceDue,
    customerName: order.customerName, customerPhone: order.customerPhone,
    itemCount: order.items.length, totalQuantity: order.items.reduce((n, i) => n + Number(i.quantity ?? 0), 0),
    items: order.items.map((i) => ({
      id: i.id, description: i.description ?? 'Item', quantity: i.quantity ?? 1, unit: i.unit, workSpec: i.workSpec,
      notes: i.notes, photoUrls: i.photoUrls, done: i.done,
    })),
  } as unknown as Bundle;
}

/** Sticker printing for the order: label size, company name, and the three print actions. */
function useStickerPrint(order: OrderView) {
  const [size, setSizeState] = useState<LabelSize>(getLabelSize());
  const [company, setCompany] = useState<CompanyProfile | undefined>();
  useEffect(() => { fetchCompanyProfile().then(setCompany).catch(() => {}); }, []);
  const bundle = useMemo(() => toBundle(order), [order]);
  const done = (ok: boolean) => { if (!ok) toast.error(tNow('pw.ot.popup')); };
  return {
    size, setSize: (v: LabelSize) => { setLabelSize(v); setSizeState(v); },
    printOrder: () => done(printBundleStickers([bundle], size, company)),
    printJobCard: () => done(printJobCard(bundle, company)),
    printAllProducts: () => done(printPackingStickers(bundle, size, company)),
    printProduct: (index: number) => done(printPackingStickers(bundle, size, company, [bundle.items![index]])),
  };
}

/**
 * Stitching / making task body: who it's for, where the order is in its flow, and exactly what to make —
 * one tickable row per item (with its size / pieces spec and photos). The step button lives in the task's
 * bottom bar; this view only reads and ticks items.
 */
export default function OrderTaskView({ task, order, canWork, onChanged, onMarkCompleted }: {
  task: TaskDetail;
  order: OrderView;
  /** The employee holds this task — items can be ticked. */
  canWork: boolean;
  onChanged: () => void;
  /** Opens the "mark completed" sheet (only offered while the order is in process). */
  onMarkCompleted?: () => void;
}) {
  const { t } = useT();
  const loc = dateLocale(currentLang());
  const print = useStickerPrint(order);
  const [detail, setDetail] = useState<OrderView['items'][number] | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const due = humanizeDue(order.dueDate ?? task.dueDate, task.status);
  const doneCount = order.items.filter((i) => i.done).length;
  const phone = order.customerPhone;
  const closed = order.status === 'COMPLETED' || order.status === 'DELIVERED' || order.status === 'CANCELLED';

  // In-flight slider values, so the bar follows the finger before the save lands.
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [allDoneOpen, setAllDoneOpen] = useState(false);
  const [problem, setProblem] = useState(false);
  const remarks = order.events.filter((e) => e.toStatus === 'REMARK');
  const history = order.events.filter((e) => e.toStatus !== 'REMARK');
  const pctOf = (it: OrderView['items'][number]) => draft[it.id] ?? (it.done ? 100 : it.progress ?? 0);
  const overall = order.items.length
    ? Math.round(order.items.reduce((n, it) => n + pctOf(it), 0) / order.items.length) : 0;

  const setProgress = async (itemId: number, progress: number) => {
    if (!canWork) { setErr(t('pw.ot.takeFirstItems')); return; }
    setBusyItem(itemId); setErr('');
    try {
      await employeeTaskApi.setOrderItemProgress(task.id, itemId, progress);
      const everyDone = progress >= 100 && order.items.every((i) => i.id === itemId || i.done);
      onChanged();
      if (everyDone && order.status === 'PROCESS' && onMarkCompleted) setAllDoneOpen(true);
    } catch (e: any) { setErr(e?.response?.data?.message || t('pw.ot.updateFailed')); }
    finally { setBusyItem(null); setDraft((d) => { const n = { ...d }; delete n[itemId]; return n; }); }
  };

  const HandIcon = order.handoverMode === 'INSTALL' ? Wrench : order.handoverMode === 'DELIVERY' ? Truck : Store;
  const handText = t(`pw.ot.hand.${order.handoverMode === 'INSTALL' ? 'INSTALL' : order.handoverMode === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'}`);

  return (
    <div className="flex flex-col gap-3">
      {/* Who and when */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F6ECDD] text-[#9B6B32]">
            {(() => { const WorkIcon = WORK_ICON[(order.workType ?? '').toUpperCase()] ?? Scissors; return <WorkIcon className="h-5 w-5" />; })()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[18px] font-bold text-[#1A211E]">
              <span className="font-mono">{order.code}</span>
              <button type="button" aria-label={t('pw.ot.copyAria')}
                onClick={() => { navigator.clipboard?.writeText(order.code).then(() => toast.success(t('pw.ot.copied'))).catch(() => {}); }}
                className="self-center rounded-md p-1 text-[#9A9E96] active:scale-90"><Copy className="h-3.5 w-3.5" /></button>
              {order.bundleTotal && order.bundleTotal > 1 && (
                <span className="text-[12px] font-medium text-[#7A817C]">{t('pw.ot.bundleOf', { n: order.bundleNo ?? 1, total: order.bundleTotal })}</span>
              )}
            </p>
            <p className="truncate text-[14px] text-[#33392F]">{order.customerName || task.customer || t('pw.ot.customer')}</p>
            {order.createdAt && (
              <p className="text-[11px] text-[#8A918C]">{t('pw.ot.ordered', { when: new Date(order.createdAt).toLocaleString(loc, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-[12px] font-semibold ${due.tone === 'overdue' ? 'text-[#C9302C]' : due.tone === 'soon' ? 'text-[#B27A12]' : 'text-[#6B726E]'}`}>{due.text}</p>
            <p className="mt-0.5 text-[11px] text-[#7A817C]">{workLabel(order.workType)}</p>
          </div>
        </div>
        {phone && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={'tel:' + digits(phone)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
              <Phone className="h-4 w-4" /> {t('pw.ot.call')}
            </a>
            <a href={'https://wa.me/' + digits(phone).replace('+', '')} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
              <MessageCircle className="h-4 w-4" /> {t('pw.ot.whatsapp')}
            </a>
          </div>
        )}
        <div className="mt-3.5"><OrderStepBar status={order.status} /></div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[#6B726E]">
          <HandIcon className="h-3.5 w-3.5" /> {handText}
          {order.rackLocation && <span className="ml-auto">{t('pw.ot.rack', { r: order.rackLocation })}</span>}
        </p>
      </div>

      {/* What to make */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-[#9B6B32]" />
          <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">{t('pw.ot.whatToMake')}</h3>
          <span className="text-[12px] font-semibold text-[#7A817C]">{t('pw.ot.doneOf', { done: doneCount, total: order.items.length, pct: overall })}</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#E3E6E2]">
          <div className="h-full rounded-full bg-[#1E9E5E] transition-all" style={{ width: `${overall}%` }} />
        </div>
        <ul className="flex flex-col gap-2">
          {order.items.map((it) => {
            const { main, sub } = itemLines(it);
            const photos = [it.productImageUrl, ...(it.photoUrls || '').split(',')].map((x) => (x || '').trim()).filter(Boolean);
            return (
              <li key={it.id} className={`rounded-xl border p-2.5 ${it.done ? 'border-[#CFE6D8] bg-[#F3FAF6]' : 'border-[#EEEDE9]'}`}>
               <div className="flex cursor-pointer gap-3" role="button" tabIndex={0} aria-label={t('pw.ot.viewDetails', { name: main })}
                 onClick={() => setDetail(it)} onKeyDown={(e) => { if (e.key === 'Enter') setDetail(it); }}>
                {photos[0] ? (
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#ECEAE5]">
                    <img src={resolveFileUrl(photos[0])} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#F5F3EE] text-[#C9C2B2]"><Scissors className="h-5 w-5" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-semibold leading-snug ${it.done ? 'text-[#4F6B5A] line-through decoration-[#9CC7AE]' : 'text-[#1A211E]'}`}>{main}</p>
                  {sub && <p className="mt-0.5 text-[12px] text-[#6B726E]">{sub}</p>}
                  {it.notes && <p className="mt-1 text-[12px] italic text-[#8A5A12]">{it.notes}</p>}
                </div>
                <button type="button" onClick={(e) => { e.stopPropagation(); print.printProduct(order.items.indexOf(it)); }} aria-label={t('pw.ot.printOneAria')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DDE2DE] bg-white text-[#0A573B] active:scale-90">
                  <Printer className="h-4 w-4" />
                </button>
               </div>
               {!closed && (
                <div className="mt-2.5 flex items-center gap-2.5">
                  <input type="range" min={0} max={100} step={5} value={pctOf(it)} disabled={busyItem === it.id}
                    aria-label={t('pw.ot.progressOf', { name: main })}
                    onChange={(e) => setDraft((d) => ({ ...d, [it.id]: Number(e.target.value) }))}
                    onPointerUp={() => { const v = draft[it.id]; if (v != null && v !== (it.progress ?? 0)) setProgress(it.id, v); }}
                    onKeyUp={() => { const v = draft[it.id]; if (v != null && v !== (it.progress ?? 0)) setProgress(it.id, v); }}
                    className="h-2 min-w-0 flex-1 accent-[#1E9E5E]" />
                  <span className="w-9 text-right text-[12px] font-semibold tabular-nums text-[#33392F]">{pctOf(it)}%</span>
                  {it.done ? (
                    <button type="button" onClick={() => setProgress(it.id, 80)} disabled={busyItem === it.id}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-[#CBD2CD] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#5B625E] active:scale-95 disabled:opacity-50">
                      <RotateCcw className="h-3.5 w-3.5" /> {t('pw.ot.reopen')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => setProgress(it.id, 100)} disabled={busyItem === it.id}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-[#0A573B] px-2.5 py-1.5 text-[12px] font-semibold text-white active:scale-95 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> {t('pw.ot.finish')}
                    </button>
                  )}
                </div>
               )}
              </li>
            );
          })}
        </ul>
        {err && <p className="mt-2 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{err}</p>}
      </div>

      {/* Stickers: the whole order, or one packing sticker per product */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="mb-2.5 flex items-center gap-2">
          <Printer className="h-4 w-4 text-[#9B6B32]" />
          <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">{t('pw.ot.printStickers')}</h3>
          <select value={print.size} onChange={(e) => print.setSize(e.target.value as LabelSize)} aria-label={t('pw.ot.labelSize')}
            className="rounded-lg border border-[#DDE2DE] bg-white px-2 py-1 text-[12px] text-[#33392F]">
            {LABEL_SIZES.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={print.printOrder}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Printer className="h-4 w-4" /> {t('pw.ot.wholeOrder')}
          </button>
          <button type="button" onClick={print.printAllProducts} disabled={order.items.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0A573B] py-2.5 text-[13px] font-semibold text-white active:scale-[0.98] disabled:opacity-50">
            <Printer className="h-4 w-4" /> {t('pw.ot.eachProduct', { n: order.items.length })}
          </button>
          <button type="button" onClick={print.printJobCard}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-[#0A573B] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Printer className="h-4 w-4" /> {t('pw.ot.jobCard')}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-[#8A8F86]">{t('pw.ot.stickerNote', { n: order.items.length })}</p>
      </div>

      {/* The customer's / counter's note */}
      {order.notes && (
        <p className="flex items-start gap-2 rounded-2xl border border-[#F0E3C8] bg-[#FDF6E7] px-3.5 py-3 text-[13.5px] text-[#7A5414]">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" /> {order.notes}
        </p>
      )}

      <RemarksPanel taskId={task.id} remarks={remarks} legacy={task.comments} canWork={canWork} onChanged={onChanged}
        problem={problem} onProblemDone={() => setProblem(false)} />

      <ItemDetailDialog item={detail} order={order} onClose={() => setDetail(null)}
        onPrint={detail ? () => print.printProduct(order.items.indexOf(detail)) : undefined} />

      <Dialog open={allDoneOpen} onOpenChange={setAllDoneOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('pw.ot.allDoneTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-[#5B625E]">{t('pw.ot.allDoneBody', { code: order.code })}</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => { setAllDoneOpen(false); onMarkCompleted?.(); }}
              className="flex items-center gap-2 rounded-xl bg-[#0A573B] px-3.5 py-3 text-left text-[14px] font-semibold text-white">
              <CheckCircle2 className="h-4 w-4" /> {t('pw.ot.markOrderCompleted')}
            </button>
            <button type="button" onClick={() => { setAllDoneOpen(false); document.getElementById('order-remarks')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
              className="flex items-center gap-2 rounded-xl border border-[#DDE2DE] px-3.5 py-3 text-left text-[14px] font-semibold text-[#0A573B]">
              <MessageSquare className="h-4 w-4" /> {t('pw.ot.addRemarkFirst')}
            </button>
            <button type="button" onClick={() => { setAllDoneOpen(false); setProblem(true); document.getElementById('order-remarks')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
              className="flex items-center gap-2 rounded-xl border border-[#F0D3CF] px-3.5 py-3 text-left text-[14px] font-semibold text-[#B94B45]">
              <AlertTriangle className="h-4 w-4" /> {t('pw.ot.reportProblem')}
            </button>
            <button type="button" onClick={() => setAllDoneOpen(false)} className="py-2 text-[13px] font-medium text-[#7A817C]">{t('pw.ot.notNow')}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History: every step, who moved it, notes and photos */}
      {history.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#ECEAE5] bg-white">
          <button type="button" onClick={() => setHistoryOpen((o) => !o)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left">
            <History className="h-4 w-4 text-[#9B6B32]" />
            <span className="flex-1 text-[14px] font-medium text-[#22271F]">{t('pw.ot.history')}</span>
            <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 text-[11px] font-medium text-[#8A6A2E]">{history.length}</span>
            <ChevronDown className={`h-4 w-4 text-[#B4B0A4] transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          {historyOpen && (
            <ul className="flex flex-col gap-2.5 border-t border-[#F1ECE2] px-3.5 py-3">
              {history.map((e) => (
                <li key={e.id} className="flex gap-2.5 text-[12.5px]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0A573B]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[#1A211E]">
                      <span className="font-semibold">{e.fromStatus ? `${stepLabel(e.fromStatus)} → ${stepLabel(e.toStatus)}` : stepLabel(e.toStatus) || t('pw.ot.update')}</span>
                      {e.userName && <span className="text-[#7A817C]"> · {e.userName}</span>}
                    </p>
                    <p className="text-[11px] text-[#8A918C]">{new Date(e.at).toLocaleString(loc, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
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

/** Remarks on the order: free text plus photos, saved with the employee's name and time. */
function RemarksPanel({ taskId, remarks, legacy, canWork, onChanged, problem, onProblemDone }: {
  taskId: number;
  remarks: OrderView['events'];
  /** Older task notes written before orders had their own Remarks list. */
  legacy: TaskDetail['comments'];
  canWork: boolean;
  onChanged: () => void;
  problem: boolean;
  onProblemDone: () => void;
}) {
  const { t } = useT();
  const loc = dateLocale(currentLang());
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [voice, setVoice] = useState<CapturedAudio[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (problem) setText((prev) => { const pre = tNow('pw.ot.problemPrefix'); return prev.startsWith(pre) ? prev : pre + prev; }); }, [problem]);

  const upload = async (files: File[]) => {
    setUploading(true); setErr('');
    try {
      const urls: string[] = [];
      for (const f of files) urls.push((await employeeTaskApi.uploadFile(f, 'BUNDLE')).fileUrl);
      setPhotos((p) => [...p, ...urls]);
    } catch { setErr(t('pw.ot.photoFailed')); }
    finally { setUploading(false); }
  };
  const save = async () => {
    if (!canWork) { setErr(t('pw.ot.takeFirstRemarks')); return; }
    setSaving(true); setErr('');
    try {
      await employeeTaskApi.addOrderRemark(taskId, { note: text.trim() || undefined, photoUrls: photos.join(',') || undefined, audioUrl: voice[0]?.url });
      setText(''); setPhotos([]); setVoice([]); onProblemDone(); onChanged();
    } catch (e: any) { setErr(e?.response?.data?.message || t('pw.ot.remarkFailed')); }
    finally { setSaving(false); }
  };

  return (
    <div id="order-remarks" className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
      <div className="mb-2.5 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#9B6B32]" />
        <h3 className="flex-1 text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">{t('pw.ot.remarks')}</h3>
        {remarks.length + legacy.length > 0 && <span className="text-[12px] font-semibold text-[#7A817C]">{remarks.length + legacy.length}</span>}
      </div>
      {remarks.length + legacy.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2.5">
          {[...remarks].reverse().map((r) => (
            <li key={r.id} className="rounded-xl bg-[#F8F6F1] px-3 py-2.5 text-[13px]">
              {r.note && <p className="whitespace-pre-wrap text-[#1A211E]">{r.note}</p>}
              {r.photoUrl && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.photoUrl.split(',').map((u) => u.trim()).filter(Boolean).map((u) => (
                    <a key={u} href={resolveFileUrl(u)} target="_blank" rel="noopener noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-[#ECEAE5]">
                      <img src={resolveFileUrl(u)} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {r.audioUrl && <AudioPlayer src={resolveFileUrl(r.audioUrl)} className="mt-1.5 w-full max-w-[260px]" />}
              <p className="mt-1 text-[11px] text-[#8A918C]">
                {r.userName || t('pw.ot.employee')} · {new Date(r.at).toLocaleString(loc, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
            </li>
          ))}
          {legacy.map((c) => (
            <li key={`c${c.id}`} className="rounded-xl bg-[#F8F6F1] px-3 py-2.5 text-[13px]">
              {c.content !== '🎤 Voice note' && <p className="whitespace-pre-wrap text-[#1A211E]">{c.content}</p>}
              {c.audioUrl && <AudioPlayer src={resolveFileUrl(c.audioUrl)} className="mt-1.5 w-full max-w-[260px]" />}
              <p className="mt-1 text-[11px] text-[#8A918C]">{c.authorName}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('pw.ot.writeRemark')}
        className="w-full rounded-md border px-3 py-2 text-sm" />
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((u) => (
            <div key={u} className="relative h-16 w-16">
              <img src={resolveFileUrl(u)} alt="" className="h-full w-full rounded-lg border object-cover" />
              <button type="button" aria-label={t('pw.common.removePhoto')} onClick={() => setPhotos((p) => p.filter((x) => x !== u))}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2">
        <AudioCaptureField value={voice} onChange={(next) => setVoice(next.slice(-1))} module="task-remark" label={t('pw.ot.addVoice')} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1"><PhotoPickButtons onPicked={upload} busy={uploading} /></div>
        <button type="button" onClick={save} disabled={saving || uploading || (!text.trim() && photos.length === 0 && voice.length === 0)}
          className="shrink-0 rounded-lg bg-[#0A573B] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
          {saving ? t('pw.ot.saving') : t('pw.ot.addRemark')}
        </button>
      </div>
      {err && <p className="mt-2 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{err}</p>}
    </div>
  );
}

/** Read-only card for one product: its picture(s), what it is, the work to do on it, notes and progress. */
function ItemDetailDialog({ item, order, onClose, onPrint }: {
  item: OrderView['items'][number] | null;
  order: OrderView;
  onClose: () => void;
  onPrint?: () => void;
}) {
  const { t } = useT();
  if (!item) return null;
  const spec = parseSpec(item.workSpec);
  const isWindow = !spec.type || ['Curtain', 'Roman Blind', 'Blind'].includes(spec.type);
  const specRows: [string, string][] = ([
    [t('pw.ot.d.spec.Type'), spec.type],
    [t('pw.ot.d.spec.Width'), spec.width ? t('pw.ot.d.inches', { n: spec.width }) : ''],
    [t('pw.ot.d.spec.Height'), spec.height ? t('pw.ot.d.inches', { n: spec.height }) : ''],
    [isWindow ? t('pw.ot.d.spec.Panels') : t('pw.ot.d.spec.Pieces'), spec.panels],
    [t('pw.ot.d.spec.Pleat'), spec.pleat && spec.pleat !== 'None' ? spec.pleat : ''],
    [t('pw.ot.d.spec.Lining'), spec.lining && spec.lining !== 'None' ? spec.lining : ''],
  ] as [string, string | undefined][]).filter(([, v]) => v && String(v).trim() !== '') as [string, string][];
  const photos = [item.productImageUrl, ...(item.photoUrls || '').split(',')].map((x) => (x || '').trim()).filter(Boolean);
  const pct = item.done ? 100 : item.progress ?? 0;
  const qtyText = item.quantity != null ? `${qty(item.quantity)} ${item.unit ?? ''}`.trim() : '';
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-3 border-b border-[#F1ECE2] py-2 text-[13.5px] last:border-0">
      <span className="shrink-0 text-[#7A817C]">{label}</span>
      <span className="min-w-0 text-right font-semibold text-[#1A211E]">{value}</span>
    </div>
  );
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[88dvh] max-w-sm overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6 leading-snug">{item.description || t('pw.ot.d.product')}</DialogTitle></DialogHeader>

        {photos.length > 0 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {photos.map((u) => (
              <a key={u} href={resolveFileUrl(u)} target="_blank" rel="noopener noreferrer"
                className="h-36 w-36 shrink-0 overflow-hidden rounded-xl border border-[#ECEAE5] bg-[#F5F3EE]">
                <img src={resolveFileUrl(u)} alt="" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        )}

        <div>
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-[#9B6B32]">{t('pw.ot.d.product')}</p>
          <Row label={t('pw.ot.d.order')} value={order.code} />
          <Row label={t('pw.ot.d.item')} value={item.description || '—'} />
          {qtyText && <Row label={t('pw.ot.d.quantity')} value={qtyText} />}
          <Row label={t('pw.ot.d.status')} value={item.done ? t('pw.ot.d.finished') : pct > 0 ? t('pw.ot.d.inProgress', { pct }) : t('pw.ot.d.notStarted')} />
        </div>

        <div>
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-[#9B6B32]">{t('pw.ot.d.workToDo', { work: workLabel(order.workType) })}</p>
          {specRows.length > 0 ? specRows.map(([l, v]) => <Row key={l} label={l} value={v} />)
            : <p className="py-2 text-[13px] text-[#8A918C]">{t('pw.ot.d.noWork')}</p>}
          {specNotes(spec).map((n, i) => <p key={i} className="mt-1.5 rounded-lg bg-[#FDF6E7] px-3 py-2 text-[13px] text-[#7A5414]">{n}</p>)}
          {item.notes && <p className="mt-1.5 rounded-lg bg-[#FDF6E7] px-3 py-2 text-[13px] italic text-[#7A5414]">{item.notes}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[#7A817C]"><span>{t('pw.ot.d.progress')}</span><span>{pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-[#E3E6E2]"><div className="h-full rounded-full bg-[#1E9E5E]" style={{ width: `${pct}%` }} /></div>
        </div>

        {onPrint && (
          <button type="button" onClick={onPrint}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#DDE2DE] py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Printer className="h-4 w-4" /> {t('pw.ot.d.printSticker')}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
