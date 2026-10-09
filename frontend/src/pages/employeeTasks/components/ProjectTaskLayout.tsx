import { useState } from 'react';
import {
  Building2, CalendarDays, ChevronDown, ChevronRight, Home, Layers, Mail, MapPin, MessageCircle,
  Navigation, Package, Phone, Ruler, User, UserCheck,
} from 'lucide-react';
import { ProjectExecutionInfo, TaskDetail } from '@/types/employeeTask';
import { resolveFileUrl } from '@/lib/uploadFile';
import { dueToneClass, humanizeDue, priorityMeta } from '../taskUtils';

/**
 * The shared project task (Execution & Installation) laid out as one calm screen: a hero with the project,
 * customer and quick contact actions, side-by-side customer / project cards, the numbered items to make
 * with photos, and slots for payments + work items. Read-only — actions stay in TaskDetail.
 */

const has = (v: unknown) => v != null && String(v).trim() !== '';
const telHref = (s: string) => 'tel:' + s.replace(/[^\d+]/g, '');
const waHref = (s: string) => 'https://wa.me/' + s.replace(/[^\d]/g, '');
const mapsSearch = (q: string) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const cardCls = 'overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]';

/** Small uppercase section heading with a tinted icon tile, plus an optional right-side slot. */
export function SectionHead({ icon, title, tone = 'gold', right, tight = false }: {
  icon: React.ReactNode; title: string; tone?: 'gold' | 'green' | 'brown'; right?: React.ReactNode;
  /** Half-width card: drop the icon tile on narrow phones so the title + link fit. */
  tight?: boolean;
}) {
  const tile = tone === 'green' ? 'bg-[#EAF3EE] text-[#0A573B]'
    : tone === 'brown' ? 'bg-[#9B6B32] text-white' : 'bg-[#FBF1E1] text-[#B07A2E]';
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className={`${tight ? 'hidden min-[440px]:flex' : 'flex'} h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tile}`}>{icon}</span>
      <p className={`min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-wide ${tone === 'green' ? 'text-[#1F4D38]' : 'text-[#9B6B32]'}`}>{title}</p>
      {right}
    </div>
  );
}

