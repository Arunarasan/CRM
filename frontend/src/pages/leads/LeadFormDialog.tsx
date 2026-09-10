import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import ExistingCustomerSearch from "@/pages/customers/ExistingCustomerSearch";
import { leadApi } from "./leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, PRIORITIES, REFERRAL_TYPES, TEMPERATURES,
  type Lead, type UserSummary,
} from "./constants";
import { CheckboxField, SectionTitle, SelectField, selectClass, StarRating, TextAreaField, TextField } from "./fields";
import MultiImageCaptureField, { type CapturedImage } from "@/components/MultiImageCaptureField";
import AudioCaptureField, { type CapturedAudio } from "@/components/AudioCaptureField";

const EMPTY_FORM: Partial<Lead> = {
  name: "", mobileNumber: "", priority: "Medium", leadTemperature: "Warm", status: "New",
};

// Catalog rows the requirement pickers read from the public website catalog endpoints.
type CatalogCategory = { id: number; name: string; slug: string };
type CatalogProduct = { id: number; name: string; slug: string; categorySlug?: string };
type DupLead = { id: number; leadNumber: string; name: string; status: string; mobileNumber: string };

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
  const [dupLeads, setDupLeads] = useState<DupLead[]>([]);
  // Advanced sections (project, budget, assignment, images) stay collapsed for a new lead so
  // the create form is short; an existing lead opens expanded so all its data is visible.
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(lead ? { ...lead } : { ...EMPTY_FORM });
      setImages([]);
      setAudioClips([]);
      setError("");
      setShowMore(!!lead);
      setDupLeads([]);
    }
  }, [open, lead]);

  // Requirement pickers read the public website catalog (categories + products). Load once
  // when the dialog first opens; failures leave the dropdowns empty but never block saving.
  useEffect(() => {
    if (!open || categories.length) return;
    api.get("/public/categories").then((res) => setCategories(res.data || [])).catch(() => {});
    api.get("/public/products").then((res) => setProducts(res.data || [])).catch(() => {});
  }, [open, categories.length]);

  const selectedCategory = categories.find((c) => c.name === form.requirementCategory);
  const productOptions = products
    .filter((p) => !selectedCategory || p.categorySlug === selectedCategory.slug)
    .map((p) => p.name);

  // A lead can carry several products; they are stored comma-separated in requirementProduct.
  // The category above only filters which products the picker lists — chosen products persist
  // even after the category is switched, so a lead can span categories.
  const selectedProducts = (form.requirementProduct || "").split(",").map((s) => s.trim()).filter(Boolean);
  const applyProducts = (names: string[]) => setForm((f) => ({ ...f, requirementProduct: names.join(", ") }));
  const addProduct = (name: string) => {
    if (name && !selectedProducts.includes(name)) applyProducts([...selectedProducts, name]);
  };
  const removeProduct = (name: string) => applyProducts(selectedProducts.filter((p) => p !== name));

  const set = (key: keyof Lead) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

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
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={(form[key] as UserSummary | undefined)?.id ?? ""}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: e.target.value ? users.find((u) => u.id === Number(e.target.value)) : undefined,
          }))
        }
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? `Edit Lead ${lead.leadNumber}` : "Create New Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Essentials — the only fields shown when creating a lead. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Customer Name" required value={form.name} onChange={set("name")} placeholder="Full name / lead title" />
            <TextField label="Phone Number" required type="tel" inputMode="tel" autoComplete="tel" value={form.mobileNumber} onChange={set("mobileNumber")} placeholder="10-digit mobile" />
          </div>

          {/* Duplicate guard: existing leads on the same number, so a duplicate isn't created. */}
          {dupLeads.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This number is already on {dupLeads.length} lead{dupLeads.length > 1 ? "s" : ""}
              </div>
              <div className="mt-1.5 space-y-1">
                {dupLeads.map((l) => (
                  <a
                    key={l.id}
                    href={`${import.meta.env.BASE_URL}leads/${l.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md bg-white/70 px-2 py-1 hover:bg-white transition-colors"
                  >
                    <span className="font-medium">{l.leadNumber} · {l.name}</span>
                    <span className="text-xs text-amber-700">{l.status} ↗</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectField label="Lead Source" value={form.leadSource} onChange={set("leadSource")} options={LEAD_SOURCES} />
            <SelectField
              label="Requirement Category"
              value={form.requirementCategory}
              onChange={set("requirementCategory")}
              options={categories.map((c) => c.name)}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Products</label>
              {/* Add-and-reset picker: choosing an option appends it, then the select clears. */}
              <select
                className={selectClass}
                value=""
                onChange={(e) => addProduct(e.target.value)}
              >
                <option value="">Add a product...</option>
                {productOptions.filter((p) => !selectedProducts.includes(p)).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProducts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProducts.map((p) => (
                <span key={p} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  {p}
                  <button type="button" onClick={() => removeProduct(p)} aria-label={`Remove ${p}`} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <TextAreaField label="Address" rows={2} value={form.address} onChange={set("address")} />

          {/* Attachments — available right at creation so field/office staff can capture site
              photos and record a voice note describing the requirement without expanding. */}
          <div className="rounded-lg border bg-muted/20 p-3 space-y-4">
            <SectionTitle>Photos &amp; Voice Notes</SectionTitle>
            <MultiImageCaptureField
              label="Capture or add photos (property, site, reference)"
              module="LEAD"
              value={images}
              onChange={setImages}
            />
            <AudioCaptureField
              label="Record or upload a voice note"
              module="LEAD"
              value={audioClips}
              onChange={setAudioClips}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField label="Next Follow-up Date" type="date" value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} />
            <TextField label="Estimated Budget (₹)" type="number" inputMode="numeric" value={form.estimatedBudget} onChange={set("estimatedBudget")} />
            <StarRating label="Rating" value={form.rating} onChange={set("rating")} />
          </div>

          {/* When the lead came in via a referral, capture who referred it (an existing customer,
              a staff member, or an external person). */}
          {form.leadSource === "Referral" && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <SectionTitle>Referral Details</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SelectField
                  label="Referred By"
                  value={form.referralType}
                  onChange={(v) => setForm((f) => ({
                    ...f, referralType: v,
                    referredByCustomer: undefined, referredByEmployee: undefined,
                    referrerName: "", referrerContact: "",
                  }))}
                  options={REFERRAL_TYPES}
                />
              </div>

              {form.referralType === "Existing Customer" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Referring Customer</label>
                  {form.referredByCustomer?.id ? (
                    <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
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
                </div>
              )}

              {form.referralType === "Employee" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Referring Employee</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.referredByEmployee?.id ?? ""}
                    onChange={(e) => {
                      const u = users.find((x) => x.id === Number(e.target.value));
                      setForm((f) => ({ ...f, referredByEmployee: u, referrerName: u?.name || "" }));
                    }}
                  >
                    <option value="">Select employee...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {form.referralType === "Other" && (
                <div className="grid grid-cols-2 gap-4">
                  <TextField label="Referrer Name" value={form.referrerName} onChange={set("referrerName")} />
                  <TextField label="Referrer Contact" type="tel" inputMode="tel" value={form.referrerContact} onChange={set("referrerContact")} />
                </div>
              )}

              <TextAreaField label="Referral Notes" rows={2} value={form.referralNotes} onChange={set("referralNotes")} />
            </div>
          )}

          {!showMore ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ChevronDown className="h-4 w-4" /> Add contact, address, project &amp; budget details
            </button>
          ) : (
          <>
          <SectionTitle>Classification</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <SelectField label="Lead Type" value={form.leadType} onChange={set("leadType")} options={LEAD_TYPES} />
            <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} allowEmpty={false} />
            <SelectField label="Lead Temperature" value={form.leadTemperature} onChange={set("leadTemperature")} options={TEMPERATURES} allowEmpty={false} />
          </div>

          <SectionTitle>Customer Information</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Company Name" value={form.companyName} onChange={set("companyName")} />
            <TextField label="Contact Person" value={form.contactPerson} onChange={set("contactPerson")} />
            <TextField label="Alternative Mobile" type="tel" inputMode="tel" value={form.alternateMobile} onChange={set("alternateMobile")} />
            <TextField label="WhatsApp Number" type="tel" inputMode="tel" value={form.whatsappNumber} onChange={set("whatsappNumber")} />
            <TextField label="Email" type="email" value={form.email} onChange={set("email")} />
            <TextField label="GST Number" value={form.gstNumber} onChange={set("gstNumber")} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TextField label="City" value={form.city} onChange={set("city")} />
            <TextField label="District" value={form.district} onChange={set("district")} />
            <TextField label="State" value={form.state} onChange={set("state")} />
            <TextField label="Pincode" inputMode="numeric" value={form.pincode} onChange={set("pincode")} />
            <div className="col-span-2 md:col-span-4">
              <TextAreaField label="Project / Site Address" rows={2} value={form.siteAddress} onChange={set("siteAddress")} />
            </div>
          </div>

          <SectionTitle>Property & Requirements</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Property Type" value={form.propertyType} onChange={set("propertyType")} placeholder="e.g. Flat, Independent House" />
            <SelectField label="Construction Status" value={form.currentConstructionStage} onChange={set("currentConstructionStage")} options={CONSTRUCTION_STATUSES} />
            <TextField label="Number of Floors" type="number" value={form.floorCount} onChange={set("floorCount")} />
            <TextField label="Area (sq.ft)" type="number" value={form.areaSqft} onChange={set("areaSqft")} />
            <TextField label="Preferred Materials" value={form.preferredMaterial} onChange={set("preferredMaterial")} />
            <TextField label="Design Style" value={form.preferredDesignStyle} onChange={set("preferredDesignStyle")} placeholder="e.g. Modern, Contemporary" />
          </div>
          <TextAreaField label="Requirement Description" value={form.projectDescription} onChange={set("projectDescription")} />

          <SectionTitle>Scope of Work</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <CheckboxField label="Modular Kitchen" checked={form.reqKitchen} onChange={set("reqKitchen")} />
            <CheckboxField label="Wardrobe" checked={form.reqWardrobe} onChange={set("reqWardrobe")} />
            <CheckboxField label="TV Unit" checked={form.reqTvUnit} onChange={set("reqTvUnit")} />
            <CheckboxField label="False Ceiling" checked={form.reqFalseCeiling} onChange={set("reqFalseCeiling")} />
            <CheckboxField label="Painting" checked={form.reqPainting} onChange={set("reqPainting")} />
            <CheckboxField label="Flooring" checked={form.reqFlooring} onChange={set("reqFlooring")} />
            <CheckboxField label="Electrical" checked={form.reqElectrical} onChange={set("reqElectrical")} />
            <CheckboxField label="Plumbing" checked={form.reqPlumbing} onChange={set("reqPlumbing")} />
            <CheckboxField label="Wood Finish" checked={form.reqWoodFinish} onChange={set("reqWoodFinish")} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextAreaField label="Rooms Required" rows={2} value={form.roomsRequired} onChange={set("roomsRequired")} placeholder="e.g. 3 Bedrooms, Living Room, Kitchen" />
            <TextAreaField label="Special Requests" rows={2} value={form.specialRequests} onChange={set("specialRequests")} />
          </div>

          <SectionTitle>Budget & Timeline</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Expected Project Value (₹)" type="number" value={form.expectedProjectValue} onChange={set("expectedProjectValue")} />
            <TextField label="Expected Start Date" type="date" value={form.expectedStartDate} onChange={set("expectedStartDate")} />
            <TextField label="Expected Completion" type="date" value={form.expectedEndDate} onChange={set("expectedEndDate")} />
          </div>

          <SectionTitle>Assignment</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {userPicker("Sales Executive", "assignedSalesExecutive")}
            {userPicker("Designer", "assignedDesigner")}
            {userPicker("Engineer", "assignedEngineer")}
          </div>

          </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : lead ? "Save Changes" : "Create Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
