import { useEffect, useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { CheckboxField, SectionTitle, SelectField, TextAreaField, TextField } from "../leads/fields";

const CUSTOMER_TYPES = ["Individual", "Business", "Builder", "Architect", "Contractor"];
const CUSTOMER_STATUSES = ["Active", "Inactive", "Blacklisted"];
const CONTACT_METHODS = ["Phone", "WhatsApp", "Email"];

// Whitelist of fields we send to the API — keeps nested collections (tags, addresses,
// contacts, notes, documents, timeline) out of the write payload on edit.
const CUSTOMER_FIELDS = [
  "name", "customerType", "status", "contactPersonName",
  "phone", "alternatePhone", "whatsappNumber", "email", "website",
  "companyName", "gstNumber", "panNumber",
  "billingAddress", "siteAddress", "city", "district", "state", "country", "pincode",
  "googleMapLocation", "latitude", "longitude",
  "preferredContactMethod", "preferredLanguage",
] as const;

const EMPTY_FORM: Record<string, any> = { customerType: "Individual", status: "Active" };

export default function CustomerFormDialog({
  open, onOpenChange, customer, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Record<string, any> | null; // when set → edit mode (full record)
  onSaved: () => void;
}) {
  const isEdit = !!customer?.id;
  const [form, setForm] = useState<Record<string, any>>(EMPTY_FORM);
  const [showMap, setShowMap] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const base = customer ? { ...EMPTY_FORM, ...customer } : { ...EMPTY_FORM };
    setForm(base);
    setError("");
    // Reveal optional sections up-front only when they already hold data, so we never hide
    // information the user previously entered.
    setShowMap(!!(base.googleMapLocation || base.latitude || base.longitude));
    setShowPrefs(!!(base.preferredContactMethod || base.preferredLanguage));
    setSameAsBilling(!!base.billingAddress && base.billingAddress === base.siteAddress);
  }, [open, customer]);

  const set = (key: string) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  // When "same as billing" is on, the site address mirrors billing as it's typed.
  const setBilling = (value: string) =>
    setForm((f) => ({ ...f, billingAddress: value, ...(sameAsBilling ? { siteAddress: value } : {}) }));
  const toggleSameAsBilling = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) setForm((f) => ({ ...f, siteAddress: f.billingAddress }));
  };

  // Business identity is irrelevant for individuals — but never hide fields that already
  // carry a value on an existing record.
  const showBusiness =
    (form.customerType && form.customerType !== "Individual") ||
    !!(form.companyName || form.gstNumber || form.panNumber);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    let payload: Record<string, any>;
    if (isEdit) {
      // Preserve every scalar already on the record (photoUrl, timestamps, etc.) and only
      // drop the nested collections — mirrors the original edit save so nothing is lost.
      const { tags, addresses, contacts, notes, documents, timeline, ...rest } = form;
      void tags; void addresses; void contacts; void notes; void documents; void timeline;
      payload = rest;
    } else {
      payload = {};
      CUSTOMER_FIELDS.forEach((k) => { payload[k] = form[k] ?? ""; });
    }
    // Optional/nullable fields — send null rather than an empty string.
    ["email", "latitude", "longitude"].forEach((k) => { if (!payload[k]) payload[k] = null; });

    const request = isEdit
      ? api.put(`/customers/${customer!.id}`, payload)
      : api.post("/customers", payload);

    request
      .then(() => {
        onOpenChange(false);
        onSaved();
        toast.success(isEdit ? `${payload.name || "Customer"} updated` : `${payload.name || "Customer"} saved`);
      })
      .catch((err) => {
        console.error("Failed to save customer", err);
        setError(err?.response?.data?.message || "Could not save the customer. Please check the required fields and try again.");
      })
      .finally(() => setSaving(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${customer?.name || "Customer"}` : "Add New Customer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic */}
          <SectionTitle>Basic Details</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <SelectField label="Customer Type" value={form.customerType} onChange={set("customerType")} options={CUSTOMER_TYPES} allowEmpty={false} />
            <SelectField label="Status" value={form.status} onChange={set("status")} options={CUSTOMER_STATUSES} allowEmpty={false} />
            <TextField label="Customer Name" required value={form.name} onChange={set("name")} />
            <TextField label="Contact Person" value={form.contactPersonName} onChange={set("contactPersonName")} />
          </div>

          {/* Contact */}
          <SectionTitle>Contact</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Mobile Number" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
            <TextField label="Alternate Mobile" type="tel" inputMode="tel" value={form.alternatePhone} onChange={set("alternatePhone")} />
            <TextField label="WhatsApp Number" type="tel" inputMode="tel" value={form.whatsappNumber} onChange={set("whatsappNumber")} />
            <TextField label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set("email")} />
            <TextField label="Website" value={form.website} onChange={set("website")} placeholder="https://" />
          </div>

          {/* Business — only for non-individuals (or when data already exists) */}
          {showBusiness && (
            <>
              <SectionTitle>Business Details</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <TextField label="Company Name" value={form.companyName} onChange={set("companyName")} />
                <TextField label="GST Number" value={form.gstNumber} onChange={set("gstNumber")} />
                <TextField label="PAN Number" value={form.panNumber} onChange={set("panNumber")} />
              </div>
            </>
          )}

          {/* Address */}
          <SectionTitle>Address</SectionTitle>
          <div className="space-y-3">
            <TextAreaField label="Billing Address" rows={2} value={form.billingAddress} onChange={setBilling} />
            <CheckboxField label="Site address is the same as billing" checked={sameAsBilling} onChange={toggleSameAsBilling} />
            {!sameAsBilling && (
              <TextAreaField label="Site Address" rows={2} value={form.siteAddress} onChange={set("siteAddress")} />
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TextField label="City" value={form.city} onChange={set("city")} />
            <TextField label="District" value={form.district} onChange={set("district")} />
            <TextField label="State" value={form.state} onChange={set("state")} />
            <TextField label="Pincode" inputMode="numeric" value={form.pincode} onChange={set("pincode")} />
            <TextField label="Country" value={form.country} onChange={set("country")} />
          </div>

          {showMap ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <TextField label="Google Map Location" value={form.googleMapLocation} onChange={set("googleMapLocation")} placeholder="Paste a Google Maps link" />
              </div>
              <TextField label="Latitude" type="number" inputMode="decimal" value={form.latitude} onChange={set("latitude")} />
              <TextField label="Longitude" type="number" inputMode="decimal" value={form.longitude} onChange={set("longitude")} />
            </div>
          ) : (
            <button type="button" onClick={() => setShowMap(true)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <MapPin className="h-4 w-4" /> Add map location
            </button>
          )}

          {/* Preferences — advanced, hidden until asked for */}
          {showPrefs ? (
            <>
              <SectionTitle>Preferences</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField label="Preferred Contact Method" value={form.preferredContactMethod} onChange={set("preferredContactMethod")} options={CONTACT_METHODS} />
                <TextField label="Preferred Language" value={form.preferredLanguage} onChange={set("preferredLanguage")} />
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setShowPrefs(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-4 w-4" /> Add contact preferences
            </button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Save Customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
