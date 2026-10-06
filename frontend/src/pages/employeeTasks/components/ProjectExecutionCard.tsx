import { Building2, User, Package, Ruler, Layers, Phone, MessageCircle } from 'lucide-react';
import { ProjectExecutionInfo } from '@/types/employeeTask';

/**
 * The project picture shown on the shared "Execution & Installation" task — customer, the BOQ items with
 * their sizes and locations, the planned materials, and the site measurements — so the whole team
 * has everything in one place. Read-only; empty groups are hidden.
 */

const has = (v: unknown) => v != null && String(v).trim() !== '';
const telHref = (s?: string | null) => 'tel:' + (s || '').replace(/[^\d+]/g, '');
const waHref = (s?: string | null) => 'https://wa.me/' + (s || '').replace(/[^\d]/g, '');
const num = (v: unknown) => (v == null || v === '' ? null : Number(v));

export default function ProjectExecutionCard({ info }: { info: ProjectExecutionInfo }) {
  const c = info.customer;
  const rooms = (info.rooms || []).filter((r) => (r.items || []).length > 0);
  const materials = (info.materials || []).filter((m) => has(m.product));
  const measurements = (info.measurements || []).filter((m) => has(m.room) || m.length || m.width);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
      <div className="h-1 bg-gradient-to-r from-[#0A573B] via-[#0A573B] to-[#BC8748]" />
      <div className="p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B6B32]">
          <Building2 className="h-3.5 w-3.5" /> Project details
        </p>
        <p className="truncate text-[15px] font-bold text-[#1A211E]">{info.projectName || 'Project'}</p>
        <p className="text-[11.5px] text-[#8A8F86]">
          {[info.projectCode, info.status].filter(has).join(' · ') || 'Execution'}
        </p>

        {/* Customer */}
        {c && (has(c.name) || has(c.phone) || has(c.email)) && (
          <div className="mt-3 rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
              <User className="h-3.5 w-3.5" /> Customer
            </p>
            {has(c.name) && <p className="text-[13.5px] font-medium text-[#33392F]">{c.name}{has(c.city) ? ` · ${c.city}` : ''}</p>}
            {(has(c.phone) || has(c.email)) && (
              <p className="mt-0.5 text-[12.5px] text-[#5E655D]">{[c.phone, c.email].filter(has).join(' · ')}</p>
            )}
            {has(c.phone) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a href={telHref(c.phone)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2 text-[12.5px] font-semibold text-[#0A573B] active:scale-[0.99]">
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
                <a href={waHref(c.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2 text-[12.5px] font-semibold text-[#0A573B] active:scale-[0.99]">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
            )}
          </div>
        )}

        {/* Items with sizes & locations, grouped by room */}
        {rooms.length > 0 && (
          <div className="mt-3 rounded-xl bg-[#F0F5F1] p-3.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#2C7050]">
              <Layers className="h-3.5 w-3.5" /> Items to make
            </p>
            <div className="flex flex-col gap-2.5">
              {rooms.map((r, ri) => (
                <div key={ri}>
                  <p className="text-[12px] font-semibold text-[#33392F]">
                    {[r.floor, r.room, r.roomType].filter(has).join(' · ') || 'Items'}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(r.items || []).map((it, ii) => (
                      <li key={ii} className="flex items-start justify-between gap-2 text-[13px] text-[#33392F]">
                        <span className="min-w-0">
                          <span className="font-medium">{it.name || 'Item'}</span>
                          {has(it.description) && <span className="text-[#7A8078]"> — {it.description}</span>}
                        </span>
                        {(has(it.quantity) || has(it.unit)) && (
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-medium text-[#2C7050] ring-1 ring-[#CFE3D6]">
                            {[it.quantity, it.unit].filter(has).join(' ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Materials */}
        {materials.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
              <Package className="h-3.5 w-3.5" /> Materials
            </p>
            <ul className="flex flex-col gap-1">
              {materials.map((m, mi) => (
                <li key={mi} className="flex items-center justify-between gap-2 text-[13px] text-[#33392F]">
                  <span className="min-w-0 truncate font-medium">{m.product}</span>
                  {(has(m.quantity) || has(m.unit)) && (
                    <span className="shrink-0 text-[12px] text-[#5E655D]">{[m.quantity, m.unit].filter(has).join(' ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Measurements */}
        {measurements.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#EFE9DC] bg-[#FBFAF6] p-3.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9B6B32]">
              <Ruler className="h-3.5 w-3.5" /> Site measurements
            </p>
            <ul className="flex flex-col gap-1.5">
              {measurements.map((m, xi) => {
                const dims = [num(m.length), num(m.width), num(m.height)].filter((n) => n != null);
                return (
                  <li key={xi} className="text-[13px] text-[#33392F]">
                    <span className="font-medium">{[m.floor, m.room, m.roomType].filter(has).join(' · ') || 'Room'}</span>
                    {dims.length > 0 && <span className="text-[#5E655D]"> — {dims.join(' × ')}{m.floorArea ? ` (${m.floorArea} sq.ft)` : ''}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}
