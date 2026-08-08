import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { leadApi } from "./leadApi";
import {
  CONSTRUCTION_STATUSES, LEAD_SOURCES, LEAD_TYPES, PRIORITIES, TEMPERATURES,
  type Lead, type UserSummary,
} from "./constants";
import { CheckboxField, SectionTitle, SelectField, TextAreaField, TextField } from "./fields";

const EMPTY_FORM: Partial<Lead> = {
  name: "", mobileNumber: "", priority: "Medium", leadTemperature: "Warm", status: "New",
};

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(lead ? { ...lead } : { ...EMPTY_FORM });
      setError("");
    }
  }, [open, lead]);

  const set = (key: keyof Lead) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload: any = { ...form };
    // strip empty strings for numeric/date fields so Jackson doesn't choke
    ["estimatedBudget", "minimumBudget", "maximumBudget", "expectedProjectValue",
      "areaSqft", "expectedWorkArea", "floorCount"].forEach((k) => {
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

    const request = lead ? leadApi.update(lead.id, payload) : leadApi.create(payload);
    request
      .then((res) => {
        onOpenChange(false);
        onSaved(res.data);
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <SectionTitle>Lead Details</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Lead Title / Customer Name" required value={form.name} onChange={set("name")} />
            <SelectField label="Lead Source" value={form.leadSource} onChange={set("leadSource")} options={LEAD_SOURCES} />
            <SelectField label="Lead Type" value={form.leadType} onChange={set("leadType")} options={LEAD_TYPES} />
            <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={PRIORITIES} allowEmpty={false} />
            <SelectField label="Lead Temperature" value={form.leadTemperature} onChange={set("leadTemperature")} options={TEMPERATURES} allowEmpty={false} />
          </div>

          <SectionTitle>Customer Information</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <TextField label="Company Name" value={form.companyName} onChange={set("companyName")} />
            <TextField label="Contact Person" value={form.contactPerson} onChange={set("contactPerson")} />
            <TextField label="Primary Mobile" required value={form.mobileNumber} onChange={set("mobileNumber")} />
            <TextField label="Alternative Mobile" value={form.alternateMobile} onChange={set("alternateMobile")} />
            <TextField label="WhatsApp Number" value={form.whatsappNumber} onChange={set("whatsappNumber")} />
            <TextField label="Email" type="email" value={form.email} onChange={set("email")} />
            <TextField label="GST Number" value={form.gstNumber} onChange={set("gstNumber")} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <TextAreaField label="Address" rows={2} value={form.address} onChange={set("address")} />
            </div>
            <TextField label="City" value={form.city} onChange={set("city")} />
            <TextField label="District" value={form.district} onChange={set("district")} />
            <TextField label="State" value={form.state} onChange={set("state")} />
            <TextField label="Pincode" value={form.pincode} onChange={set("pincode")} />
            <div className="col-span-2">
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
            <TextField label="Estimated Budget (₹)" type="number" value={form.estimatedBudget} onChange={set("estimatedBudget")} />
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
