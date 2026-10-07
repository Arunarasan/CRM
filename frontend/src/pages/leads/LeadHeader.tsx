import { Fragment } from "react";
import {
  Phone, MessageCircle, Mail, UserCheck, MapPin, Navigation, Tag, Package, CheckCircle2, ArrowRight,
} from "lucide-react";
import { waLink } from "@/pages/projectCommandCenter/ProjectJourneyHeader";
import { type Lead } from "./constants";
import { EnquiryTag, enquiryDetails, enquiryTypeOf } from "./enquiry";
import type { JourneyStepId, LeadJourney } from "./journey";

// The lead page header pieces, styled to match the Project page header (ProjectJourneyHeader) so the
// lead → project hand-off feels like one product. Layout uses container queries (@xl, @4xl …) because
// the sidebar eats width — the page scroll div is the @container.

const chip = "inline-flex min-w-0 items-center gap-2 rounded-xl bg-white border border-slate-200 px-2.5 @lg:px-3 py-1.5 text-[13px] @lg:text-sm text-slate-700 shadow-sm whitespace-nowrap [&>svg]:shrink-0";
const linkChip = `${chip} hover:border-emerald-300 hover:text-emerald-800 transition-colors`;

/** Contact, owner, location and enquiry scope — everything needed to reach and place the customer. */
export function LeadInfoRow({ lead, addedBy }: { lead: Lead; addedBy?: string }) {
  const whatsapp = lead.whatsappNumber || lead.mobileNumber;
  const site = [lead.siteAddress || lead.address, lead.city, lead.district, lead.state, lead.pincode]
    .map((p) => (p || "").trim()).filter(Boolean).join(", ");
  const mapUrl = site ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site)}` : undefined;
  const products = (lead.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
  const shown = products.slice(0, 5);
  const enquiry = enquiryTypeOf(lead);
  const details = enquiryDetails(lead);

  return (
    <div className="mt-3 space-y-2.5">
      <div className="grid grid-cols-2 @xl:flex @xl:flex-wrap items-center gap-2">
        {lead.mobileNumber && (
          <a href={`tel:${lead.mobileNumber}`} className={linkChip} title="Call">
            <Phone className="h-4 w-4 text-emerald-700" /> <span className="font-semibold truncate">{lead.mobileNumber}</span>
          </a>
        )}
        {whatsapp && (
          <a href={waLink(whatsapp)} target="_blank" rel="noreferrer" className={linkChip} title="Open WhatsApp chat">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            {!lead.whatsappNumber || lead.whatsappNumber === lead.mobileNumber
              ? <span className="truncate">WhatsApp</span>
              : <span className="font-semibold truncate">{lead.whatsappNumber}</span>}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className={`${linkChip} col-span-2 @xl:col-span-1`} title="Email">
            <Mail className="h-4 w-4 text-slate-500" /> <span className="truncate">{lead.email}</span>
          </a>
        )}
        <span className={chip} title="Who brought this lead in">
          <UserCheck className="h-4 w-4 text-amber-500" />
          <span className="text-slate-400 hidden @md:inline">Lead by</span>
          <span className="font-semibold truncate">{addedBy || "—"}</span>
        </span>
        {lead.city && (
          <span className={chip}><MapPin className="h-4 w-4 text-emerald-700" /> <span className="truncate">{lead.city}</span></span>
        )}
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" title={site}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 text-[13px] @lg:text-sm font-semibold text-white whitespace-nowrap shadow-[0_4px_12px_-4px_rgba(0,53,34,0.45)] transition hover:-translate-y-px hover:bg-emerald-900">
            <Navigation className="h-4 w-4" /> Navigate
          </a>
        )}
      </div>

      {(enquiry || details.length > 0 || lead.requirementCategory || products.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <EnquiryTag type={enquiry} />
          {details.map((d) => (
            <span key={d} className="rounded-xl bg-violet-50 px-3 py-1 text-violet-700 font-medium">{d}</span>
          ))}
          {lead.requirementCategory && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 font-semibold text-amber-800">
              <Tag className="h-3.5 w-3.5" /> {lead.requirementCategory}
            </span>
          )}
          {shown.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-slate-600">
              <Package className="h-3.5 w-3.5 text-slate-400" /> {p}
            </span>
          ))}
          {products.length > shown.length && (
            <span className="text-xs text-slate-400 font-medium" title={products.slice(shown.length).join(", ")}>
              +{products.length - shown.length} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const STEP_SHORT: Record<JourneyStepId, string> = {
  requirement: "Requirement",
  quote: "Measure & Quote",
  convert: "Project",
};

/** Requirement → Measure & Quote → Project, same visual language as the project's stage bar. */
export function LeadJourneyBar({ journey, onOpen }: { journey: LeadJourney; onOpen: (id: JourneyStepId) => void }) {
  if (journey.loading && !journey.steps.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 @3xl:grid-cols-3 @6xl:flex @6xl:items-stretch gap-2.5" aria-label="Sales journey">
      {journey.steps.map((s, i) => {
        const done = s.status === "done";
        const current = s.status === "current";
        const missing = s.status === "missing";
        const box = done
          ? "border-emerald-200 bg-emerald-50/60"
          : current ? "border-amber-300 bg-amber-50/70" : "border-slate-100 bg-white";
        const circle = done ? "bg-emerald-700 text-white" : current ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600";
        return (
          <Fragment key={s.id}>
            {i > 0 && <div className="hidden @6xl:flex items-center text-slate-300 shrink-0"><ArrowRight className="h-4 w-4" /></div>}
            <button type="button" onClick={() => onOpen(s.id)} aria-current={current ? "step" : undefined}
              className={`flex-1 min-w-0 text-left rounded-2xl border px-3.5 py-2.5 @3xl:py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,0.18)] ${box}`}>
              <div className={`flex gap-3 ${current ? "items-start" : "items-center @3xl:items-start"}`}>
                <span className={`flex h-8 w-8 @3xl:h-9 @3xl:w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${circle}`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm @6xl:text-[15px] font-bold text-slate-900 truncate">{STEP_SHORT[s.id]}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${done ? "bg-emerald-100 text-emerald-800" : current ? "bg-amber-100 text-amber-800" : missing ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" : "bg-slate-100 text-slate-500"}`}>
                      {done ? "Done" : current ? "Now" : missing ? "Missing" : "Next"}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs text-slate-500 line-clamp-2 ${current ? "" : "hidden @3xl:block"}`}>{s.summary}</p>
                </div>
              </div>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
