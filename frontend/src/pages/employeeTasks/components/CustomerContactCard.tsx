import { MapPin, MessageCircle, Navigation, Phone, User, UserCheck } from 'lucide-react';
import { TaskContact } from '@/types/employeeTask';

const has = (v: unknown) => v != null && String(v).trim() !== '';
const telHref = (s: string) => 'tel:' + s.replace(/[^\d+]/g, '');
const waHref = (s: string) => 'https://wa.me/' + s.replace(/[^\d]/g, '');

/**
 * Who to meet on this task and how to get there — customer name, phone (call / WhatsApp), the site address
 * and city with a Navigate button, and who got the job. Shown on tasks without a lead card (project work,
 * service visits, walk-in installs).
 */
export default function CustomerContactCard({ contact, requirement }: {
  contact: TaskContact;
  /** What the customer asked for, when the task carries it. */
  requirement?: string | null;
}) {
  const phone = contact.phone || contact.alternatePhone || contact.whatsappNumber;
  const wa = contact.whatsappNumber || contact.phone;
  const addr = [contact.address, contact.city && !(contact.address || '').includes(contact.city) ? contact.city : null,
    contact.pincode && !(contact.address || '').includes(contact.pincode) ? contact.pincode : null].filter(has).join(', ');
  const team = [
    has(contact.salesExecutiveName) && `Lead / sales: ${contact.salesExecutiveName}`,
    has(contact.projectManagerName) && `Project manager: ${contact.projectManagerName}`,
  ].filter(Boolean) as string[];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#EDE6D8] bg-white shadow-[0_4px_16px_rgba(80,55,20,0.06)]">
      <div className="h-1 bg-gradient-to-r from-[#BC8748] via-[#BC8748] to-[#0A573B]" />
      <div className="p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B6B32]">
          <User className="h-3.5 w-3.5" /> Customer
        </p>
        <p className="text-[15px] font-bold text-[#1A211E]">{contact.name || 'Customer'}</p>
        {has(contact.city) && <p className="text-[12px] text-[#8A8F86]">{contact.city}</p>}
        {has(phone) && (
          <p className="mt-1 text-[12.5px] text-[#5E655D]">
            {[contact.phone, contact.alternatePhone, contact.whatsappNumber && contact.whatsappNumber !== contact.phone ? `WA ${contact.whatsappNumber}` : null]
              .filter(has).join(' · ')}
          </p>
        )}

        {(has(phone) || has(wa)) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {has(phone) && (
              <a href={telHref(phone as string)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99]">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {has(wa) && (
              <a href={waHref(wa as string)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99]">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
        )}

        {(has(addr) || has(contact.mapUrl)) && (
          <div className="mt-3 rounded-xl bg-[#F6F4EC] p-3">
            <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#A07E38]">
              <MapPin className="h-3.5 w-3.5" /> Site address
            </p>
            {has(addr) && <p className="text-[13.5px] leading-snug text-[#33392F]">{addr}</p>}
            {has(contact.mapUrl) && (
              <a href={contact.mapUrl as string} target="_blank" rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-[#D7DED8] bg-white py-2 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99]">
                <Navigation className="h-4 w-4" /> Navigate to site
              </a>
            )}
          </div>
        )}

        {has(requirement) && (
          <div className="mt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#A6A99E]">What they asked for</p>
            <p className="whitespace-pre-wrap text-[13.5px] leading-snug text-[#33392F]">{requirement}</p>
          </div>
        )}

        {team.length > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-[#5E655D]">
            <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9B6B32]" /> {team.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
