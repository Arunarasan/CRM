import {
  Phone, MessageCircle, UserCheck, MapPin, Navigation, Tag, Package, CheckCircle2, Star,
  Scissors, Wrench, PartyPopper,
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

const STAGE_META: Record<number, { icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  1: { icon: Scissors, hint: "Stitching · Shipping · Manufacturing · Custom" },
  2: { icon: Wrench, hint: "Installation · Fitting" },
  3: { icon: PartyPopper, hint: "Customer satisfied · Reviews" },
};

const waLink = (n: string) => {
  let d = n.replace(/\D/g, "");
  if (d.length === 10) d = `91${d}`; // bare Indian mobile → add country code
  return `https://wa.me/${d}`;
};

/** Customer contact / lead / location / scope row shown under the project name. */
export function ProjectInfoRow({ summary }: { summary: ProjectHeaderSummary }) {
  const chip = "inline-flex items-center gap-1.5 rounded-lg bg-white/80 border border-slate-200 px-2.5 py-1 text-xs sm:text-sm text-slate-600 shadow-sm";
  const products = summary.products || [];
  const shownProducts = products.slice(0, 6);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {summary.phone && (
          <a href={`tel:${summary.phone}`} className={`${chip} hover:border-emerald-300 hover:text-emerald-700`} title="Call">
            <Phone className="h-3.5 w-3.5 text-emerald-500" /> {summary.phone}
          </a>
        )}
        {summary.whatsapp && (
          <a href={waLink(summary.whatsapp)} target="_blank" rel="noreferrer" className={`${chip} hover:border-emerald-300 hover:text-emerald-700`} title="Open WhatsApp chat">
            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
            {summary.whatsappSameAsPhone ? <span>WhatsApp <span className="text-slate-400">(same number)</span></span> : summary.whatsapp}
          </a>
        )}
        {summary.city && (
          <span className={chip}><MapPin className="h-3.5 w-3.5 text-emerald-500" /> {summary.city}</span>
        )}
        <span className={chip} title="Employee who got this lead">
          <UserCheck className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-slate-400">Lead by</span> <span className="font-semibold text-slate-700">{summary.leadBy || "—"}</span>
        </span>
        {summary.mapUrl && (
          <a href={summary.mapUrl} target="_blank" rel="noreferrer" title={summary.address || "Open in Google Maps"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            <Navigation className="h-3.5 w-3.5" /> Navigate
          </a>
        )}
      </div>
      {((summary.categories || []).length > 0 || products.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(summary.categories || []).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-800">
              <Tag className="h-3 w-3" /> {c}
            </span>
          ))}
          {shownProducts.map((p) => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
              <Package className="h-3 w-3 text-slate-400" /> {p}
            </span>
          ))}
          {products.length > shownProducts.length && (
            <span className="text-slate-400 font-medium" title={products.slice(6).join(", ")}>+{products.length - shownProducts.length} more</span>
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
    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2.5">
      {stages.map((s, i) => {
        const meta = STAGE_META[s.number] || STAGE_META[1];
        const Icon = meta.icon;
        const done = s.status === "COMPLETED";
        const current = i === currentIdx;
        const tone = done
          ? "border-emerald-200 bg-emerald-50/70"
          : current ? "border-amber-200 bg-amber-50/60 ring-1 ring-amber-100" : "border-slate-200 bg-white/70";
        const barColor = done ? "bg-emerald-500" : s.progress > 0 ? "bg-amber-500" : "bg-slate-300";
        return (
          <button key={s.number} type="button" onClick={onOpen}
            className={`text-left rounded-xl border px-3 py-2.5 transition hover:shadow-sm ${tone}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${done ? "bg-emerald-500 text-white" : current ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : s.number}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stage {s.number}{current && !done ? " · Now" : ""}</div>
                  <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-slate-400" />{s.name}</div>
                </div>
              </div>
              <span className="text-base font-black text-slate-800">{s.progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${s.progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.works.length === 0 ? (
                <span className="text-[11px] text-slate-400">{meta.hint}</span>
              ) : s.works.map((w, wi) => (
                <span key={`${w.name}-${wi}`}
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${w.progress >= 100 ? "bg-emerald-100 text-emerald-700" : w.progress > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>
                  {w.progress >= 100 && <CheckCircle2 className="h-3 w-3" />}
                  {w.name}{w.progress > 0 && w.progress < 100 ? ` ${w.progress}%` : ""}
                </span>
              ))}
            </div>
            {s.number === 3 && (s.reviewCount ?? 0) > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.avgRating ?? "—"} · {s.reviewCount} review{s.reviewCount === 1 ? "" : "s"}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