/** "Open ›" / "View ›" text toggle used in the card headers. */
export function HeadLink({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold text-[#0A573B] underline-offset-2 hover:underline">
      {open ? 'Hide' : label}
      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
  );
}

function contactOf(task: TaskDetail) {
  const c = task.contact;
  const pc = task.projectInfo?.customer;
  const phone = c?.phone || c?.alternatePhone || pc?.phone || null;
  const wa = c?.whatsappNumber || phone;
  const email = c?.email || pc?.email || null;
  const address = [c?.address, c?.city && !(c?.address || '').includes(c.city) ? c.city : null,
    c?.pincode && !(c?.address || '').includes(c.pincode) ? c.pincode : null].filter(has).join(', ');
  const city = c?.city || pc?.city || task.location || null;
  const mapUrl = task.mapUrl || c?.mapUrl || (has(address) ? mapsSearch(address) : has(city) ? mapsSearch(city as string) : null);
  return { name: c?.name || pc?.name || task.customer, phone, wa, email, address, city, mapUrl };
}

/* ------------------------------------------------------------------ Hero */

export function ProjectTaskHero({ task }: { task: TaskDetail }) {
  const info = task.projectInfo;
  const prio = priorityMeta(task.priority);
  const due = humanizeDue(task.dueDate, task.status);
  const ct = contactOf(task);
  const title = info?.projectName || task.project?.name || task.taskName;
  const place = [task.floor, task.room, task.itemName].filter(Boolean).join(' · ');
  const where = [place, ct.city].filter(has).join(' · ');

  const actions = [
    ct.phone && { label: 'Call', icon: Phone, href: telHref(ct.phone) },
    ct.wa && { label: 'WhatsApp', icon: MessageCircle, href: waHref(ct.wa), ext: true },
    ct.email && { label: 'Email', icon: Mail, href: 'mailto:' + ct.email },
    ct.mapUrl && { label: 'Navigate', icon: Navigation, href: ct.mapUrl, ext: true },
  ].filter(Boolean) as { label: string; icon: typeof Phone; href: string; ext?: boolean }[];

  return (
    <div className={cardCls}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FBF1E1] text-[#B07A2E]">
            <Home className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold leading-snug text-[#1A211E]">{title}</h2>
            {has(ct.name) && <p className="truncate text-[13.5px] text-[#5E655D]">{ct.name}</p>}
            {has(where) && (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#6B7169]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#B07A2E]" /> <span className="truncate">{where}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
              prio.urgent ? 'bg-[#FDEDEB] text-[#B94B45]' : 'bg-[#FBF6EC] text-[#6B7169]'}`}>
              <span className={`h-2 w-2 rounded-full ${prio.dot}`} /> {prio.label} priority
            </span>
            <span className={`text-[12px] font-semibold ${dueToneClass(due.tone)}`}>{due.text}</span>
          </div>
        </div>

        {actions.length > 0 && (
          <div className="mt-3.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
            {actions.map((a) => (
              <a key={a.label} href={a.href} {...(a.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#D7DED8] bg-white px-1 py-2 text-[12px] font-semibold text-[#0A573B] active:scale-[0.98] min-[460px]:flex-row min-[460px]:gap-1.5 min-[460px]:py-2.5 min-[460px]:text-[13px]">
                <a.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{a.label}</span>
              </a>
            ))}
          </div>
        )}

        {task.description && (
          <div className="mt-3.5 flex gap-3 rounded-xl bg-[#F8F4EC] p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#B07A2E] text-white">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#9B6B32]">What to do</p>
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-[#33392F]">{task.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Customer + Project cards */

export function ProjectInfoCards({ task }: { task: TaskDetail }) {
  const info = task.projectInfo;
  const ct = contactOf(task);
  const c = task.contact;
  const [custOpen, setCustOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  if (!info) return null;

  const pct = Math.max(0, Math.min(100, Number(info.progress ?? 0)));
  const materials = (info.materials || []).filter((m) => has(m.product));
  const measurements = (info.measurements || []).filter((m) => has(m.room) || m.length || m.width);
  const custExtra = has(c?.alternatePhone) || has(ct.address) || has(c?.salesExecutiveName) || has(c?.projectManagerName);
  const projExtra = materials.length > 0 || measurements.length > 0;

  return (
    <div className="grid grid-cols-1 gap-3.5 min-[380px]:grid-cols-2">
      <div className={`${cardCls} p-3.5`}>
        <SectionHead icon={<User className="h-4 w-4" />} title="Customer" tight
          right={custExtra ? <HeadLink label="Open" open={custOpen} onClick={() => setCustOpen((o) => !o)} /> : undefined} />
        <p className="truncate text-[14.5px] font-bold text-[#1A211E]">{ct.name || 'Customer'}</p>
        <ul className="mt-2 flex flex-col gap-1.5 border-l-2 border-[#EFE9DC] pl-2.5 text-[12.5px] text-[#33392F]">
          {has(ct.phone) && (
            <li><a href={telHref(ct.phone as string)} className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-[#0A573B]" /><span className="truncate">{ct.phone}</span></a></li>
          )}
          {has(ct.email) && (
            <li><a href={'mailto:' + ct.email} className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0 text-[#0A573B]" /><span className="truncate">{ct.email}</span></a></li>
          )}
          {has(ct.city) && (
            <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#0A573B]" /><span className="truncate">{ct.city}</span></li>
          )}
        </ul>
        {custOpen && (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-[#F1ECE2] pt-2.5 text-[12.5px] text-[#33392F]">
            {has(c?.alternatePhone) && <p><span className="text-[#8A8F86]">Alt. phone: </span>{c!.alternatePhone}</p>}
            {has(ct.address) && <p><span className="text-[#8A8F86]">Address: </span>{ct.address}</p>}
            {(has(c?.salesExecutiveName) || has(c?.projectManagerName)) && (
              <p className="flex items-start gap-1.5"><UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9B6B32]" />
                {[has(c?.salesExecutiveName) && `Sales: ${c!.salesExecutiveName}`, has(c?.projectManagerName) && `PM: ${c!.projectManagerName}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      <div className={`${cardCls} p-3.5`}>
        <SectionHead icon={<Building2 className="h-4 w-4" />} title="Project" tight
          right={projExtra ? <HeadLink label="Open" open={projOpen} onClick={() => setProjOpen((o) => !o)} /> : undefined} />
        <p className="truncate text-[14.5px] font-bold text-[#1A211E]">{info.projectName || 'Project'}</p>
        <p className="truncate text-[11.5px] uppercase tracking-wide text-[#8A8F86]">{[info.projectCode, info.status].filter(has).join(' · ')}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EFEBE0]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#0A573B] to-[#2C7050]" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[12.5px] font-bold text-[#1A211E]">{pct}%</span>
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {[['Start', info.startDate], ['Target', info.endDate]].map(([label, d]) => (
            <div key={label} className="flex min-w-0 items-center gap-1.5 text-[12px]">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#5E655D]" />
              <span className="text-[#8A8F86]">{label}</span>
              <span className="ml-auto truncate font-medium text-[#33392F]">{fmtDate(d)}</span>
            </div>
          ))}
        </div>
        {projOpen && (
          <div className="mt-3 flex flex-col gap-3 border-t border-[#F1ECE2] pt-2.5">
            {materials.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]"><Package className="h-3.5 w-3.5" /> Materials</p>
                <ul className="flex flex-col gap-1">
                  {materials.map((m, i) => (
                    <li key={i} className="flex justify-between gap-2 text-[12.5px] text-[#33392F]">
                      <span className="min-w-0 truncate">{m.product}</span>
                      <span className="shrink-0 text-[#5E655D]">{[m.quantity, m.unit].filter(has).join(' ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {measurements.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]"><Ruler className="h-3.5 w-3.5" /> Site measurements</p>
                <ul className="flex flex-col gap-1">
                  {measurements.map((m, i) => {
                    const dims = [m.length, m.width, m.height].filter((n) => n != null && n !== 0);
                    return (
                      <li key={i} className="text-[12.5px] text-[#33392F]">
                        <span className="font-medium">{[m.floor, m.room, m.roomType].filter(has).join(' · ') || 'Room'}</span>
                        {dims.length > 0 && <span className="text-[#5E655D]"> — {dims.join(' × ')}{m.floorArea ? ` (${m.floorArea} sq.ft)` : ''}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Items to make */

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Not started', ASSIGNED: 'Assigned', MATERIAL_READY: 'Material ready', STARTED: 'Started',
  IN_PROGRESS: 'In progress', INSPECTION: 'Inspection', COMPLETED: 'Completed', ON_HOLD: 'On hold',
  REWORK: 'Rework', CANCELLED: 'Cancelled',
};

export function ItemsToMakeCard({ info }: { info: ProjectExecutionInfo }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const items = (info.rooms || []).flatMap((r) => (r.items || []).map((it) => ({
    ...it, where: [r.floor, r.room || r.roomType].filter(has).join(' · '),
  })));
  if (items.length === 0) return null;

  return (
    <div className={`${cardCls} p-3.5`}>
      <SectionHead icon={<Layers className="h-4 w-4" />} title="Items to make" tone="green"
        right={<span className="shrink-0 text-[12px] text-[#6B7169]">Total: {items.length} item{items.length === 1 ? '' : 's'}</span>} />
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => {
          const open = openIdx === i;
          const qty = [it.quantity != null ? Number(it.quantity).toString() : null, it.unit].filter(has).join(' ');
          return (
            <li key={i} className="rounded-xl border border-[#EFE9DC] bg-white">
              <button onClick={() => setOpenIdx(open ? null : i)} className="flex w-full items-center gap-2.5 p-2 text-left">
                <span className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border min-[400px]:flex border-[#E2DCCD] text-[11.5px] font-semibold text-[#5E655D]">{i + 1}</span>
                {it.imageUrl ? (
                  <img src={resolveFileUrl(it.imageUrl)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg min-[400px]:h-14 min-[400px]:w-14 object-cover" />
                ) : (
                  <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-lg bg-[#F3EFE6] text-[#B4A88E]">
                    <Package className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#1A211E]">{it.where || it.name || 'Item'}</span>
                  <span className={`text-[12.5px] leading-snug text-[#6B7169] ${open ? 'block' : 'line-clamp-2'}`}>
                    {it.where ? it.name : null}{has(it.description) ? `${it.where ? ' — ' : ''}${it.description}` : ''}
                  </span>
                </span>
                {has(qty) && <span className="shrink-0 rounded-full bg-[#EAF3EE] px-2.5 py-1 text-[11.5px] font-semibold text-[#0A573B]">{qty}</span>}
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#9A9E96] transition-transform ${open ? 'rotate-180' : '-rotate-90'}`} />
              </button>
              {open && (
                <div className="flex items-center gap-2 border-t border-[#F1ECE2] px-3 py-2 text-[12px] text-[#5E655D]">
                  <span className="rounded-full bg-[#F3EEE2] px-2 py-0.5 font-medium text-[#8A6A2E]">{STATUS_LABEL[it.status || ''] || it.status || 'Not started'}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EFEBE0]">
                    <div className="h-full rounded-full bg-[#0A573B]" style={{ width: `${Math.max(0, Math.min(100, Number(it.progress ?? 0)))}%` }} />
                  </div>
                  <span className="font-semibold text-[#1A211E]">{it.progress ?? 0}%</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
