import { Fragment } from "react";
import {
  Phone, MessageCircle, UserCheck, MapPin, Navigation, Tag, Package, CheckCircle2, Star, ArrowRight,
} from "lucide-react";

export interface JourneyWork { name: string; stage?: string; progress: number }
export interface JourneyStage {
  number: number;
  name: string;
  progress: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  works: JourneyWork[];
  handoverDate?: string | null;
  reviewCount?: number;
  avgRating?: number | null;
}
export interface ProjectHeaderSummary {
  customerName?: string;
  phone?: string;
  whatsapp?: string;
  whatsappSameAsPhone?: boolean;
  city?: string;
  address?: string;
  mapUrl?: string;
  leadBy?: string;
  categories?: string[];
  products?: string[];
  journey?: JourneyStage[];
}

/** What each stage covers — shown until real stage tasks exist. */
const STAGE_HINT: Record<number, string[]> = {
  1: ["Stitching", "Shipping", "Manufacturing", "Custom"],
  2: ["Installation", "Fitting"],
  3: ["Handed over to customer", "Customer review"],
};

export const waLink = (n: string) => {
  let d = n.replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`; // bare Indian mobile → add country code
  return `https://wa.me/${d}`;
};

/** Customer contact / lead / location / scope rows shown under the project name. */
export function ProjectInfoRow({ summary }: { summary: ProjectHeaderSummary }) {
  const chip = "inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-sm text-slate-700 shadow-sm";
  const link = `${chip} hover:border-emerald-300 hover:text-emerald-800 transition-colors`;
  const products = summary.products || [];
  const shownProducts = products.slice(0, 5);
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {summary.phone && (
          <a href={`tel:${summary.phone}`} className={link} title="Call">
            <Phone className="h-4 w-4 text-emerald-700" /> <span className="font-semibold">{summary.phone}</span>
          </a>
        )}
        {summary.whatsapp && (
          <a href={waLink(summary.whatsapp)} target="_blank" rel="noreferrer" className={link} title="Open WhatsApp chat">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            {summary.whatsappSameAsPhone
              ? <span>WhatsApp <span className="text-slate-400">(same number)</span></span>
              : <span className="font-semibold">{summary.whatsapp}</span>}
          </a>
        )}
        <span className={chip} title="Employee who got this lead">
          <UserCheck className="h-4 w-4 text-amber-500" />
          <span className="text-slate-400">Lead by</span> <span className="font-semibold">{summary.leadBy || "—"}</span>
        </span>
        {summary.city && (
          <span className={chip}><MapPin className="h-4 w-4 text-emerald-700" /> {summary.city}</span>
        )}
        {summary.mapUrl && (
          <a href={summary.mapUrl} target="_blank" rel="noreferrer" title={summary.address || "Open in Google Maps"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900">
            <Navigation className="h-4 w-4" /> Navigate
          </a>
        )}
      </div>
      {((summary.categories || []).length > 0 || products.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {(summary.categories || []).map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-1 font-semibold text-amber-800">
              <Tag className="h-3.5 w-3.5" /> {c}
            </span>
          ))}
          {shownProducts.map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-slate-600">
              <Package className="h-3.5 w-3.5 text-slate-400" /> {p}
            </span>
          ))}
          {products.length > shownProducts.length && (
            <span className="text-xs text-slate-400 font-medium" title={products.slice(shownProducts.length).join(", ")}>+{products.length - shownProducts.length} more</span>
          )}
        </div>
      )}
    </div>
  );
}

/** The 3-stage journey bar: Production → Installation & Fitting → Handover & Review. */
export function ProjectJourneyBar({ stages, onOpen }: { stages: JourneyStage[]; onOpen?: () => void }) {
  if (!stages?.length) return null;
  // The "current" stage is the first one not yet complete.
  const currentIdx = stages.findIndex((s) => s.status !== "COMPLETED");
  return (
    <div className="mt-3 flex flex-col md:flex-row md:items-stretch gap-2">
      {stages.map((s, i) => {
        const done = s.status === "COMPLETED";
        const current = i === currentIdx;
        const box = done
          ? "border-emerald-200 bg-emerald-50/60"
          : current ? "border-amber-300 bg-amber-50/70" : "border-slate-100 bg-white";
        const circle = done ? "bg-emerald-700 text-white" : current ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600";
        const barColor = done ? "bg-emerald-600" : "bg-amber-500";
        return (
          <Fragment key={s.number}>
            {i > 0 && (
              <div className="hidden md:flex items-center text-slate-300"><ArrowRight className="h-4 w-4" /></div>
            )}
            <button type="button" onClick={onOpen}
              className={`flex-1 min-w-0 text-left rounded-2xl border px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:shadow-md ${box}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${circle}`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : s.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[15px] font-bold text-slate-900 truncate">{s.name}</div>
                    <span className="text-lg font-bold text-slate-900">{s.progress}%</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {s.works.length === 0 ? (
                      s.number === 1
                        ? <span className="text-xs text-slate-500">{STAGE_HINT[1].join(" · ")}</span>
                        : STAGE_HINT[s.number]?.map((h) => (
                          <span key={h} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{h}</span>
                        ))
                    ) : s.works.map((w, wi) => (
                      <span key={`${w.name}-${wi}`}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${w.progress >= 100 ? "bg-emerald-100 text-emerald-800" : w.progress > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                        {w.progress >= 100 && <CheckCircle2 className="h-3 w-3" />}
                        {w.name}{w.progress > 0 && w.progress < 100 ? ` ${w.progress}%` : ""}
                      </span>
                    ))}
                    {s.number === 3 && (s.reviewCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.avgRating ?? "—"} ({s.reviewCount})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {s.progress > 0 && (
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${s.progress}%` }} />
                </div>
              )}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
