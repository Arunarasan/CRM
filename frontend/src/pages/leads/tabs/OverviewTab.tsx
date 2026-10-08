import { BaseInput } from '@/components/ui/input';
import { useEffect, useRef, useState } from "react";
import {
  Pencil, Check, X, Star, Users, MapPin, Home, ListChecks, Share2, XCircle, Sparkles,
  Contact as ContactIcon, Navigation, Plus, Clock, CalendarDays, Wallet, TrendingUp,
  CalendarClock, UserCircle2, Megaphone, AlertCircle, ChevronDown, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import api from "@/lib/api";
import { leadApi } from "../leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, PRIORITIES, REFERRAL_TYPES, TEMPERATURES,
  formatDate, formatDateTime, formatINR, avatarColor, initials, followUpTone,
  type Lead, type UserSummary,
} from "../constants";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";
import { EnquiryTag, enquiryDetails, enquiryTypeOf } from "../enquiry";

// Overview = what a salesperson needs first, then the details.
//   1. Key facts strip — budget, expected value, next follow-up, owner, source.
//   2. "Needed for the next step" — only the gaps that block the lead's current stage.
//   3. Main column: Requirement, Property. Side column: Site, Deal, Dates, Team, Referral,
//      More contact, Record (on phones the side extras fold under "More details").
// Read mode skips what the page header already shows (name, mobile, WhatsApp, email, rating).
// Editing is still ONE form with one Save — a section's pencil just opens it at that section.
// Lead fields go through the full-lead update (a full replace, so edits are merged onto the whole
// lead), the team through the assignment endpoint and the referral through its own endpoint.

type IconType = React.ComponentType<{ className?: string }>;
type Kind = "text" | "tel" | "email" | "number" | "money" | "date" | "select" | "area";
type Custom = "category" | "products" | "scope" | "rating" | "map";

interface FieldDef {
  key: keyof Lead & string;
  label: string;
  kind?: Kind;
  options?: string[];
  full?: boolean;
  placeholder?: string;
  custom?: Custom;
}

const SCOPE_FLAGS: Array<[keyof Lead & string, string]> = [
  ["reqKitchen", "Modular Kitchen"], ["reqWardrobe", "Wardrobe"], ["reqTvUnit", "TV Unit"],
  ["reqFalseCeiling", "False Ceiling"], ["reqPainting", "Painting"], ["reqFlooring", "Flooring"],
  ["reqElectrical", "Electrical"], ["reqPlumbing", "Plumbing"], ["reqWoodFinish", "Wood Finish"],
];

