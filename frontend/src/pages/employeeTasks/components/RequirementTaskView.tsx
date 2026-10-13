import { useState } from 'react';
import {
  UserRound, Star, Phone, MessageCircle, Mail, MoreHorizontal, MapPin, Navigation, Crosshair, Loader2,
  Pencil,
} from 'lucide-react';
import { employeeTaskApi } from '@/api/employeeTaskApi';
import { getBestPosition, locationErrorMessage, reverseGeocode } from '@/lib/geo';
import { LeadInfo, TaskDetail } from '@/types/employeeTask';
import { humanizeDue, priorityMeta } from '../taskUtils';

/**
 * Collect Requirement task page body — one card per question the field employee has:
 * who is the customer (and how to reach them), where is the site, what do they want,
 * budget & timeline, site photos, and the remarks so far. "Edit" opens the requirement form at that part.
 * The site card saves the employee's live GPS position as the lead's map pin (and fills a blank address
 * from it). While the task is still open to pick, the buttons show but ask the employee to take it first.
 */

const has = (v: unknown) => v != null && String(v).trim() !== '';
const list = (v?: string | null) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);
const money = (v: unknown) => (has(v) ? '₹' + Number(v).toLocaleString('en-IN') : null);
const fmtDate = (s?: string | null) =>
  has(s) ? new Date(s as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const digits = (s?: string | null) => (s || '').replace(/[^\d+]/g, '');

/** "…?q=11.7,79.7" / "…@11.7,79.7" / "11.7, 79.7" → coordinates, when the saved pin carries them. */
function parseCoords(s?: string | null): { lat: number; lng: number } | null {
  if (!s) return null;
  const m = s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** A small street map around the pin, stitched from 3×3 OpenStreetMap tiles (no API key needed). */
function MapThumb({ lat, lng }: { lat: number; lng: number }) {
  const z = 15; const n = 2 ** z; const rad = (lat * Math.PI) / 180;
  const fx = ((lng + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const tx = Math.floor(fx); const ty = Math.floor(fy);
  const px = 256 + (fx - tx) * 256; const py = 256 + (fy - ty) * 256;
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E8ECE6]">
      <div className="absolute" style={{ width: 768, height: 768, left: `calc(50% - ${px}px)`, top: `calc(50% - ${py}px)` }}>
        {[-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => (
          <img key={`${dx}${dy}`} alt="" draggable={false} loading="lazy"
            src={`https://tile.openstreetmap.org/${z}/${tx + dx}/${ty + dy}.png`}
            className="absolute h-64 w-64 max-w-none" style={{ left: (dx + 1) * 256, top: (dy + 1) * 256 }} />
        )))}
      </div>
      <MapPin className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-full fill-[#E5322D] text-white drop-shadow" />
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[7px] text-[#555]">© OpenStreetMap</span>
    </div>
  );
}

export default function RequirementTaskView({ task, lead, canEdit, takeFirst, onEdit, onReload, more }: {
  task: TaskDetail;
  lead: LeadInfo;
  /** The employee holds the task and it isn't locked — Edit, location and photo buttons work. */
  canEdit: boolean;
  /** The task is open to pick — the same buttons show, but ask the employee to take the task first. */
  takeFirst?: boolean;
  /** Opens the requirement form at a section: 'requirement' | 'budget' | 'address' … */
  onEdit: (section: string) => void;
  onReload: () => void;
  /** Everything else about the lead (property, source, media) — revealed by the "…" button. */
  more?: React.ReactNode;
}) {
  const [showMore, setShowMore] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState('');
  const [hint, setHint] = useState('');
  const showActions = canEdit || !!takeFirst;
  // Runs the action once the task is the employee's; before that, explains what to do.
  const guard = (fn: () => void) => () => {
    if (canEdit) { setHint(''); fn(); } else setHint('Tap “Take this task” below first, then you can edit the lead, set the location and add photos in Task notes.');
  };
  const edit = (section: string) => guard(() => onEdit(section));

  const prio = priorityMeta(task.priority);
  const due = humanizeDue(task.dueDate, task.status);
  const rating = Number(lead.rating) || 0;
  const phone = lead.mobileNumber || lead.alternateMobile || lead.whatsappNumber;
  const wa = lead.whatsappNumber || lead.mobileNumber;
  const leadBy = lead.leadOwnerName || lead.capturedByName;

  const line1 = [lead.address, lead.landmark, lead.city].filter(has).join(', ');
  const line2 = [lead.district, lead.state, lead.pincode].filter(has).join(', ');
  const coords = parseCoords(lead.googleMapLocation);
  const fullAddr = [line1, line2].filter(Boolean).join(', ');
  const navHref = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : has(lead.googleMapLocation) && String(lead.googleMapLocation).startsWith('http')
      ? String(lead.googleMapLocation)
      : fullAddr ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(fullAddr) : null;

  const categories = list(lead.requirementCategory);
  const products = list(lead.requirementProduct);
  const reqRows = ([
    ['Rooms required', lead.roomsRequired],
    ['Requirement', lead.projectDescription],
    ['Customer notes', lead.customerRequirements],
    ['Special requests', lead.specialRequests],
  ] as [string, unknown][]).filter(([, v]) => has(v)).map(([l, v]) => [l, String(v)] as [string, string]);
  const budget = money(lead.estimatedBudget)
    || (has(lead.minimumBudget) || has(lead.maximumBudget)
      ? [money(lead.minimumBudget), money(lead.maximumBudget)].filter(Boolean).join(' – ') : null);
  const expected = fmtDate(lead.expectedStartDate) || fmtDate(lead.preferredCompletionDate);

  // GPS pin + the street address for that spot (fills only the lead's blank address fields).
  const useMyLocation = async () => {
    setLocErr('');
    setLocating(true);
    try {
      const fix = await getBestPosition({ targetAccuracyM: 25, maxWaitMs: 15000 });
      if (!fix) { setLocErr(await locationErrorMessage()); return; }
      const addr = await reverseGeocode(fix.lat, fix.lng);
      await employeeTaskApi.saveSiteLocation(task.id, { latitude: fix.lat, longitude: fix.lng, ...addr });
      onReload();
    } catch (e: any) {
      setLocErr(e?.response?.data?.message || 'Could not save the location.');
    } finally {
      setLocating(false);
    }
  };

  const btn = '[&>svg]:shrink-0 flex min-w-0 items-center justify-center gap-1 rounded-xl border border-[#DDE2DE] bg-white px-1 py-2.5 text-[12.5px] font-semibold text-[#0A573B] active:scale-[0.98]';

  return (
    <div className="flex flex-col gap-3">
      {/* Who — lead header with quick contact */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FBEFE0] text-[#9B6B32]">
            <UserRound className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[18px] font-bold text-[#1A211E]">{lead.name || task.customer || 'Customer'}</p>
              {rating > 0 && (
                <span className="flex shrink-0 text-[#D4A017]">
                  {Array.from({ length: rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
                </span>
              )}
            </div>
            {lead.leadNumber && <p className="text-[12.5px] text-[#7A817C]">{lead.leadNumber}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {prio.urgent && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#FDEBEA] px-2.5 py-1 text-[11px] font-semibold text-[#C9302C]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D64541]" /> {prio.label} priority
              </span>
            )}
            <span className={`text-[12px] font-semibold ${due.tone === 'overdue' ? 'text-[#C9302C]' : due.tone === 'soon' ? 'text-[#B27A12]' : 'text-[#6B726E]'}`}>
              {due.text}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          {phone ? <a href={'tel:' + digits(phone)} className={btn}><Phone className="h-4 w-4" /> Call</a>
            : <span className={`${btn} opacity-40`}><Phone className="h-4 w-4" /> Call</span>}
          {wa ? <a href={'https://wa.me/' + digits(wa).replace('+', '')} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            : <span className={`${btn} opacity-40`}><MessageCircle className="h-4 w-4" /> WhatsApp</span>}
          {lead.email ? <a href={'mailto:' + lead.email} className={btn}><Mail className="h-4 w-4" /> Email</a>
            : <span className={`${btn} opacity-40`}><Mail className="h-4 w-4" /> Email</span>}
          <button onClick={() => setShowMore((s) => !s)} aria-label="More lead details"
            className={`${btn} px-3 ${showMore ? 'bg-[#EFF5F0]' : ''}`}><MoreHorizontal className="h-4 w-4" /></button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[#6B726E]">
          <span className="truncate">{phone}</span>
          {leadBy && <span className="truncate text-right">Lead by: {leadBy}{fmtDate(lead.capturedAt) ? ` · ${fmtDate(lead.capturedAt)}` : ''}</span>}
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-[#EEEDE9] rounded-xl border border-[#EEEDE9] text-center">
          {[['Budget', budget], ['Expected', expected], ['Timeline', lead.estimatedDuration || null]].map(([label, v]) => (
            <div key={label as string} className="min-w-0 px-1.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A817C]">{label}</p>
              <p className={`truncate text-[13px] ${v ? 'font-bold text-[#1A211E]' : 'text-[#9A9E96]'}`}>{v || '—'}</p>
            </div>
          ))}
        </div>
        {(categories.length > 0 || products.length > 0 || reqRows.length > 0) && (
          <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-[#F7F4EC] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#9B6B32]">Requirement</p>
            {categories.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#7A817C]">Categories</span>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#0A573B] ring-1 ring-[#D7E4DB]">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {products.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#7A817C]">Products</span>
                <div className="flex flex-wrap gap-1.5">
                  {products.map((p) => (
                    <span key={p} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-[#9B6B32] ring-1 ring-[#E4D8BF]">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {reqRows.map(([label, v]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[#7A817C]">{label}</span>
                <span className="whitespace-pre-wrap text-[13.5px] text-[#1A211E]">{v}</span>
              </div>
            ))}
          </div>
        )}
        {showActions && (
          <button onClick={edit('summary')}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-[#F3F8F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Pencil className="h-4 w-4" /> Edit lead details
          </button>
        )}
        {showMore && more && <div className="mt-3">{more}</div>}
      </div>
      {hint && <p className="-mt-1 rounded-lg bg-[#FDF3E2] px-3 py-2 text-[12.5px] text-[#8A5A1E]">{hint}</p>}

      {/* Where — site location, navigate, and save my live location */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-2 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex gap-2 rounded-xl bg-[#EEF5F0] p-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D9EBDF] text-[#0A573B]">
                <MapPin className="h-4 w-4 fill-current text-[#0A573B]" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="flex-1 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-[#0A573B]">Site location</p>
                  {showActions && (
                    <button onClick={edit('address')} aria-label="Edit address"
                      className="flex items-center gap-1 rounded-lg border border-[#DDE2DE] bg-white px-2 py-1 text-[11.5px] font-semibold text-[#0A573B] active:scale-95">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  )}
                </div>
                {line1 && <p className="truncate text-[14px] font-semibold text-[#1A211E]">{line1}</p>}
                {line2 && <p className="truncate text-[12.5px] text-[#5B625E]">{line2}</p>}
                {!line1 && !line2 && <p className="text-[12.5px] text-[#7A817C]">{coords ? 'Pinned on map' : 'No address yet'}</p>}
              </div>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {navHref && (
                <a href={navHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#0A573B] px-3 py-2.5 text-[13px] font-semibold text-white active:scale-[0.98]">
                  <Navigation className="h-4 w-4" /> Navigate to site
                </a>
              )}
              {showActions && (
                <button onClick={guard(useMyLocation)} disabled={locating}
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-white px-3 py-2 text-[12.5px] font-semibold text-[#0A573B] active:scale-[0.98] disabled:opacity-60">
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                  {locating ? 'Getting GPS location…' : coords ? 'Re-pin by GPS' : 'Set location by GPS'}
                </button>
              )}
            </div>
          </div>
          <div className="w-[38%] shrink-0 overflow-hidden rounded-xl ring-1 ring-[#D9E4DC]">
            {coords ? (
              <a href={navHref ?? undefined} target="_blank" rel="noopener noreferrer" className="block h-full min-h-[110px]">
                <MapThumb lat={coords.lat} lng={coords.lng} />
              </a>
            ) : (
              <div className="flex h-full min-h-[110px] flex-col items-center justify-center gap-1 bg-[#F4F6F3] px-2 text-center text-[10.5px] text-[#8A918C]">
                <MapPin className="h-5 w-5 text-[#B9C0BB]" /> No map pin yet
              </div>
            )}
          </div>
        </div>
        {locErr && <p className="mt-1.5 rounded-lg bg-[#FBE7E4] px-2.5 py-2 text-[12px] text-[#B94B45]">{locErr}</p>}
      </div>


      <p className="px-1 text-[12px] leading-snug text-[#6B726E]">
        Submit when done — the <b>Site Visit, Measure &amp; Quote</b> task opens for you and this one leaves your To-Do.
      </p>
    </div>
  );
}
