import { Clock, MessageCircle, Plus, Wallet } from 'lucide-react';
import { ProjectExecutionInfo } from '@/types/employeeTask';

const has = (v: unknown) => v != null && String(v).trim() !== '';
const money = (v: unknown) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const waHref = (phone: string, text: string) =>
  'https://wa.me/' + phone.replace(/[^\d]/g, '') + '?text=' + encodeURIComponent(text);

/**
 * Payments on the project task: order value, what's verified, what's waiting for the office to verify and
 * the balance still to collect — with "Record payment" (saved as pending until an admin confirms it) and
 * "Request on WhatsApp" (a ready-made reminder to the customer for the balance).
 */
export default function PaymentBox({ info, phone, canRecord, onRecord }: {
  info: ProjectExecutionInfo;
  /** Customer's WhatsApp / mobile number for the payment request. */
  phone?: string | null;
  canRecord: boolean;
  onRecord: () => void;
}) {
  const payments = (info.payments || []).filter((p) => p.amount != null);
  const pending = Number(info.collectedPending || 0);
  const confirmed = Number(info.collectedConfirmed || 0);
  const value = has(info.contractValue) ? Number(info.contractValue) : null;
  const balance = has(info.balanceDue) ? Number(info.balanceDue) : null;
  // What to ask for: the balance less anything already handed over and waiting for verification.
  const toAsk = balance != null ? Math.max(0, balance - pending) : null;
  const name = info.customer?.name;
  const requestText = [
    `Hello${has(name) ? ' ' + name : ''},`,
    `This is a payment reminder for your project${has(info.projectName) ? ` "${info.projectName}"` : ''}${has(info.projectCode) ? ` (${info.projectCode})` : ''}.`,
    value != null ? `Order value: ${money(value)}. Received: ${money(confirmed)}.` : null,
    toAsk != null && toAsk > 0 ? `Balance due: ${money(toAsk)}.` : null,
    'Kindly arrange the payment. Thank you!',
  ].filter(Boolean).join('\n');

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
      <div className="p-4">
        <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B6B32]">
          <Wallet className="h-3.5 w-3.5" /> Payments
        </p>

        <div className="grid grid-cols-2 gap-2">
          {value != null && <Stat label="Order value" value={money(value)} tone="text-[#1A211E]" />}
          <Stat label="Received" value={money(confirmed)} tone="text-[#2C7050]" />
          <Stat label="Awaiting check" value={money(pending)} tone="text-[#9B6B32]" icon />
          {balance != null && <Stat label="Balance due" value={money(balance)} tone={balance > 0 ? 'text-[#B94B45]' : 'text-[#2C7050]'} />}
        </div>

        {payments.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-[#F1ECE2] pt-2.5">
            {payments.map((p, i) => {
              const isPending = String(p.status).toUpperCase() === 'PENDING_APPROVAL';
              return (
                <li key={i} className="flex items-center justify-between gap-2 text-[13px] text-[#33392F]">
                  <span className="min-w-0">
                    <span className="font-semibold">{money(p.amount)}</span>
                    <span className="text-[#7A8078]">
                      {has(p.method) ? ` · ${p.method}` : ''}{has(p.collectedBy) ? ` · ${p.collectedBy}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                    isPending ? 'bg-[#FBEFE0] text-[#9B6B32]' : 'bg-[#E7F2EC] text-[#2C7050]'}`}>
                    {isPending ? 'Awaiting check' : 'Verified'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {canRecord && (
            <button onClick={onRecord}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0A573B] py-2.5 text-[13px] font-semibold text-white active:scale-[0.99]">
              <Plus className="h-4 w-4" /> Record payment
            </button>
          )}
          {has(phone) && (
            <a href={waHref(phone as string, requestText)} target="_blank" rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99] ${canRecord ? '' : 'col-span-2'}`}>
              <MessageCircle className="h-4 w-4" /> Request payment
            </a>
          )}
        </div>
        {canRecord && (
          <p className="mt-2 text-[11.5px] text-[#8A8F86]">A recorded payment stays “awaiting check” until the office verifies it.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone: string; icon?: boolean }) {
  return (
    <div className="rounded-xl bg-[#FBFAF6] px-3 py-2 ring-1 ring-[#EFE9DC]">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#A6A99E]">
        {icon && <Clock className="h-2.5 w-2.5" />} {label}
      </p>
      <p className={`text-[15px] font-bold ${tone}`}>{value}</p>
    </div>
  );
}