type SectionId = "requirement" | "property" | "site" | "deal" | "dates" | "contact";
interface SectionDef {
  id: SectionId;
  title: string;
  readTitle?: string;
  icon: IconType;
  side?: boolean;
  fields: FieldDef[];
  /** Edited here but not listed in read mode (the page header or key-facts strip shows them). */
  editOnly?: string[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "requirement", title: "Requirement", icon: ListChecks,
    fields: [
      { key: "requirementCategory", label: "Categories", custom: "category" },
      { key: "requirementProduct", label: "Products", custom: "products" },
      { key: "roomsRequired", label: "Rooms required", kind: "area", placeholder: "e.g. 3 Bedrooms, Living Room, Kitchen" },
      { key: "reqKitchen", label: "Scope of work", custom: "scope", full: true },
      { key: "projectDescription", label: "Requirement description", kind: "area", full: true },
      { key: "customerRequirements", label: "Customer notes", kind: "area", full: true },
      { key: "specialRequests", label: "Special requests", kind: "area", full: true },
    ],
  },
  {
    id: "property", title: "Property & preferences", icon: Home,
    fields: [
      { key: "propertyType", label: "Property type", placeholder: "e.g. Flat" },
      { key: "propertyName", label: "Property / building" },
      { key: "currentConstructionStage", label: "Construction status", kind: "select", options: CONSTRUCTION_STATUSES },
      { key: "floorCount", label: "Floors", kind: "number" },
      { key: "areaSqft", label: "Total area (sq.ft)", kind: "number" },
      { key: "expectedWorkArea", label: "Area to work on (sq.ft)", kind: "number" },
      { key: "preferredDesignStyle", label: "Design style", placeholder: "e.g. Modern" },
      { key: "preferredMaterial", label: "Preferred material" },
      { key: "preferredColorTheme", label: "Colour theme" },
      { key: "estimatedDuration", label: "Work duration", placeholder: "e.g. 6 weeks" },
    ],
  },
  {
    id: "site", title: "Site", icon: MapPin, side: true,
    fields: [
      { key: "siteAddress", label: "Site address (work location)", kind: "area", full: true, custom: "map" },
      { key: "address", label: "Billing / home address", kind: "area", full: true, custom: "map" },
      { key: "landmark", label: "Landmark" },
      { key: "city", label: "City" },
      { key: "district", label: "District" },
      { key: "state", label: "State" },
      { key: "pincode", label: "Pincode", kind: "number" },
    ],
  },
  {
    id: "deal", title: "Deal", icon: Sparkles, side: true,
    editOnly: ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue", "leadSource", "rating"],
    fields: [
      { key: "estimatedBudget", label: "Estimated budget", kind: "money" },
      { key: "minimumBudget", label: "Budget from", kind: "money" },
      { key: "maximumBudget", label: "Budget up to", kind: "money" },
      { key: "expectedProjectValue", label: "Expected value", kind: "money" },
      { key: "paymentPreference", label: "Payment preference" },
      { key: "leadSource", label: "Source", kind: "select", options: LEAD_SOURCES },
      { key: "leadType", label: "Lead type", kind: "select", options: LEAD_TYPES },
      { key: "priority", label: "Priority", kind: "select", options: PRIORITIES },
      { key: "leadTemperature", label: "Temperature", kind: "select", options: TEMPERATURES },
      { key: "rating", label: "Rating", custom: "rating" },
    ],
  },
  {
    id: "dates", title: "Dates", icon: CalendarDays, side: true,
    fields: [
      { key: "expectedStartDate", label: "Expected start", kind: "date" },
      { key: "expectedEndDate", label: "Our estimated completion", kind: "date" },
      { key: "preferredCompletionDate", label: "Customer's deadline", kind: "date" },
    ],
  },
  {
    id: "contact", title: "Contact", readTitle: "More contact", icon: ContactIcon, side: true,
    editOnly: ["name", "mobileNumber", "whatsappNumber", "email"],
    fields: [
      { key: "name", label: "Customer name" },
      { key: "mobileNumber", label: "Mobile", kind: "tel" },
      { key: "alternateMobile", label: "Alternate mobile", kind: "tel" },
      { key: "whatsappNumber", label: "WhatsApp", kind: "tel" },
      { key: "email", label: "Email", kind: "email" },
      { key: "companyName", label: "Company" },
      { key: "contactPerson", label: "Contact person" },
      { key: "gstNumber", label: "GST number" },
    ],
  },
];
const sectionById = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;

/** What blocks the lead's current stage — listed in "Needed for the next step". */
const NEXT_STEP_NEEDS: Record<string, { title: string; keys: string[] }> = {
  REQUIREMENT: { title: "Needed to finish the requirement", keys: ["requirementCategory", "roomsRequired", "reqKitchen", "siteAddress"] },
  QUOTE: { title: "Needed for the quote", keys: ["siteAddress", "areaSqft", "propertyType", "budget"] },
};

const TEAM_ROLES = ["Sales Executive", "Designer", "Engineer", "Project Manager"] as const;
type Role = (typeof TEAM_ROLES)[number];
type TeamDraft = Record<Role, string>;

type ReferralDraft = {
  referralType: string; referredByCustomerId: string; referredByCustomerName: string;
  referredByEmployeeId: string; referrerName: string; referrerContact: string; referralNotes: string;
};

const LEAD_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
  .concat(SCOPE_FLAGS.map(([k]) => k));

const filled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== false;
const dateInput = (v?: string) => (v ? v.slice(0, 10) : "");
const splitProducts = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean);
const inputCls = "w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200";
const areaCls = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200";

function hasValue(lead: Lead, f: FieldDef): boolean {
  if (f.custom === "scope") return SCOPE_FLAGS.some(([k]) => !!lead[k]);
  if (f.custom === "products") return splitProducts(lead.requirementProduct).length > 0;
  return filled(lead[f.key]);
}

const FIELD_INDEX: Record<string, { field: FieldDef; section: SectionId }> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, { field: f, section: s.id }])),
);
const hasBudget = (l: Lead) => [l.estimatedBudget, l.minimumBudget, l.maximumBudget].some(filled);

/** 850000 -> ₹8.5L — compact money for the key-facts strip. */
function compactINR(v?: number | null): string {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return "";
  const fmt = (x: number, unit: string) => `${Number(x.toFixed(x >= 10 ? 0 : 1))}${unit}`;
  if (n >= 1e7) return `₹${fmt(n / 1e7, "Cr")}`;
  if (n >= 1e5) return `₹${fmt(n / 1e5, "L")}`;
  if (n >= 1e3) return `₹${fmt(n / 1e3, "K")}`;
  return `₹${n}`;
}

