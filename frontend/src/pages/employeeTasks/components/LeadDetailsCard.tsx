import { useState } from 'react';
import { MessageCircle, MoreHorizontal, Navigation, Pencil, Phone } from 'lucide-react';

const has = (v: unknown) => v != null && String(v).trim() !== '';
const list = (v?: string | null) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);
const fmtDate = (s?: string | null) =>
  has(s) ? new Date(s as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const digits = (s?: string | null) => (s || '').replace(/[^\d+]/g, '');

/** Google Maps directions to the saved pin, else a search for the address. */
function navigateHref(lead: any, place: string): string | null {
  const g = lead?.googleMapLocation as string | undefined;
  const m = g?.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (m) return `https://www.google.com/maps/dir/?api=1&destination=${m[1]},${m[2]}`;
  if (g && g.startsWith('http')) return g;
  const addr = [place, lead?.state, lead?.pincode].filter(has).join(', ');
  return addr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr) : null;
}

/**
 * The lead's details card, shared by the Collect Requirement task and the Visit, Measure & Quote page:
 * name · place · phone with Call / WhatsApp / Navigate, who the lead is by, and what the customer asked for
 * (products, or categories, plus rooms and notes). `onEdit` adds the "Edit lead details" button; `more` is revealed by the "…" button.
 */
export default function LeadDetailsCard({ lead, fallbackName, onEdit, more }: {
  lead: any;
  fallbackName?: string | null;
  onEdit?: () => void;
  more?: React.ReactNode;
}) {
  const [showMore, setShowMore] = useState(false);
  const phone = lead?.mobileNumber || lead?.alternateMobile || lead?.whatsappNumber || lead?.phone;
  const wa = lead?.whatsappNumber || phone;
  const place = [lead?.address, lead?.city].filter(has).join(', ');
  // One is enough: the products they asked for, or the categories when no product was named.
  const products = list(lead?.requirementProduct);
  const chips = products.length ? products : list(lead?.requirementCategory);
  const leadBy = lead?.leadOwnerName || lead?.capturedByName || lead?.leadOwner?.name || lead?.createdByName;
  const leadDate = fmtDate(lead?.capturedAt || lead?.createdAt);
  const navHref = navigateHref(lead, place);
  const reqRows = ([
    ['Rooms required', lead?.roomsRequired],
    ['Requirement', lead?.projectDescription],
    ['Customer notes', lead?.customerRequirements],
    ['Special requests', lead?.specialRequests],
  ] as [string, unknown][]).filter(([, v]) => has(v)).map(([l, v]) => [l, String(v)] as [string, string]);
  const roundBtn = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E4E2DC] text-[#0A573B] active:bg-[#F1F3F1]';

  return (
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#111817]">{lead?.name || fallbackName || 'Customer'}</p>
            {(place || phone) && (
              <p className="mt-0.5 truncate text-[12px] text-[#7A817C]">{[place, phone].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {phone && <a href={'tel:' + digits(phone)} className={roundBtn} aria-label={`Call ${lead?.name || 'customer'}`}><Phone className="h-4 w-4" /></a>}
          {wa && (
            <a href={'https://wa.me/' + digits(wa).replace('+', '')} target="_blank" rel="noopener noreferrer" className={roundBtn} aria-label="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          {navHref && (
            <a href={navHref} target="_blank" rel="noopener noreferrer" className={roundBtn} aria-label="Navigate to site">
              <Navigation className="h-4 w-4" />
            </a>
          )}
          {more && (
            <button onClick={() => setShowMore((s) => !s)} aria-label="More lead details"
              className={`${roundBtn} ${showMore ? 'bg-[#EFF5F0]' : ''}`}><MoreHorizontal className="h-4 w-4" /></button>
          )}
        </div>
        {leadBy && (
          <p className="mt-2 text-[12px] text-[#6B726E]">
            Lead by: <span className="font-semibold text-[#33392F]">{leadBy}</span>{leadDate ? ` · ${leadDate}` : ''}
          </p>
        )}
        {(chips.length > 0 || reqRows.length > 0) && (
          <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-[#F7F4EC] p-3">
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#9B6B32] ring-1 ring-[#E4D8BF]">{c}</span>
                ))}
              </div>
            )}
            {reqRows.map(([label, v]) => (
              <div key={label} className="flex flex-col gap-0.5">
                {label !== 'Requirement' && (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#7A817C]">{label}</span>
                )}
                <span className="whitespace-pre-wrap text-[13.5px] text-[#1A211E]">{v}</span>
              </div>
            ))}
          </div>
        )}
        {onEdit && (
          <button onClick={onEdit}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-[#F3F8F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Pencil className="h-4 w-4" /> Edit lead details
          </button>
        )}
        {showMore && more && <div className="mt-3">{more}</div>}
      </div>
  );
}
