import { useEffect, useState } from "react";
import { AlertTriangle, Check, Star, X } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";
import { leadApi } from "./leadApi";
import {
  CONSTRUCTION_STATUSES, ENQUIRY_TYPES, LEAD_SOURCES, LEAD_TYPES, PRIORITIES, REFERRAL_TYPES, TEMPERATURES,
  formatDate, type Lead, type UserSummary,
} from "./constants";
import { CheckboxField } from "./fields";
import { enquiryLabel, enquiryTypeOf, splitList } from "./enquiry";
import { Chip, F, Step, areaCls, inDays } from "./formSteps";
import MultiImageCaptureField, { type CapturedImage } from "@/components/MultiImageCaptureField";
import AudioCaptureField, { type CapturedAudio } from "@/components/AudioCaptureField";

const EMPTY_FORM: Partial<Lead> = {
  name: "", mobileNumber: "", priority: "Medium", leadTemperature: "Warm", status: "New",
};

// Catalog rows the requirement pickers read from the public website catalog endpoints.
type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; slug: string; categorySlug?: string };
type CatalogService = { id: number; title: string; slug: string };
type DupLead = { id: number; leadNumber: string; name: string; status: string; mobileNumber: string };

// The form is a stack of numbered steps; each opens/closes on its own. Only the first two are
// open for a new lead so the screen stays short — the rest are optional extras.
type StepKey = "customer" | "enquiry" | "source" | "contact" | "media" | "property" | "plan";
const STEP_ORDER: StepKey[] = ["customer", "enquiry", "source", "contact", "media", "property", "plan"];

const SCOPE_ITEMS: [keyof Lead, string][] = [
  ["reqKitchen", "Modular Kitchen"], ["reqWardrobe", "Wardrobe"], ["reqTvUnit", "TV Unit"],
  ["reqFalseCeiling", "False Ceiling"], ["reqPainting", "Painting"], ["reqFlooring", "Flooring"],
  ["reqElectrical", "Electrical"], ["reqPlumbing", "Plumbing"], ["reqWoodFinish", "Wood Finish"],
];

const FOLLOW_UP_CHIPS = [
  { label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 },
];

const selectCls = "w-full h-9 rounded-md border border-input bg-card px-2.5 text-sm";

// ---------------------------------------------------------------------------