/** One line from the four budget fields: "₹7L–10L · est ₹8.5L". */
function budgetLine(l: Lead): string {
  const min = compactINR(l.minimumBudget), max = compactINR(l.maximumBudget), est = compactINR(l.estimatedBudget);
  const range = min && max ? `${min}–${max.replace("₹", "")}` : min ? `from ${min}` : max ? `up to ${max}` : "";
  if (range && est) return `${range} · est ${est}`;
  return range || est;
}

function teamOf(lead: Lead): Record<Role, UserSummary | undefined> {
  return {
    "Sales Executive": lead.assignedSalesExecutive, "Designer": lead.assignedDesigner,
    "Engineer": lead.assignedEngineer, "Project Manager": lead.projectManager,
  };
}

function seedTeam(lead: Lead): TeamDraft {
  const t = teamOf(lead);
  return Object.fromEntries(TEAM_ROLES.map((r) => [r, t[r]?.id ? String(t[r]!.id) : ""])) as TeamDraft;
}

function seedReferral(lead: Lead): ReferralDraft {
  return {
    referralType: lead.referralType || "",
    referredByCustomerId: lead.referredByCustomer?.id ? String(lead.referredByCustomer.id) : "",
    referredByCustomerName: lead.referredByCustomer?.name || "",
    referredByEmployeeId: lead.referredByEmployee?.id ? String(lead.referredByEmployee.id) : "",
    referrerName: lead.referrerName || "",
    referrerContact: lead.referrerContact || "",
    referralNotes: lead.referralNotes || "",
  };
}

function seedLead(lead: Lead): Record<string, any> {
  const d: Record<string, any> = {};
  LEAD_KEYS.forEach((k) => { d[k] = (lead as any)[k] ?? ""; });
  ["expectedStartDate", "expectedEndDate", "preferredCompletionDate"].forEach((k) => { d[k] = dateInput(d[k]); });
  return d;
}

// updateLead() is a full replace, so merge the edits onto the whole lead; mirrors LeadFormDialog's cleanup.
function saveLeadPatch(lead: Lead, patch: Record<string, any>): Promise<unknown> {
  const payload: any = { ...lead, ...patch };
  ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue",
    "areaSqft", "expectedWorkArea", "floorCount", "rating"].forEach((k) => {
    if (payload[k] === "" || payload[k] === null) delete payload[k];
  });
  ["expectedStartDate", "expectedEndDate", "preferredCompletionDate", "nextFollowUpDate"].forEach((k) => {
    if (!payload[k]) delete payload[k];
  });
  if (payload.assignedSalesExecutive?.id) payload.assignedSalesExecutive = { id: payload.assignedSalesExecutive.id };
  else delete payload.assignedSalesExecutive;
  if (payload.assignedDesigner?.id) payload.assignedDesigner = { id: payload.assignedDesigner.id };
  else delete payload.assignedDesigner;
  if (payload.assignedEngineer?.id) payload.assignedEngineer = { id: payload.assignedEngineer.id };
  else delete payload.assignedEngineer;
  delete payload.projectManager;
  delete payload.convertedToCustomer;
  delete payload.convertedToProject;
  delete payload.journeyStage; // computed, not a lead column
  // Referral has its own endpoint; drop the nested refs.
  delete payload.referredByCustomer;
  delete payload.referredByEmployee;
  return leadApi.update(lead.id, payload);
}

function MapsLink({ parts }: { parts: (string | undefined | null)[] }) {
  const query = parts.map((p) => (p || "").trim()).filter(Boolean).join(", ");
  if (!query) return null;
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline" title={`Open in Google Maps: ${query}`}>
      <Navigation className="h-3.5 w-3.5" /> Map
    </a>
  );
}

