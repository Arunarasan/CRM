import { BaseInput } from '@/components/ui/input';
import { useEffect, useState } from "react";
import {
  Pencil, Check, X, Star, Users, MapPin, Home, ListChecks, Share2, XCircle, Sparkles, Phone,
  MessageCircle, Contact as ContactIcon, Navigation, Plus, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import api from "@/lib/api";
import { leadApi } from "../leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, PRIORITIES, REFERRAL_TYPES, TEMPERATURES,
  formatDate, formatDateTime, formatFollowUp, formatINR, avatarColor, initials,
  type Lead, type UserSummary,
} from "../constants";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";
import { EnquiryTag, enquiryDetails, enquiryTypeOf } from "../enquiry";

// The Overview is ONE "Lead details" card. Read mode shows only what has actually been entered,
// grouped into sections (a section with nothing filled in disappears) plus a "Not filled yet" line so
// gaps stay discoverable. One Edit turns the whole card into a single form with one Save — the lead
// fields go through the full-lead update (a full replace, so edits are merged onto the whole lead),
// the team through the assignment endpoint and the referral through its own endpoint.

type IconType = React.ComponentType<{ className?: string }>;
type Kind = "text" | "tel" | "email" | "number" | "money" | "date" | "select" | "area";
type Custom = "category" | "products" | "scope" | "rating" | "phone" | "map";

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

const SECTIONS: { id: string; title: string; icon: IconType; wide?: boolean; fields: FieldDef[] }[] = [
  {
    id: "requirement", title: "Requirement", icon: ListChecks, wide: true,
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
    id: "contact", title: "Contact", icon: ContactIcon,
    fields: [
      { key: "name", label: "Customer name" },
      { key: "mobileNumber", label: "Mobile", kind: "tel", custom: "phone" },
      { key: "alternateMobile", label: "Alternate mobile", kind: "tel" },
      { key: "whatsappNumber", label: "WhatsApp", kind: "tel" },
      { key: "email", label: "Email", kind: "email" },
      { key: "companyName", label: "Company" },
      { key: "contactPerson", label: "Contact person" },
      { key: "gstNumber", label: "GST number" },
    ],
  },
  {
    id: "location", title: "Location", icon: MapPin,
    fields: [
      { key: "siteAddress", label: "Site address", kind: "area", full: true, custom: "map" },
      { key: "address", label: "Address", kind: "area", full: true, custom: "map" },
      { key: "landmark", label: "Landmark" },
      { key: "city", label: "City" },
      { key: "district", label: "District" },
      { key: "state", label: "State" },
      { key: "pincode", label: "Pincode", kind: "number" },
    ],
  },
  {
    id: "property", title: "Property", icon: Home,
    fields: [
      { key: "propertyType", label: "Property type", placeholder: "e.g. Flat" },
      { key: "propertyName", label: "Property / building" },
      { key: "currentConstructionStage", label: "Construction status", kind: "select", options: CONSTRUCTION_STATUSES },
      { key: "floorCount", label: "Floors", kind: "number" },
      { key: "areaSqft", label: "Area (sq.ft)", kind: "number" },
      { key: "expectedWorkArea", label: "Work area (sq.ft)", kind: "number" },
      { key: "preferredDesignStyle", label: "Design style", placeholder: "e.g. Modern" },
      { key: "preferredMaterial", label: "Preferred material" },
      { key: "preferredColorTheme", label: "Colour theme" },
      { key: "estimatedDuration", label: "Duration" },
    ],
  },
  {
    id: "deal", title: "Deal", icon: Sparkles,
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
      { key: "expectedStartDate", label: "Expected start", kind: "date" },
      { key: "expectedEndDate", label: "Expected completion", kind: "date" },
      { key: "preferredCompletionDate", label: "Customer's target date", kind: "date" },
    ],
  },
];

const TEAM_ROLES = ["Sales Executive", "Designer", "Engineer", "Project Manager"] as const;
type Role = (typeof TEAM_ROLES)[number];
type TeamDraft = Record<Role, string>;

type ReferralDraft = {
  referralType: string; referredByCustomerId: string; referredByCustomerName: string;
  referredByEmployeeId: string; referrerName: string; referrerContact: string; referralNotes: string;
};