export default function LeadFormDialog({
  open, onOpenChange, lead, users, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null; // when set → edit mode
  users: UserSummary[];
  onSaved: (saved: Lead) => void;
}) {
  const [form, setForm] = useState<Partial<Lead>>(EMPTY_FORM);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [audioClips, setAudioClips] = useState<CapturedAudio[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [dupLeads, setDupLeads] = useState<DupLead[]>([]);
  const [openSteps, setOpenSteps] = useState<Set<StepKey>>(new Set(["customer", "enquiry"]));
  const [customDate, setCustomDate] = useState(false);

  useEffect(() => {
    if (open) {
      // Legacy leads have no enquiry tag yet — infer it so the right picker shows when editing.
      setForm(lead ? { ...lead, enquiryType: enquiryTypeOf(lead) } : { ...EMPTY_FORM });
      setImages([]);
      setAudioClips([]);
      setError("");
      setDupLeads([]);
      setCustomDate(false);
      setOpenSteps(new Set(["customer", "enquiry"]));
    }
  }, [open, lead]);

  // Requirement pickers read the public website catalog (categories, products, services). Load
  // once when the dialog first opens; failures leave the pickers empty but never block saving.
  useEffect(() => {
    if (!open || categories.length) return;
    api.get("/public/categories").then((res) => setCategories(res.data || [])).catch(() => {});
    api.get("/public/products").then((res) => setProducts(res.data || [])).catch(() => {});
    api.get("/public/services").then((res) => setServices(res.data || [])).catch(() => {});
  }, [open, categories.length]);

  const selectedCategory = categories.find((c) => c.name === form.requirementCategory);
  const productOptions = products
    .filter((p) => !selectedCategory || p.categorySlug === selectedCategory.slug)
    .map((p) => p.name);

  // A lead can carry several products; they are stored comma-separated in requirementProduct.
  // The category only filters which products the picker lists — chosen products persist even
  // after the category is switched, so a lead can span categories.
  const selectedProducts = splitList(form.requirementProduct);
  const applyProducts = (names: string[]) => setForm((f) => ({ ...f, requirementProduct: names.join(", ") }));
  const addProduct = (name: string) => {
    if (name && !selectedProducts.includes(name)) applyProducts([...selectedProducts, name]);
  };
  const removeProduct = (name: string) => applyProducts(selectedProducts.filter((p) => p !== name));

  // Services work the same way — several can be picked, stored comma-separated.
  const selectedServices = splitList(form.requirementService);
  const toggleService = (name: string) => {
    const next = selectedServices.includes(name)
      ? selectedServices.filter((s) => s !== name)
      : [...selectedServices, name];
    setForm((f) => ({ ...f, requirementService: next.join(", ") }));
  };

  const set = (key: keyof Lead) => (value: any) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const isOpen = (k: StepKey) => openSteps.has(k);
  const toggle = (k: StepKey) => setOpenSteps((s) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const goNext = (k: StepKey) => setOpenSteps((s) => {
    const next = new Set(s);
    next.delete(k);
    const after = STEP_ORDER[STEP_ORDER.indexOf(k) + 1];
    if (after) next.add(after);
    return next;
  });

  // Live duplicate guard: as a new lead's phone number is entered, look for existing leads on
  // the same number so the user can open that lead instead of creating a duplicate. Never blocks.
  useEffect(() => {
    if (lead) { setDupLeads([]); return; } // only while creating
    const digits = (form.mobileNumber || "").replace(/\D/g, "");
    if (digits.length < 7) { setDupLeads([]); return; }
    const t = setTimeout(() => {
      api.get(`/leads?search=${encodeURIComponent(digits)}&size=5`)
        .then((res) => {
          const rows = (res.data?.content || []) as DupLead[];
          setDupLeads(rows.filter((r) =>
            [r.mobileNumber, (r as any).alternateMobile, (r as any).whatsappNumber]
              .filter(Boolean)
              .some((m: string) => m.replace(/\D/g, "").includes(digits))
          ));
        })
        .catch(() => setDupLeads([]));
    }, 400);
    return () => clearTimeout(t);
  }, [form.mobileNumber, lead]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Name + phone live in step 1, which may be collapsed — validate here and reopen it.
    if (!form.name?.trim() || !form.mobileNumber?.trim()) {
      setOpenSteps((s) => new Set(s).add("customer"));
      setError("Customer name and phone number are required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload: any = { ...form };
    // strip empty strings for numeric/date fields so Jackson doesn't choke
    ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue",
      "areaSqft", "expectedWorkArea", "floorCount", "rating"].forEach((k) => {
      if (payload[k] === "" || payload[k] === null) delete payload[k];
    });
    ["expectedStartDate", "expectedEndDate", "preferredCompletionDate", "nextFollowUpDate"].forEach((k) => {
      if (!payload[k]) delete payload[k];
    });

    // Enquiry tag: keep only the detail that belongs to the chosen type, so switching from
    // "Service" to "Product" doesn't leave stale services behind.
    if (payload.enquiryType === "PRODUCT") {
      payload.requirementService = null; payload.requirementOther = null;
    } else if (payload.enquiryType === "SERVICE") {
      payload.requirementCategory = null; payload.requirementProduct = null; payload.requirementOther = null;
    } else if (payload.enquiryType === "OTHER") {
      payload.requirementCategory = null; payload.requirementProduct = null; payload.requirementService = null;
    }

    // assignment: send just the id references
    if (payload.assignedSalesExecutive?.id) payload.assignedSalesExecutive = { id: payload.assignedSalesExecutive.id };
    else delete payload.assignedSalesExecutive;
    if (payload.assignedDesigner?.id) payload.assignedDesigner = { id: payload.assignedDesigner.id };
    else delete payload.assignedDesigner;
    if (payload.assignedEngineer?.id) payload.assignedEngineer = { id: payload.assignedEngineer.id };
    else delete payload.assignedEngineer;
    delete payload.projectManager;
    delete payload.convertedToCustomer;
    delete payload.convertedToProject;

    // Referral references: send just the id, and only for referral leads — clear the whole block
    // otherwise so switching source away from "Referral" doesn't carry stale referrer data.
    if (payload.leadSource === "Referral") {
      if (payload.referredByCustomer?.id) payload.referredByCustomer = { id: payload.referredByCustomer.id };
      else delete payload.referredByCustomer;
      if (payload.referredByEmployee?.id) payload.referredByEmployee = { id: payload.referredByEmployee.id };
      else delete payload.referredByEmployee;
    } else {
      payload.referralType = null;
      payload.referrerName = null;
      payload.referrerContact = null;
      payload.referralNotes = null;
      delete payload.referredByCustomer;
      delete payload.referredByEmployee;
    }

    const request = lead ? leadApi.update(lead.id, payload) : leadApi.create(payload);
    request
      .then(async (res) => {
        const savedLead = res.data;
        // Persist any images captured on the form as LeadDocuments so they travel to the
        // project on conversion (copyLeadDocumentsToProject reads lead documents).
        if (savedLead?.id && (images.length || audioClips.length)) {
          await Promise.all([
            ...images.map((img) =>
              leadApi.addDocument(savedLead.id, {
                fileName: img.fileName,
                fileUrl: img.url,
                category: "Site Photos",
                documentType: "Image",
              }).catch((e) => console.error("Failed to attach lead image", e))
            ),
            ...audioClips.map((clip) =>
              leadApi.addDocument(savedLead.id, {
                fileName: clip.fileName,
                fileUrl: clip.url,
                category: "Voice Notes",
                documentType: "Audio",
              }).catch((e) => console.error("Failed to attach lead audio", e))
            ),
          ]);
        }
        toast.success(lead ? "Lead updated" : `Lead ${savedLead?.leadNumber || ""} created`.trim());
        onOpenChange(false);
        onSaved(savedLead);
      })
      .catch((err) => {
        console.error("Failed to save lead", err);
        setError(err?.response?.data?.message || "Failed to save lead. Please check the required fields.");
      })
      .finally(() => setSaving(false));
  };

  const userPicker = (label: string, key: "assignedSalesExecutive" | "assignedDesigner" | "assignedEngineer") => (
    <F label={label}>
      <select
        className={selectCls}
        value={(form[key] as UserSummary | undefined)?.id ?? ""}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: e.target.value ? users.find((u) => u.id === Number(e.target.value)) : undefined,
          }))
        }
      >
        <option value="">Unassigned</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </F>
  );

  // --- Step summaries shown on a collapsed step header ---------------------
  const join = (...parts: (string | number | false | undefined | null)[]) => parts.filter(Boolean).join(" · ");
  const enquirySummary = (() => {
    const label = enquiryLabel(form.enquiryType);
    if (!label) return "";
    if (form.enquiryType === "SERVICE") return join(label, selectedServices.join(", "));
    if (form.enquiryType === "OTHER") return join(label, form.requirementOther);
    return join(label, form.requirementCategory, selectedProducts.join(", "));
  })();
  const scopeCount = SCOPE_ITEMS.filter(([k]) => form[k]).length;
  const summaries: Record<StepKey, string> = {
    customer: join(form.name, form.mobileNumber),
    enquiry: enquirySummary,
    source: join(
      form.leadSource,
      form.nextFollowUpDate && `Follow-up ${formatDate(form.nextFollowUpDate)}`,
      form.estimatedBudget && `₹${Number(form.estimatedBudget).toLocaleString("en-IN")}`,
      form.rating && `${form.rating}★`,
    ),
    contact: join(form.city, form.pincode, form.email, form.whatsappNumber && "WhatsApp"),
    media: join(images.length > 0 && `${images.length} photo${images.length > 1 ? "s" : ""}`,
      audioClips.length > 0 && `${audioClips.length} voice note${audioClips.length > 1 ? "s" : ""}`),
    property: join(form.propertyType, form.areaSqft && `${form.areaSqft} sq.ft`, scopeCount > 0 && `${scopeCount} work items`),
    plan: join(
      form.leadType,
      form.expectedProjectValue && `₹${Number(form.expectedProjectValue).toLocaleString("en-IN")}`,
      form.assignedSalesExecutive?.name,
    ),
  };

  const stepProps = (k: StepKey) => ({
    n: STEP_ORDER.indexOf(k) + 1,
    open: isOpen(k),
    onToggle: () => toggle(k),
    summary: summaries[k],
    onNext: STEP_ORDER.indexOf(k) < STEP_ORDER.length - 1 ? () => goNext(k) : undefined,
  });

  const followUpIsChip = FOLLOW_UP_CHIPS.some((c) => form.nextFollowUpDate === inDays(c.days));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-3.5 text-left">
          <DialogTitle className="text-base">{lead ? `Edit Lead ${lead.leadNumber}` : "New Lead"}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Only name and phone are required — open any step to add more.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {/* 1 — Customer */}
            <Step {...stepProps("customer")} title="Customer" hint="Name and phone number">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <F label="Customer name" required>
                  <Input autoFocus value={form.name ?? ""} onChange={text("name")} placeholder="Full name" />
                </F>
                <F label="Phone number" required>
                  <Input type="tel" inputMode="tel" autoComplete="tel" value={form.mobileNumber ?? ""}
                    onChange={text("mobileNumber")} placeholder="10-digit mobile" />
                </F>
              </div>
              {/* Duplicate guard: existing leads on the same number, so a duplicate isn't created. */}
              {dupLeads.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    This number is already on {dupLeads.length} lead{dupLeads.length > 1 ? "s" : ""}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {dupLeads.map((l) => (
                      <a
                        key={l.id}
                        href={`${import.meta.env.BASE_URL}leads/${l.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded bg-white/70 px-2 py-1 transition-colors hover:bg-white"
                      >
                        <span className="font-medium">{l.leadNumber} · {l.name}</span>
                        <span className="text-amber-700">{l.status} ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </Step>

            {/* 2 — Enquiry: Product / Service / Others */}
            <Step {...stepProps("enquiry")} title="Looking for" hint="Product, service or something else">
              <div className="flex flex-wrap gap-1.5">
                {ENQUIRY_TYPES.map((t) => (
                  <Chip key={t.value} active={form.enquiryType === t.value}
                    onClick={() => set("enquiryType")(form.enquiryType === t.value ? undefined : t.value)}>
                    {t.label}
                  </Chip>
                ))}
              </div>

              {form.enquiryType === "PRODUCT" && (
                <div className="space-y-3 rounded-md bg-muted/30 p-3">
                  <F label="Category">
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <Chip key={c.id} active={form.requirementCategory === c.name}
                          onClick={() => set("requirementCategory")(form.requirementCategory === c.name ? undefined : c.name)}>
                          {c.name}
                        </Chip>
                      ))}
                      {categories.length === 0 && <span className="text-xs text-muted-foreground">Loading categories…</span>}
                    </div>
                  </F>
                  <F label="Products">
                    {/* Add-and-reset picker: choosing an option appends it, then the select clears. */}
                    <select className={selectCls} value="" onChange={(e) => addProduct(e.target.value)}>
                      <option value="">Add a product…</option>
                      {productOptions.filter((p) => !selectedProducts.includes(p)).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {selectedProducts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedProducts.map((p) => (
                          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {p}
                            <button type="button" onClick={() => removeProduct(p)} aria-label={`Remove ${p}`} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </F>
                </div>
              )}

              {form.enquiryType === "SERVICE" && (
                <div className="rounded-md bg-muted/30 p-3">
                  <F label="Which service? (pick one or more)">
                    {services.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {services.map((s) => (
                          <Chip key={s.id} active={selectedServices.includes(s.title)} onClick={() => toggleService(s.title)}>
                            {selectedServices.includes(s.title) && <Check className="mr-1 inline h-3 w-3" />}
                            {s.title}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <Input value={form.requirementService ?? ""} onChange={text("requirementService")}
                        placeholder="e.g. Curtain installation, Repair" />
                    )}
                  </F>
                </div>
              )}

              {form.enquiryType === "OTHER" && (
                <div className="rounded-md bg-muted/30 p-3">
                  <F label="What are they looking for?">
                    <textarea className={areaCls} rows={2} value={form.requirementOther ?? ""}
                      onChange={text("requirementOther")} placeholder="Describe the enquiry" />
                  </F>
                </div>
              )}
            </Step>

            {/* 3 — Source & follow-up */}
            <Step {...stepProps("source")} title="Source & follow-up" hint="Where it came from, next call, budget">
              <F label="Lead source">
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_SOURCES.map((s) => (
                    <Chip key={s} active={form.leadSource === s}
                      onClick={() => set("leadSource")(form.leadSource === s ? undefined : s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </F>

              {/* When the lead came in via a referral, capture who referred it. */}
              {form.leadSource === "Referral" && (
                <div className="space-y-3 rounded-md bg-muted/30 p-3">
                  <F label="Referred by">
                    <div className="flex flex-wrap gap-1.5">
                      {REFERRAL_TYPES.map((r) => (
                        <Chip key={r} active={form.referralType === r}
                          onClick={() => setForm((f) => ({
                            ...f, referralType: r,
                            referredByCustomer: undefined, referredByEmployee: undefined,
                            referrerName: "", referrerContact: "",
                          }))}>
                          {r}
                        </Chip>
                      ))}
                    </div>
                  </F>

                  {form.referralType === "Existing Customer" && (
                    <F label="Referring customer">
                      {form.referredByCustomer?.id ? (
                        <div className="flex items-center justify-between rounded-md border bg-card px-3 py-1.5 text-sm">
                          <span className="font-medium">{form.referrerName || form.referredByCustomer.name}</span>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() => setForm((f) => ({ ...f, referredByCustomer: undefined, referrerName: "", referrerContact: "" }))}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <ExistingCustomerSearch
                          placeholder="Search the customer who referred..."
                          onPick={(id, c) => setForm((f) => ({
                            ...f,
                            referredByCustomer: { id, name: c?.name },
                            referrerName: c?.name || "",
                            referrerContact: c?.phone || "",
                          }))}
                        />
                      )}
                    </F>
                  )}

                  {form.referralType === "Employee" && (
                    <F label="Referring employee">
                      <select
                        className={selectCls}
                        value={form.referredByEmployee?.id ?? ""}
                        onChange={(e) => {
                          const u = users.find((x) => x.id === Number(e.target.value));
                          setForm((f) => ({ ...f, referredByEmployee: u, referrerName: u?.name || "" }));
                        }}
                      >
                        <option value="">Select employee...</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </F>
                  )}

                  {form.referralType === "Other" && (
                    <div className="grid grid-cols-2 gap-3">
                      <F label="Referrer name"><Input value={form.referrerName ?? ""} onChange={text("referrerName")} /></F>
                      <F label="Referrer contact">
                        <Input type="tel" inputMode="tel" value={form.referrerContact ?? ""} onChange={text("referrerContact")} />
                      </F>
                    </div>
                  )}

                  {form.referralType && (
                    <F label="Referral notes">
                      <textarea className={areaCls} rows={2} value={form.referralNotes ?? ""} onChange={text("referralNotes")} />
                    </F>
                  )}
                </div>
              )}

              <F label="Next follow-up">
                <div className="flex flex-wrap items-center gap-1.5">
                  {FOLLOW_UP_CHIPS.map((c) => {
                    const v = inDays(c.days);
                    return (
                      <Chip key={c.label} active={!customDate && form.nextFollowUpDate === v}
                        onClick={() => { setCustomDate(false); set("nextFollowUpDate")(form.nextFollowUpDate === v ? undefined : v); }}>
                        {c.label}
                      </Chip>
                    );
                  })}
                  <Chip active={customDate || (!!form.nextFollowUpDate && !followUpIsChip)} onClick={() => setCustomDate(true)}>
                    Pick date
                  </Chip>
                  {(customDate || (!!form.nextFollowUpDate && !followUpIsChip)) && (
                    <Input type="date" className="h-8 w-auto" value={form.nextFollowUpDate ?? ""} onChange={text("nextFollowUpDate")} />
                  )}
                </div>
              </F>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <F label="Estimated budget (₹)">
                  <Input type="number" inputMode="numeric" value={form.estimatedBudget ?? ""} onChange={text("estimatedBudget")} placeholder="Optional" />
                </F>
                <F label="Lead rating">
                  <div className="flex h-9 items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        // Click the current top star again to clear the rating.
                        onClick={() => set("rating")(star === form.rating ? undefined : star)}
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        className="p-0.5 text-muted-foreground/40 transition-transform hover:scale-110"
                      >
                        <Star className={`h-5 w-5 ${star <= (form.rating || 0) ? "fill-amber-400 text-amber-400" : ""}`} />
                      </button>
                    ))}
                  </div>
                </F>
              </div>
            </Step>

            {/* 4 — Contact & address */}
            <Step {...stepProps("contact")} title="Contact & address" hint="Optional — email, WhatsApp, location">
              <F label="Address">
                <textarea className={areaCls} rows={2} value={form.address ?? ""} onChange={text("address")} placeholder="Door no, street, area" />
              </F>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <F label="City"><Input value={form.city ?? ""} onChange={text("city")} /></F>
                <F label="Pincode"><Input inputMode="numeric" value={form.pincode ?? ""} onChange={text("pincode")} /></F>
                <F label="District"><Input value={form.district ?? ""} onChange={text("district")} /></F>
                <F label="State"><Input value={form.state ?? ""} onChange={text("state")} /></F>
                <F label="WhatsApp"><Input type="tel" inputMode="tel" value={form.whatsappNumber ?? ""} onChange={text("whatsappNumber")} /></F>
                <F label="Alternate mobile"><Input type="tel" inputMode="tel" value={form.alternateMobile ?? ""} onChange={text("alternateMobile")} /></F>
                <F label="Email" className="col-span-2 sm:col-span-1"><Input type="email" value={form.email ?? ""} onChange={text("email")} /></F>
                <F label="Company"><Input value={form.companyName ?? ""} onChange={text("companyName")} /></F>
                <F label="Contact person"><Input value={form.contactPerson ?? ""} onChange={text("contactPerson")} /></F>
                <F label="GST number"><Input value={form.gstNumber ?? ""} onChange={text("gstNumber")} /></F>
              </div>
              <F label="Site address (if different)">
                <textarea className={areaCls} rows={2} value={form.siteAddress ?? ""} onChange={text("siteAddress")} />
              </F>
            </Step>

            {/* 5 — Photos & voice notes */}
            <Step {...stepProps("media")} title="Photos & voice notes" hint="Optional — site photos, recorded requirement">
              <MultiImageCaptureField label="Capture or add photos (property, site, reference)" module="LEAD" value={images} onChange={setImages} />
              <AudioCaptureField label="Record or upload a voice note" module="LEAD" value={audioClips} onChange={setAudioClips} />
            </Step>

            {/* 6 — Property & scope */}
            <Step {...stepProps("property")} title="Property & scope" hint="Optional — property details and work required">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <F label="Property type"><Input value={form.propertyType ?? ""} onChange={text("propertyType")} placeholder="Flat, House…" /></F>
                <F label="Construction status">
                  <select className={selectCls} value={form.currentConstructionStage ?? ""} onChange={text("currentConstructionStage")}>
                    <option value="">Select…</option>
                    {CONSTRUCTION_STATUSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </F>
                <F label="Floors"><Input type="number" value={form.floorCount ?? ""} onChange={text("floorCount")} /></F>
                <F label="Area (sq.ft)"><Input type="number" value={form.areaSqft ?? ""} onChange={text("areaSqft")} /></F>
                <F label="Preferred materials"><Input value={form.preferredMaterial ?? ""} onChange={text("preferredMaterial")} /></F>
                <F label="Design style"><Input value={form.preferredDesignStyle ?? ""} onChange={text("preferredDesignStyle")} placeholder="Modern…" /></F>
              </div>
              <F label="Work required">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {SCOPE_ITEMS.map(([key, label]) => (
                    <CheckboxField key={key} label={label} checked={form[key] as boolean} onChange={set(key)} />
                  ))}
                </div>
              </F>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <F label="Rooms required">
                  <textarea className={areaCls} rows={2} value={form.roomsRequired ?? ""} onChange={text("roomsRequired")} placeholder="3 Bedrooms, Living…" />
                </F>
                <F label="Special requests">
                  <textarea className={areaCls} rows={2} value={form.specialRequests ?? ""} onChange={text("specialRequests")} />
                </F>
              </div>
              <F label="Requirement description">
                <textarea className={areaCls} rows={2} value={form.projectDescription ?? ""} onChange={text("projectDescription")} />
              </F>
            </Step>

            {/* 7 — Plan & team */}
            <Step {...stepProps("plan")} title="Priority, timeline & team" hint="Optional — classification, dates, assignment">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <F label="Priority">
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => <Chip key={p} active={form.priority === p} onClick={() => set("priority")(p)}>{p}</Chip>)}
                  </div>
                </F>
                <F label="Temperature">
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPERATURES.map((t) => <Chip key={t} active={form.leadTemperature === t} onClick={() => set("leadTemperature")(t)}>{t}</Chip>)}
                  </div>
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <F label="Lead type">
                  <select className={selectCls} value={form.leadType ?? ""} onChange={text("leadType")}>
                    <option value="">Select…</option>
                    {LEAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </F>
                <F label="Project value (₹)">
                  <Input type="number" value={form.expectedProjectValue ?? ""} onChange={text("expectedProjectValue")} />
                </F>
                <F label="Expected start"><Input type="date" value={form.expectedStartDate ?? ""} onChange={text("expectedStartDate")} /></F>
                <F label="Expected completion"><Input type="date" value={form.expectedEndDate ?? ""} onChange={text("expectedEndDate")} /></F>
                {userPicker("Sales executive", "assignedSalesExecutive")}
                {userPicker("Designer", "assignedDesigner")}
                {userPicker("Engineer", "assignedEngineer")}
              </div>
            </Step>
          </div>

          {/* Sticky footer — Save is always reachable without scrolling. */}
          <div className="flex items-center gap-2 border-t bg-card px-4 py-3">
            {error ? (
              <p className="flex-1 text-xs text-destructive">{error}</p>
            ) : (
              <p className="flex-1 truncate text-xs text-muted-foreground">
                {summaries.customer || "Fill in the customer to continue"}
              </p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving..." : lead ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