function Stars({ value, onPick }: { value?: number | null; onPick?: (v: number | "") => void }) {
  const v = Number(value) || 0;
  return (
    <span className="inline-flex items-center gap-0.5" title={v ? `${v}/5` : "Unrated"}>
      {[1, 2, 3, 4, 5].map((s) => onPick ? (
        <button key={s} type="button" onClick={() => onPick(s === v ? "" : s)} aria-label={`Set rating ${s} of 5`} className="hover:scale-110 transition-transform">
          <Star className={`h-5 w-5 ${s <= v ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ) : (
        <Star key={s} className={`h-4 w-4 ${s <= v ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </span>
  );
}

// ===========================================================================
export default function OverviewTab({
  lead, users, canEdit, onChanged,
}: {
  lead: Lead;
  users: UserSummary[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>(() => seedLead(lead));
  const [team, setTeam] = useState<TeamDraft>(() => seedTeam(lead));
  const [referral, setReferral] = useState<ReferralDraft>(() => seedReferral(lead));
  const [categories, setCategories] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [catalog, setCatalog] = useState<{ id: number; name: string; categorySlug?: string }[]>([]);
  // Where to land when edit opens from a section pencil / "Add" chip.
  const focusTarget = useRef<{ section: string; field?: string } | null>(null);

  // The website catalogue powers the category + product pickers (fetched once, on first edit).
  useEffect(() => {
    if (!editing || categories.length) return;
    api.get("/public/categories").then((r) => setCategories(r.data || [])).catch(() => {});
    api.get("/public/products").then((r) => setCatalog(r.data || [])).catch(() => {});
  }, [editing, categories.length]);

  const start = (section?: string, field?: string) => {
    setDraft(seedLead(lead)); setTeam(seedTeam(lead)); setReferral(seedReferral(lead));
    focusTarget.current = section ? { section, field } : null;
    setEditing(true);
  };

  // After edit opens: scroll to the section / field that was asked for and focus its input.
  useEffect(() => {
    const t = focusTarget.current;
    if (!editing || !t) return;
    focusTarget.current = null;
    requestAnimationFrame(() => {
      const el = (t.field && document.getElementById(`ov-f-${t.field}`)) || document.getElementById(`ov-${t.section}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
    });
  }, [editing]);

  const set = (k: string) => (v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!String(draft.name || "").trim()) { toast.error("Customer name can't be empty."); return; }
    if (!String(draft.mobileNumber || "").trim()) { toast.error("Mobile number can't be empty."); return; }
    setSaving(true);
    try {
      // One after another: these all write the same lead row, and parallel writes conflict.
      await saveLeadPatch(lead, draft);
      const base = seedTeam(lead);
      const changedRoles = TEAM_ROLES.filter((r) => team[r] && team[r] !== base[r]);
      if (changedRoles.length) {
        await leadApi.assignTeam(lead.id, Object.fromEntries(changedRoles.map((r) => [r, Number(team[r])])));
      }
      if (JSON.stringify(referral) !== JSON.stringify(seedReferral(lead))) {
        const r = referral;
        await leadApi.updateReferral(lead.id, {
          referralType: r.referralType || null,
          referredByCustomerId: r.referralType === "Existing Customer" && r.referredByCustomerId ? Number(r.referredByCustomerId) : null,
          referredByEmployeeId: r.referralType === "Employee" && r.referredByEmployeeId ? Number(r.referredByEmployeeId) : null,
          referrerName: r.referrerName || null,
          referrerContact: r.referrerContact || null,
          referralNotes: r.referralNotes || null,
        });
      }
      toast.success("Lead details saved");
      setEditing(false);
      onChanged();
    } catch (err: any) {
      console.error("Failed to save lead details", err);
      toast.error(err?.response?.data?.message || "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ---- Read view bookkeeping -------------------------------------------------
  const assigned = TEAM_ROLES.filter((r) => teamOf(lead)[r]?.name);
  const hasReferral = !!(lead.referralType || lead.referrerName || lead.referredByCustomer?.id || lead.referredByEmployee?.id);
  const referrer = lead.referredByCustomer?.name || lead.referredByEmployee?.name || lead.referrerName;
  const enquiry = enquiryTypeOf(lead);
  const services = enquiryDetails(lead);
  const owner = lead.assignedSalesExecutive?.name || lead.leadOwner?.name;
  const follow = followUpTone(lead.nextFollowUpDate, lead.nextFollowUpTime);
  const followOverdue = follow.className.includes("red");

  const needs = NEXT_STEP_NEEDS[lead.journeyStage || ""];
  const blocking = (needs?.keys || []).filter((k) => (k === "budget" ? !hasBudget(lead) : !hasValue(lead, FIELD_INDEX[k].field)));
  const readFields = (s: SectionDef) => s.fields.filter((f) => !s.editOnly?.includes(f.key) && hasValue(lead, f));
  const otherEmpty = SECTIONS.flatMap((s) => s.fields.filter((f) => !s.editOnly?.includes(f.key) && !hasValue(lead, f)))
    .filter((f) => !blocking.includes(f.key)).length;

  const renderSection = (s: SectionDef, extraClass = "") => {
    const shown = editing ? s.fields : readFields(s);
    const showServices = s.id === "requirement" && !editing && services.length > 0;
    if (!shown.length && !showServices) return null;
    return (
      <Block key={s.id} id={`ov-${s.id}`} icon={s.icon} title={editing ? s.title : s.readTitle || s.title}
        onEdit={canEdit && !editing ? () => start(s.id) : undefined} className={extraClass}>
        <Dl compact={s.side} read={!editing}>
          {s.id === "site" && !editing ? <SiteRead lead={lead} /> : shown.map((f) => (
            <Item key={f.key} id={`ov-f-${f.key}`} label={f.label} full={f.full}>
              {editing ? renderEditor(f) : renderValue(f)}
            </Item>
          ))}
          {showServices && <Item label="Services asked" full><Chips items={services} /></Item>}
        </Dl>
      </Block>
    );
  };

  const site = sectionById("site");
  const showTeam = editing || assigned.length > 0;
  const showReferral = editing || hasReferral;

  return (
    <section className="@container rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-label="Lead details">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="font-bold tracking-tight text-slate-900">{editing ? "Edit lead details" : "Lead details"}</h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {editing ? "Leave anything you don't know empty." : "Key facts first, then everything that's been filled in."}
          </p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => start()} className="h-9 rounded-lg border-slate-200 font-semibold text-slate-700 shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-5">
        {lead.status === "Lost" && !editing && (
          <Block icon={XCircle} title="Why it was lost" tone="text-rose-600">
            <Dl>
              {lead.lostReason && <Item label="Reason">{lead.lostReason}</Item>}
              {lead.competitor && <Item label="Went with">{lead.competitor}</Item>}
              {lead.customerFeedback && <Item label="Customer feedback" full>{lead.customerFeedback}</Item>}
            </Dl>
          </Block>
        )}

        {/* 1. Key facts */}
        {!editing && (
          <dl className="grid grid-cols-2 @2xl:grid-cols-5 gap-2" aria-label="Key facts">
            <Fact icon={Wallet} label="Budget" value={budgetLine(lead)} className="col-span-2 @2xl:col-span-1"
              onAdd={canEdit ? () => start("deal", "estimatedBudget") : undefined} />
            <Fact icon={TrendingUp} label="Expected value" value={compactINR(lead.expectedProjectValue)}
              title={lead.expectedProjectValue ? formatINR(lead.expectedProjectValue) : undefined}
              onAdd={canEdit ? () => start("deal", "expectedProjectValue") : undefined} />
            <Fact icon={CalendarClock} label="Next follow-up" value={lead.nextFollowUpDate ? follow.label : ""}
              valueClass={follow.className} hint={followOverdue ? "Overdue" : undefined} />
            <Fact icon={UserCircle2} label="Owner" value={owner || ""}
              hint={assigned.length > 1 ? `+${assigned.length - 1} more in team` : undefined}
              onAdd={canEdit ? () => start("team") : undefined} />
            <Fact icon={Megaphone} label="Source" value={lead.leadSource || ""}
              hint={referrer ? `via ${referrer}` : undefined}
              onAdd={canEdit ? () => start("deal", "leadSource") : undefined} />
          </dl>
        )}

        {/* 2. Needed for the next step */}
        {!editing && needs && blocking.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <AlertCircle className="h-3.5 w-3.5" /> {needs.title}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {blocking.map((k) => {
                const label = k === "budget" ? "Budget" : FIELD_INDEX[k].field.label;
                const section = k === "budget" ? "deal" : FIELD_INDEX[k].section;
                const field = k === "budget" ? "estimatedBudget" : k;
                return canEdit ? (
                  <button key={k} type="button" onClick={() => start(section, field)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                    <Plus className="h-3 w-3" /> {label}
                  </button>
                ) : (
                  <span key={k} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900">{label}</span>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Details: main column + side column */}
        <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-x-8 gap-y-5">
          <div className="min-w-0 space-y-5">
            {enquiry && !editing && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500 mr-1">Looking for</span>
                <EnquiryTag type={enquiry} />
              </div>
            )}
            {renderSection(sectionById("requirement"))}
            {/* Phones: the site sits right under the requirement. Desktop: it heads the side column. */}
            {!editing && renderSection(site, "@4xl:hidden")}
            {renderSection(sectionById("property"))}
          </div>

          <aside className="min-w-0 space-y-5 @4xl:border-l @4xl:border-slate-100 @4xl:pl-8">
            {renderSection(site, editing ? "" : "hidden @4xl:block")}

            {!editing && (
              <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen}
                className="@4xl:hidden flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
                More details
                <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  Deal, dates, team, contact
                  <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
            )}

            <div className={`space-y-5 ${editing || moreOpen ? "" : "hidden"} @4xl:block`}>
              {renderSection(sectionById("deal"))}
              {renderSection(sectionById("dates"))}

              {showTeam && (
                <Block id="ov-team" icon={Users} title="Team" onEdit={canEdit && !editing ? () => start("team") : undefined}>
                  {editing ? (
                    <Dl compact>
                      {TEAM_ROLES.map((r) => (
                        <Item key={r} label={r}>
                          <select className={inputCls} value={team[r]} onChange={(e) => setTeam((t) => ({ ...t, [r]: e.target.value }))}>
                            <option value="">Unassigned</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </Item>
                      ))}
                    </Dl>
                  ) : (
                    <ul className="space-y-2">
                      {assigned.map((r) => {
                        const name = teamOf(lead)[r]!.name!;
                        return (
                          <li key={r} className="flex items-center gap-2.5 min-w-0">
                            <span className={`h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${avatarColor(name)}`}>{initials(name)}</span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800 truncate">{name}</span>
                              <span className="block text-[11px] text-slate-500">{r}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Block>
              )}

              {showReferral && (
                <Block id="ov-referral" icon={Share2} title="Referral" onEdit={canEdit && !editing ? () => start("referral") : undefined}>
                  {editing
                    ? <ReferralEditor draft={referral} patch={(p) => setReferral((r) => ({ ...r, ...p }))} users={users} />
                    : (
                      <Dl compact>
                        {lead.referralType && <Item label="Referred by">{lead.referralType}</Item>}
                        {referrer && <Item label="Referrer">{referrer}</Item>}
                        {lead.referrerContact && <Item label="Referrer contact">{lead.referrerContact}</Item>}
                        {lead.referralNotes && <Item label="Notes" full>{lead.referralNotes}</Item>}
                      </Dl>
                    )}
                </Block>
              )}

              {renderSection(sectionById("contact"))}

              {!editing && (
                <Block icon={History} title="Record">
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <Clock className="h-3.5 w-3.5 mt-px shrink-0 text-slate-400" />
                      <span>Created {formatDateTime(lead.createdAt)}{lead.createdBy ? ` by ${lead.createdBy}` : ""}</span>
                    </li>
                    <li className="pl-5">{lead.followUpCount ?? 0} follow-up{lead.followUpCount === 1 ? "" : "s"} logged</li>
                    {lead.lastContactAt && <li className="pl-5">Last contact {formatDate(lead.lastContactAt)}</li>}
                  </ul>
                </Block>
              )}
            </div>
          </aside>
        </div>

        {!editing && canEdit && otherEmpty > 0 && (
          <button type="button" onClick={() => start()} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
            <Plus className="h-3.5 w-3.5" /> {otherEmpty} more field{otherEmpty === 1 ? "" : "s"} not filled — add details
          </button>
        )}
      </div>

      {/* Single save bar while editing. */}
      {editing && (
        <div className="sticky bottom-16 md:bottom-0 z-10 flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-white/95 backdrop-blur px-4 sm:px-5 py-3">
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900 text-white">
            <Check className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}
    </section>
  );

  // ---- Field renderers ---------------------------------------------------------
  function renderValue(f: FieldDef): React.ReactNode {
    const v = (lead as any)[f.key];
    switch (f.custom) {
      case "category":
        return <Chips items={splitProducts(lead.requirementCategory)} />;
      case "products":
        return <Chips items={splitProducts(lead.requirementProduct)} />;
      case "scope":
        return <Chips items={SCOPE_FLAGS.filter(([k]) => lead[k]).map(([, l]) => l)} check />;
      case "rating":
        return <Stars value={v} />;
    }
    if (f.kind === "money") return <span className="font-semibold">{formatINR(v)}</span>;
    if (f.kind === "date") return formatDate(v);
    if (f.kind === "email") return <a href={`mailto:${v}`} className="hover:text-emerald-800 hover:underline break-all">{v}</a>;
    if (f.kind === "tel") return <a href={`tel:${v}`} className="hover:text-emerald-800 hover:underline">{v}</a>;
    return <span className="whitespace-pre-line">{String(v)}</span>;
  }

  function renderEditor(f: FieldDef): React.ReactNode {
    const v = draft[f.key];
    switch (f.custom) {
      case "category": {
        // One or more categories, comma-separated (products are optional).
        const picked = splitProducts(v);
        const toggle = (name: string) => set(f.key)((picked.includes(name) ? picked.filter((x) => x !== name) : [...picked, name]).join(", "));
        // Keep saved values visible even if the catalogue renamed/removed them.
        const names = [...picked.filter((n) => !categories.some((c) => c.name === n)), ...categories.map((c) => c.name)];
        return (
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => {
              const on = picked.includes(n);
              return (
                <button key={n} type="button" aria-pressed={on} onClick={() => toggle(n)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {on && <Check className="h-3 w-3" strokeWidth={2.5} />} {n}
                </button>
              );
            })}
          </div>
        );
      }
      case "products": {
        const picked = splitProducts(v);
        const cats = splitProducts(draft.requirementCategory);
        const slugs = new Set(categories.filter((c) => cats.includes(c.name)).map((c) => c.slug));
        const options = catalog.filter((p) => slugs.size === 0 || (p.categorySlug != null && slugs.has(p.categorySlug))).map((p) => p.name).filter((n) => !picked.includes(n));
        const setPicked = (names: string[]) => set(f.key)(names.join(", "));
        return (
          <div className="space-y-2">
            <select className={inputCls} value="" onChange={(e) => { if (e.target.value) setPicked([...picked, e.target.value]); }}>
              <option value="">Add a product...</option>
              {options.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {p}
                    <button type="button" onClick={() => setPicked(picked.filter((x) => x !== p))} aria-label={`Remove ${p}`}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      }
      case "scope":
        return (
          <div className="flex flex-wrap gap-1.5">
            {SCOPE_FLAGS.map(([k, label]) => {
              const on = !!draft[k];
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => set(k)(!on)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {on && <Check className="h-3 w-3" strokeWidth={2.5} />} {label}
                </button>
              );
            })}
          </div>
        );
      case "rating":
        return <div className="h-9 flex items-center"><Stars value={v} onPick={set(f.key)} /></div>;
    }
    if (f.kind === "area") {
      return <textarea className={areaCls} rows={f.full ? 3 : 2} placeholder={f.placeholder} value={v ?? ""} onChange={(e) => set(f.key)(e.target.value)} />;
    }
    if (f.kind === "select") {
      return (
        <select className={inputCls} value={v ?? ""} onChange={(e) => set(f.key)(e.target.value)}>
          <option value="">Select...</option>
          {v && !f.options!.includes(v) && <option value={v}>{v}</option>}
          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    const type = f.kind === "money" ? "number" : f.kind === "tel" ? "tel" : f.kind || "text";
    const inputMode = f.kind === "money" || f.kind === "number" ? "numeric" : f.kind === "tel" ? "tel" : f.kind === "email" ? "email" : undefined;
    return (
      <BaseInput className={inputCls} type={type} inputMode={inputMode as any} placeholder={f.placeholder}
        value={v ?? ""} onChange={(e) => set(f.key)(e.target.value)} />
    );
  }
}

// ---------------------------------------------------------------------------
function Block({ id, icon: Icon, title, tone, className, onEdit, children }: {
  id?: string; icon: IconType; title: string; tone?: string; className?: string; onEdit?: () => void; children: React.ReactNode;
}) {
  return (
    <div id={id} className={`@container min-w-0 scroll-mt-24 ${className || ""}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${tone || "text-slate-500"}`}>
          <Icon className="h-3.5 w-3.5" /> {title}
        </h3>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={`Edit ${title}`} title={`Edit ${title}`}
            className="-my-1 h-7 w-7 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// read = two columns even on a phone (short values side by side); edit keeps inputs full-width there.
function Dl({ compact, read, children }: { compact?: boolean; read?: boolean; children: React.ReactNode }) {
  const base = read ? "grid-cols-2" : "grid-cols-1 @xs:grid-cols-2";
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${base} ${compact ? "" : "@2xl:grid-cols-3"}`}>
      {children}
    </dl>
  );
}

function Item({ id, label, full, action, children }: {
  id?: string; label: string; full?: boolean; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div id={id} className={`min-w-0 scroll-mt-24 ${full ? "col-span-full" : ""}`}>
      <dt className="flex items-center justify-between gap-2 text-xs text-slate-500">{label}{action}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 break-words">{children}</dd>
    </div>
  );
}

/** Key-fact tile: label + value, or an Add link (or "Not set") when empty. */
function Fact({ icon: Icon, label, value, valueClass, hint, title, onAdd, className }: {
  icon: IconType; label: string; value: string; valueClass?: string; hint?: string; title?: string;
  onAdd?: () => void; className?: string;
}) {
  const tone = valueClass && !valueClass.includes("muted") && !valueClass.includes("text-foreground") ? valueClass : "text-slate-900";
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 ${className || ""}`} title={title}>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</dt>
      <dd className="mt-1 min-w-0">
        {value ? (
          <>
            <span className={`block truncate text-sm font-bold ${tone}`}>{value}</span>
            {hint && <span className="block truncate text-[11px] text-slate-500">{hint}</span>}
          </>
        ) : onAdd ? (
          <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline">
            <Plus className="h-3 w-3" /> Add
          </button>
        ) : (
          <span className="text-sm text-slate-400">Not set</span>
        )}
      </dd>
    </div>
  );
}

/** Site in read mode: the work address (with Map) first, then the place on one line. */
function SiteRead({ lead }: { lead: Lead }) {
  // City and district are often the same ("Coimbatore, Coimbatore") — show each name once.
  const names = [lead.city, lead.district, lead.state].map((x) => (x || "").trim()).filter(Boolean);
  const place = [...new Set(names)].join(", ") + (lead.pincode ? ` – ${lead.pincode}` : "");
  return (
    <>
      {lead.siteAddress && (
        <Item label="Site address (work location)" full action={<MapsLink parts={[lead.siteAddress, lead.city, lead.district, lead.state, lead.pincode]} />}>
          <span className="whitespace-pre-line">{lead.siteAddress}</span>
        </Item>
      )}
      {lead.landmark && <Item label="Landmark" full>{lead.landmark}</Item>}
      {place.trim() && <Item label="City / state" full>{place.replace(/^ – /, "Pincode ")}</Item>}
      {lead.address && lead.address !== lead.siteAddress && (
        <Item label="Billing / home address" full action={<MapsLink parts={[lead.address, lead.city, lead.state, lead.pincode]} />}>
          <span className="whitespace-pre-line">{lead.address}</span>
        </Item>
      )}
    </>
  );
}

function Chips({ items, check }: { items: string[]; check?: boolean }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {check && <Check className="h-3 w-3 text-emerald-700" strokeWidth={2.5} />} {t}
        </span>
      ))}
    </span>
  );
}

function ReferralEditor({ draft, patch, users }: {
  draft: ReferralDraft; patch: (p: Partial<ReferralDraft>) => void; users: UserSummary[];
}) {
  const type = draft.referralType;
  return (
    <Dl compact>
      <Item label="Referred by">
        <select className={inputCls} value={type} onChange={(e) => patch({
          referralType: e.target.value, referredByCustomerId: "", referredByCustomerName: "",
          referredByEmployeeId: "", referrerName: "", referrerContact: "",
        })}>
          <option value="">Not a referral</option>
          {REFERRAL_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Item>
      {type === "Existing Customer" && (
        <Item label="Referring customer" full>
          {draft.referredByCustomerId ? (
            <span className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span>{draft.referredByCustomerName || draft.referrerName}</span>
              <button type="button" className="text-xs text-emerald-800 hover:underline"
                onClick={() => patch({ referredByCustomerId: "", referredByCustomerName: "", referrerName: "", referrerContact: "" })}>Change</button>
            </span>
          ) : (
            <ExistingCustomerSearch placeholder="Search the customer who referred..."
              onPick={(id, c) => patch({ referredByCustomerId: String(id), referredByCustomerName: c?.name || "", referrerName: c?.name || "", referrerContact: c?.phone || "" })} />
          )}
        </Item>
      )}
      {type === "Employee" && (
        <Item label="Referring employee">
          <select className={inputCls} value={draft.referredByEmployeeId}
            onChange={(e) => patch({ referredByEmployeeId: e.target.value, referrerName: users.find((u) => u.id === Number(e.target.value))?.name || "" })}>
            <option value="">Select employee...</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Item>
      )}
      {type === "Other" && (
        <>
          <Item label="Referrer name"><BaseInput className={inputCls} value={draft.referrerName} onChange={(e) => patch({ referrerName: e.target.value })} /></Item>
          <Item label="Referrer contact"><BaseInput className={inputCls} type="tel" inputMode="tel" value={draft.referrerContact} onChange={(e) => patch({ referrerContact: e.target.value })} /></Item>
        </>
      )}
      {type && (
        <Item label="Referral notes" full>
          <textarea className={areaCls} rows={2} value={draft.referralNotes} onChange={(e) => patch({ referralNotes: e.target.value })} />
        </Item>
      )}
    </Dl>
  );
}
