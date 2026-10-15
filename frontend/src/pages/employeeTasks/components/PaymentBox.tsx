import { useState } from 'react';
import { IndianRupee, Paperclip, Plus, Wallet } from 'lucide-react';
import { ProjectExecutionInfo } from '@/types/employeeTask';
import { resolveFileUrl } from '@/lib/uploadFile';
import { HeadLink, SectionHead } from './ProjectTaskLayout';
import { useT, useTr, dateLocale, currentLang } from '@/i18n';

const has = (v: unknown) => v != null && String(v).trim() !== '';
const money = (v: unknown) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtDate = (s?: string | null) =>
  has(s) ? new Date(s as string).toLocaleDateString(dateLocale(currentLang()), { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const STATUS: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: 'Verified', cls: 'bg-[#E7F2EC] text-[#2C7050]' },
  PENDING_APPROVAL: { label: 'Awaiting check', cls: 'bg-[#FBEFE0] text-[#9B6B32]' },
  REJECTED: { label: 'Rejected', cls: 'bg-[#FBE7E4] text-[#B94B45]' },
};

/**
 * Customer payments report on the project task: what the order is worth, what the customer has paid
 * (verified), what the employee has entered that's still waiting for the office, and what is still to
 * collect — with every entry listed (date, mode, reference, the employee's note, who entered it).
 * "Record payment" saves a new entry as "awaiting check" until an admin confirms it.
 */
export default function PaymentBox({ info, canRecord, onRecord, compact = false }: {
  info: ProjectExecutionInfo;
  /** Half-width card: headline numbers only, with "View" revealing the full report. */
  compact?: boolean;
  canRecord: boolean;
  onRecord: () => void;
}) {
  const { t } = useT();
  const tr = useTr();
  const [expanded, setExpanded] = useState(false);
  const full = !compact || expanded;
  const payments = (info.payments || []).filter((p) => p.amount != null);
  const pending = Number(info.collectedPending || 0);
  const confirmed = Number(info.collectedConfirmed || 0);
  const value = has(info.contractValue) ? Number(info.contractValue) : null;
  const toCollect = has(info.pendingToCollect)
    ? Number(info.pendingToCollect)
    : value != null ? Math.max(0, value - confirmed - pending) : null;
  const paidPct = value && value > 0 ? Math.min(100, Math.round(((confirmed + pending) / value) * 100)) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
      <div className={compact ? 'p-3.5' : 'p-4'}>
        {compact ? (
          <SectionHead icon={<Wallet className="h-4 w-4" />} title={t('pw.pb.title')} tight
            right={<HeadLink label={t('pw.pb.view')} open={expanded} onClick={() => setExpanded((o) => !o)} />} />
        ) : (
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B6B32]">
            <Wallet className="h-3.5 w-3.5" /> {t('pw.pb.title')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Stat label={t('pw.pb.collected')} value={money(confirmed)} tone="text-[#2C7050]" />
          {full && value != null && <Stat label={t('pw.pb.orderValue')} value={money(value)} tone="text-[#1A211E]" />}
          {toCollect != null && (
            <Stat label={t('pw.pb.pendingCollect')} value={money(toCollect)} tone={toCollect > 0 ? 'text-[#B94B45]' : 'text-[#2C7050]'} />
          )}
        </div>

        {full && paidPct != null && (
          <div className="mt-2.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFEBE0]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#0A573B] to-[#0F6E56]" style={{ width: `${paidPct}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-[#8A8F86]">{t('pw.pb.paidPct', { pct: paidPct })}</p>
          </div>
        )}

        {full && (
          payments.length > 0 ? (
            <ul className="mt-3 flex flex-col divide-y divide-[#F1ECE2] border-t border-[#F1ECE2]">
              {payments.map((p, i) => {
                const st = STATUS[String(p.status).toUpperCase()] || { label: String(p.status || ''), cls: 'bg-[#EEF0EE] text-[#5B625E]' };
                const rejected = String(p.status).toUpperCase() === 'REJECTED';
                return (
                  <li key={p.id ?? i} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[15px] font-bold ${rejected ? 'text-[#9A9E96] line-through' : 'text-[#1A211E]'}`}>{money(p.amount)}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${st.cls}`}>{tr(`pw.pb.${String(p.status).toUpperCase()}`, st.label)}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[#7A8078]">
                      {[fmtDate(p.date), p.method, has(p.reference) ? t('pw.pb.ref', { ref: String(p.reference) }) : '', p.collectedBy ? t('pw.pb.by', { name: p.collectedBy }) : '']
                        .filter(Boolean).join(' · ')}
                    </p>
                    {has(p.note) && <p className="mt-1 rounded-lg bg-[#FBFAF6] px-2.5 py-1.5 text-[12.5px] text-[#33392F] ring-1 ring-[#EFE9DC]">{p.note}</p>}
                    {has(p.receiptUrl) && (
                      <a href={resolveFileUrl(p.receiptUrl as string)} target="_blank" rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0A573B]">
                        <Paperclip className="h-3.5 w-3.5" /> {t('pw.pb.receipt')}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl bg-[#FBFAF6] px-3 py-3 text-center text-[12.5px] text-[#8A8F86] ring-1 ring-[#EFE9DC]">
              {t('pw.pb.none')}
            </p>
          )
        )}

        {canRecord && (
          <>
            <button onClick={onRecord}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0A573B] py-2.5 text-[13px] font-semibold text-white active:scale-[0.99]">
              <Plus className="h-4 w-4" /> {t('pw.pb.recordBtn')}
            </button>
            {full && <p className="mt-2 text-[11.5px] text-[#8A8F86]">{t('pw.pb.recordNote')}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-[#FBFAF6] px-3 py-2 ring-1 ring-[#EFE9DC]">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#A6A99E]">
        <IndianRupee className="h-2.5 w-2.5" /> {label}
      </p>
      <p className={`text-[15px] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