const LEAD_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key))
  .concat(SCOPE_FLAGS.map(([k]) => k));

const KEY_FIELDS = [
  "requirementProduct", "estimatedBudget", "siteAddress", "propertyType", "areaSqft",
  "roomsRequired", "whatsappNumber", "expectedStartDate",
];
const keyRank = (k: string) => { const i = KEY_FIELDS.indexOf(k); return i < 0 ? KEY_FIELDS.length : i; };

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
  const [draft, setDraft] = useState<Record<string, any>>(() => seedLead(lead));
  const [team, setTeam] = useState<TeamDraft>(() => seedTeam(lead));
  const [referral, setReferral] = useState<ReferralDraft>(() => seedReferral(lead));
  const [categories, setCategories] = useState<{ id: number; name: string; slug: string }[]>([]);
  const [catalog, setCatalog] = useState<{ id: number; name: string; categorySlug?: string }[]>([]);

  // The website catalogue powers the category + product pickers (fetched once, on first edit).
  useEffect(() => {
    if (!editing || categories.length) return;
    api.get("/public/categories").then((r) => setCategories(r.data || [])).catch(() => {});
    api.get("/public/products").then((r) => setCatalog(r.data || [])).catch(() => {});
  }, [editing, categories.length]);

  const start = () => {
    setDraft(seedLead(lead)); setTeam(seedTeam(lead)); setReferral(seedReferral(lead)); setEditing(true);
  };
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
  // Gaps that matter most for pricing and visiting come first.
  const missing = [
    ...SECTIONS.flatMap((s) => s.fields.filter((f) => !hasValue(lead, f)))
      .sort((x, y) => keyRank(x.key) - keyRank(y.key)).map((f) => f.label),
    ...(assigned.length === 0 ? ["Team"] : []),
  ];
  const enquiry = enquiryTypeOf(lead);

  return (
    <section className="@container rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" aria-label="Lead details">
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <h2 className="font-bold tracking-tight text-slate-900">{editing ? "Edit lead details" : "Lead details"}</h2>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {editing ? "All fields — leave anything you don't know empty." : "Only the details that have been filled in."}
          </p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={start} className="h-9 rounded-lg border-slate-200 font-semibold text-slate-700 shrink-0">
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      <div className="px-4 sm:px-5 py-4 space-y-6">
        {lead.status === "Lost" && !editing && (
          <Block icon={XCircle} title="Why it was lost" tone="text-rose-600">
            <Dl>
              {lead.lostReason && <Item label="Reason">{lead.lostReason}</Item>}
              {lead.competitor && <Item label="Went with">{lead.competitor}</Item>}
              {lead.customerFeedback && <Item label="Customer feedback" full>{lead.customerFeedback}</Item>}
            </Dl>
          </Block>
        )}

        {enquiry && !editing && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Looking for</span>
            <EnquiryTag type={enquiry} />
            {enquiryDetails(lead).map((d) => (
              <span key={d} className="px-2.5 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full font-medium">{d}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 @4xl:grid-cols-2 gap-x-10 gap-y-6">
          {SECTIONS.map((s) => {
            const shown = editing ? s.fields : s.fields.filter((f) => hasValue(lead, f));
            if (!shown.length) return null;
            return (
              <Block key={s.id} icon={s.icon} title={s.title} className={s.wide ? "@4xl:col-span-2" : ""}>
                <Dl>
                  {shown.map((f) => (
                    <Item key={f.key} label={f.label} full={f.full}
                      action={!editing && f.custom === "map"
                        ? <MapsLink parts={[(lead as any)[f.key], lead.city, lead.district, lead.state, lead.pincode]} />
                        : !editing && f.custom === "phone" && lead.mobileNumber ? <PhoneActions lead={lead} /> : null}>
                      {editing ? renderEditor(f) : renderValue(f)}
                    </Item>
                  ))}
                </Dl>
              </Block>
            );
          })}

          {(editing || assigned.length > 0) && (
            <Block icon={Users} title="Team">
              {editing ? (
                <Dl>
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
                <ul className="grid grid-cols-1 @md:grid-cols-2 gap-2">
                  {assigned.map((r) => {
                    const name = teamOf(lead)[r]!.name!;
                    return (
                      <li key={r} className="flex items-center gap-2.5 min-w-0">
                        <span className={`h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${avatarColor(name)}`}>{initials(name)}</span>
                        <span className="min-w-0">
                          <span className="block text-[11px] text-slate-500">{r}</span>
                          <span className="block text-sm font-medium text-slate-800 truncate">{name}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Block>
          )}

          {(editing || hasReferral) && (
            <Block icon={Share2} title="Referral">
              {editing
                ? <ReferralEditor draft={referral} patch={(p) => setReferral((r) => ({ ...r, ...p }))} users={users} />
                : (
                  <Dl>
                    {lead.referralType && <Item label="Referred by">{lead.referralType}</Item>}
                    {(lead.referredByCustomer?.name || lead.referredByEmployee?.name || lead.referrerName) && (
                      <Item label="Referrer">{lead.referredByCustomer?.name || lead.referredByEmployee?.name || lead.referrerName}</Item>
                    )}
                    {lead.referrerContact && <Item label="Referrer contact">{lead.referrerContact}</Item>}
                    {lead.referralNotes && <Item label="Notes" full>{lead.referralNotes}</Item>}
                  </Dl>
                )}
            </Block>
          )}
        </div>

        {/* What's still unknown — kept visible so gaps get filled, but out of the way. */}
        {!editing && missing.length > 0 && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-xs font-semibold text-slate-600">Not filled yet ({missing.length})</span>
            <span className="text-xs text-slate-400 min-w-0 flex-1">
              {missing.slice(0, 8).join(" · ")}{missing.length > 8 ? ` · +${missing.length - 8} more` : ""}
            </span>
            {canEdit && (
              <button type="button" onClick={start} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline shrink-0">
                <Plus className="h-3.5 w-3.5" /> Add details
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer: system facts (read) or the single save bar (edit). */}
      {editing ? (
        <div className="sticky bottom-16 md:bottom-0 z-10 flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-white/95 backdrop-blur px-4 sm:px-5 py-3">
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}><X className="h-4 w-4 mr-1" /> Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-800 hover:bg-emerald-900 text-white">
            <Check className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 sm:px-5 py-2.5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Created {formatDateTime(lead.createdAt)}{lead.createdBy ? ` by ${lead.createdBy}` : ""}</span>
          {lead.stage && <span>Stage: <span className="font-medium text-slate-700">{lead.stage}</span></span>}
          <span>{lead.followUpCount ?? 0} follow-up{lead.followUpCount === 1 ? "" : "s"} logged</span>
          {lead.nextFollowUpDate && <span>Next follow-up: <span className="font-medium text-slate-700">{formatFollowUp(lead.nextFollowUpDate, lead.nextFollowUpTime)}</span></span>}
          {lead.lastContactAt && <span>Last contact: {formatDate(lead.lastContactAt)}</span>}
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
function Block({ icon: Icon, title, tone, className, children }: {
  icon: IconType; title: string; tone?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`@container min-w-0 ${className || ""}`}>
      <h3 className={`mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${tone || "text-slate-400"}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </div>
  );
}

function Dl({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-1 @xs:grid-cols-2 @2xl:grid-cols-3 gap-x-6 gap-y-3">{children}</dl>;
}

function Item({ label, full, action, children }: { label: string; full?: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 ${full ? "col-span-full" : ""}`}>
      <dt className="flex items-center justify-between gap-2 text-xs text-slate-500">{label}{action}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 break-words">{children}</dd>
    </div>
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

function PhoneActions({ lead }: { lead: Lead }) {
  return (
    <span className="flex items-center gap-1">
      <a href={`tel:${lead.mobileNumber}`} className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center hover:bg-emerald-100" title="Call" aria-label="Call">
        <Phone className="h-3 w-3" />
      </a>
      <a href={`https://wa.me/${(lead.whatsappNumber || lead.mobileNumber).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
        className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center hover:bg-emerald-100" title="WhatsApp" aria-label="WhatsApp">
        <MessageCircle className="h-3 w-3" />
      </a>
    </span>
  );
}

function ReferralEditor({ draft, patch, users }: {
  draft: ReferralDraft; patch: (p: Partial<ReferralDraft>) => void; users: UserSummary[];
}) {
  const type = draft.referralType;
  return (
    <Dl>
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
