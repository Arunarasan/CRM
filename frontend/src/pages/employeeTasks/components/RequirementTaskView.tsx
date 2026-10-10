import { useState } from 'react';
import {
  UserRound, Star, Phone, MessageCircle, Mail, MoreHorizontal, MapPin, Navigation, Crosshair, Loader2,
  ClipboardList, Layers, Box, Pencil, Wallet, IndianRupee, CalendarDays, Hourglass, MessageSquare, ListChecks,
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

function Card({ icon, iconCls, title, onEdit, children, tone }: {
  icon: React.ReactNode; iconCls: string; title: string; onEdit?: () => void; children: React.ReactNode; tone?: 'warm';
}) {
  return (
    <div className={`rounded-2xl border p-3 shadow-[0_2px_10px_rgba(0,35,22,0.04)] ${tone === 'warm' ? 'border-[#F0E3C8] bg-[#FDF8EE]' : 'border-[#ECEAE5] bg-white'}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>{icon}</span>
        <h3 className={`flex-1 text-[13px] font-bold uppercase tracking-wide ${tone === 'warm' ? 'text-[#9B6B32]' : 'text-[#1A211E]'}`}>{title}</h3>
        {onEdit && (
          <button onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-[#DDE2DE] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0A573B] active:scale-95">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#EEEDE9] px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#7A817C]">
        <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> <span className="truncate">{label}</span>
      </p>
      <p className={`mt-0.5 break-words text-[13.5px] leading-snug ${value ? 'font-bold text-[#1A211E]' : 'text-[#9A9E96]'}`}>{value || 'Not specified'}</p>
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

  const pct = Math.max(0, Math.min(100, Number(lead.requirementPercent) || 0));
  const categories = list(lead.requirementCategory);
  const products = list(lead.requirementProduct);
  const budget = money(lead.estimatedBudget)
    || (has(lead.minimumBudget) || has(lead.maximumBudget)
      ? [money(lead.minimumBudget), money(lead.maximumBudget)].filter(Boolean).join(' – ') : null);
  const expected = fmtDate(lead.expectedStartDate) || fmtDate(lead.preferredCompletionDate);
  const remarks = lead.remarks || lead.customerRequirements || lead.projectDescription;

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
        {showActions && (
          <button onClick={edit('summary')}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0A573B]/30 bg-[#F3F8F5] px-3 py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.98]">
            <Pencil className="h-4 w-4" /> Edit lead details
          </button>
        )}
        {showMore && more && <div className="mt-3">{more}</div>}
      </div>
      {hint && <p className="-mt-1 rounded-lg bg-[#FDF3E2] px-3 py-2 text-[12.5px] text-[#8A5A1E]">{hint}</p>}

      {/* How much is collected + quick links to each part of the requirement form */}
      <div className="rounded-2xl border border-[#ECEAE5] bg-white p-3.5 shadow-[0_2px_10px_rgba(0,35,22,0.04)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#1A211E]">Requirement collected</h3>
          <span className="text-[15px] font-bold text-[#0A573B]">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EFEBE0]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0A573B] to-[#0F6E56]" style={{ width: `${pct}%` }} />
        </div>
        {showActions && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button onClick={edit('requirement')} className={btn}><Layers className="h-4 w-4" /> What they want</button>
            <button onClick={edit('address')} className={btn}><MapPin className="h-4 w-4" /> Site address</button>
            <button onClick={edit('budget')} className={btn}><Wallet className="h-4 w-4" /> Budget &amp; dates</button>
            {navHref ? <a href={navHref} target="_blank" rel="noopener noreferrer" className={btn}><Navigation className="h-4 w-4" /> Navigate</a>
              : <span className={`${btn} opacity-40`}><Navigation className="h-4 w-4" /> Navigate</span>}
          </div>
        )}
        <p className="mt-2.5 text-[12px] leading-snug text-[#6B726E]">
          Submit when done — the <b>Site Visit, Measure &amp; Quote</b> task opens for you and this one leaves your To-Do.
        </p>
      </div>

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


      {/* What — categories and products */}
      <Card icon={<ClipboardList className="h-4 w-4" />} iconCls="bg-[#E7F2EC] text-[#0A573B]" title="Customer requirement"
        onEdit={showActions ? edit('requirement') : undefined}>
        <div className="grid grid-cols-2 divide-x divide-[#EEEDE9] rounded-xl border border-[#EEEDE9]">
          <div className="flex min-w-0 gap-2 p-2.5">
            <Layers className="mt-0.5 h-4 w-4 shrink-0 text-[#33392F]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A817C]">Categories</p>
              <p className={`text-[14px] ${categories.length ? 'font-bold text-[#1A211E]' : 'text-[#9A9E96]'}`}>
                {categories.length ? categories.join(', ') : 'Not specified'}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 gap-2 p-2.5">
            <Box className="mt-0.5 h-4 w-4 shrink-0 text-[#33392F]" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#7A817C]">Products asked</p>
              {products.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {products.map((p) => (
                    <span key={p} className="rounded-full border border-[#EAD7B5] bg-[#FDF6EA] px-2 py-0.5 text-[11.5px] font-medium text-[#9B6B32]">{p}</span>
                  ))}
                </div>
              ) : <p className="text-[14px] text-[#9A9E96]">Not specified</p>}
            </div>
          </div>
        </div>
      </Card>

      {/* Budget & timeline */}
      <Card icon={<Wallet className="h-4 w-4" />} iconCls="bg-[#FBEFE0] text-[#9B6B32]" title="Budget & timeline"
        onEdit={showActions ? edit('budget') : undefined}>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat icon={<IndianRupee className="h-4 w-4 text-[#9B6B32]" />} label="Budget" value={budget} />
          <Stat icon={<CalendarDays className="h-4 w-4" />} label="Expected" value={expected} />
          <Stat icon={<Hourglass className="h-4 w-4" />} label="Timeline" value={lead.estimatedDuration || null} />
        </div>
      </Card>

      {/* Remarks */}
      <Card icon={<MessageSquare className="h-4 w-4" />} iconCls="bg-[#FBEFE0] text-[#9B6B32]" title="Remarks"
        onEdit={showActions ? edit('requirement') : undefined}>
        <p className={`whitespace-pre-wrap rounded-xl border border-[#EEEDE9] bg-[#F7F8F6] px-3 py-2.5 text-[13px] ${remarks ? 'text-[#33392F]' : 'text-[#8A918C]'}`}>
          {remarks || 'No remarks yet. Add customer notes, discussion points, requirements, etc.'}
        </p>
      </Card>

      {/* What to do */}
      {task.description && (
        <Card icon={<ListChecks className="h-4 w-4" />} iconCls="bg-[#C58A1B] text-white" title="What to do" tone="warm">
          <p className="text-[13.5px] leading-relaxed text-[#33392F]">{task.description}</p>
        </Card>
      )}
    </div>
  );
}
