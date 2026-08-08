import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { measurementApi } from "@/api/measurementApi";
import { siteVisitApi } from "@/lib/siteVisitApi";
import { MEASUREMENT_PRIORITIES, MEASUREMENT_TYPES, type Measurement } from "@/types/measurement";
import { Field, SectionTitle, SelectField, TextAreaField, TextField, selectClass } from "../leads/fields";

interface PickerOption { id: number; label: string }
interface TeamRow { employeeId: string; role: string }

const ASSIGNMENT_ROLES = ["Measurement Engineer", "Interior Designer", "Project Manager", "Supervisor"];

const EMPTY_FORM: Partial<Measurement> = {
  measurementType: "Initial",
  priority: "Medium",
};

export default function MeasurementForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const siteVisitId = searchParams.get("siteVisitId");
  const leadId = searchParams.get("leadId");
  const customerId = searchParams.get("customerId");
  const projectId = searchParams.get("projectId");

  // Measurements follow Lead → Site Visit → Measurement, so who this is for is never a choice
  // made here — it is inherited from whatever the user came from.
  const hasContext = Boolean(siteVisitId || leadId || customerId || projectId);

  const parseId = (val: string | null) => (val && val !== "null" && val !== "undefined" && !isNaN(Number(val))) ? { id: Number(val) } : undefined;

  const handleCancel = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else if (leadId) {
      navigate(`/leads/${leadId}`);
    } else if (customerId) {
      navigate(`/customers/${customerId}`);
    } else if (siteVisitId) {
      navigate(`/site-visits/${siteVisitId}`);
    } else if (projectId) {
      navigate(`/projects/${projectId}`);
    } else if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/measurements");
    }
  };

  const [form, setForm] = useState<Partial<Measurement>>({
    ...EMPTY_FORM,
    lead: parseId(leadId),
    customer: parseId(customerId),
    project: parseId(projectId),
    siteVisit: parseId(siteVisitId),
  });
  const [employees, setEmployees] = useState<PickerOption[]>([]);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [sourceVisit, setSourceVisit] = useState<any>(null);
  const [lead, setLead] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [roomsToCarry, setRoomsToCarry] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    measurementApi.assignableEmployees().then((res: any[]) => setEmployees(
      res.map((u) => ({ id: u.id, label: u.name || u.email }))
    )).catch(console.error);
  }, []);

  // Everything already captured upstream is pulled in, so nothing is keyed twice.
  useEffect(() => {
    if (siteVisitId) {
      siteVisitApi.get(siteVisitId).then((visit) => {
        setSourceVisit(visit);
        if (visit.lead) setLead(visit.lead);
        if (visit.customer) setCustomer(visit.customer);
        setForm((f) => ({
          ...f,
          lead: f.lead ?? (visit.lead ? { id: visit.lead.id } : undefined),
          customer: f.customer ?? (visit.customer ? { id: visit.customer.id } : undefined),
          project: f.project ?? (visit.project ? { id: visit.project.id } : undefined),
          propertyType: f.propertyType || visit.propertyType || "",
          constructionStage: f.constructionStage || visit.constructionStage || "",
          totalFloors: f.totalFloors ?? visit.totalFloors ?? undefined,
          totalArea: f.totalArea ?? visit.areaSqft ?? undefined,
          siteAddress: f.siteAddress || visit.locationAddress || "",
          mapLocation: f.mapLocation || visit.mapLocation || "",
        }));
      }).catch(console.error);
      siteVisitApi.getRooms(siteVisitId)
        .then((rooms: any[]) => setRoomsToCarry(rooms.map((r) => r.roomName)))
        .catch(() => {});
    }

    if (leadId) {
      api.get(`/leads/${leadId}`).then((res) => {
        const data = res.data as any;
        setLead(data);
        setForm((f) => ({
          ...f,
          siteAddress: f.siteAddress || data.address || "",
          location: f.location || data.city || "",
        }));
      }).catch(console.error);
    }

    if (customerId) {
      api.get(`/customers/${customerId}`).then((res) => {
        const data = (res.data as any)?.data ?? res.data;
        setCustomer(data);
        setForm((f) => ({
          ...f,
          siteAddress: f.siteAddress || data.siteAddress || data.billingAddress || "",
          location: f.location || data.city || "",
        }));
      }).catch(console.error);
    }
  }, [siteVisitId, leadId, customerId]);

  const set = (key: keyof Measurement) => (value: any) => setForm((f) => ({ ...f, [key]: value }));

  const addTeamRow = () => setTeam((t) => [...t, { employeeId: "", role: "Supervisor" }]);
  const updateTeamRow = (index: number, patch: Partial<TeamRow>) =>
    setTeam((t) => t.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeTeamRow = (index: number) => setTeam((t) => t.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload: any = { ...form };
    ["totalFloors", "totalArea"].forEach((k) => {
      if (payload[k] === "" || payload[k] === null) delete payload[k];
    });
    try {
      const saved = await measurementApi.create(payload);

      // The creator is assigned server-side; these are the extra members.
      const members = team.filter((row) => row.employeeId);
      if (members.length > 0) {
        const results = await Promise.allSettled(members.map((row) =>
          measurementApi.assignEmployee(saved.id!, Number(row.employeeId), row.role)
        ));
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed > 0) {
          alert(`Measurement created, but ${failed} team member(s) could not be assigned. Add them from the Team tab.`);
        }
      }
      const fromPath = location.state?.from || (leadId ? `/leads/${leadId}` : customerId ? `/customers/${customerId}` : siteVisitId ? `/site-visits/${siteVisitId}` : undefined);
      navigate(`/measurements/${saved.id}`, { state: { from: fromPath } });
    } catch (err: any) {
      console.error("Error saving measurement:", err);
      setError(err?.response?.data?.message || "Failed to save measurement. Please check the required fields.");
    } finally {
      setSaving(false);
    }
  };

  // Without upstream context there is nobody to measure for — send the user back to the workflow.
  if (!hasContext) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6 animate-in fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Measurement</h1>
          <p className="text-sm text-muted-foreground mt-1">Measurements are raised from a site visit or a lead.</p>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            A measurement always belongs to a customer or lead, and the property details come from the site
            visit — so start from there instead of re-entering it here.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/site-visits")}>Go to Site Visits</Button>
            <Button variant="outline" onClick={() => navigate("/leads")}>Go to Leads</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Measurement</h1>
          <p className="text-sm text-muted-foreground mt-1">Capture site measurement details — rooms and drawings can be added after creation.</p>
        </div>
        <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      </div>

      {sourceVisit && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">
            Prefilled from site visit {sourceVisit.visitNumber}
            {sourceVisit.scheduledDate ? ` (${sourceVisit.scheduledDate})` : ""}
          </p>
          <p className="text-muted-foreground mt-1">
            Property details were carried over — edit anything that changed on site.
            {roomsToCarry.length > 0 && ` ${roomsToCarry.length} room(s) will be created automatically: ${roomsToCarry.join(", ")}.`}
          </p>
        </div>
      )}

      <ContactContextCard lead={lead} customer={customer} visit={sourceVisit} />

      <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border shadow-sm">
        <SectionTitle>Basic Details</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SelectField label="Measurement Type" value={form.measurementType} onChange={set("measurementType")} options={MEASUREMENT_TYPES} allowEmpty={false} />
          <SelectField label="Priority" value={form.priority} onChange={set("priority")} options={MEASUREMENT_PRIORITIES} allowEmpty={false} />
          <TextField label="Measurement Date" type="date" value={form.measurementDate} onChange={set("measurementDate")} />
          <TextField label="Start Time" type="time" value={form.startTime} onChange={set("startTime")} />
          <TextField label="End Time" type="time" value={form.endTime} onChange={set("endTime")} />
        </div>

        <div className="flex items-center justify-between">
          <SectionTitle>Team</SectionTitle>
          <Button type="button" variant="outline" size="sm" onClick={addTeamRow}>+ Add Member</Button>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          You are recorded as the measuring engineer automatically. Add anyone else who worked on this measurement.
        </p>
        {team.length > 0 && (
          <div className="space-y-3">
            {team.map((row, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <Field label="Member">
                  <select className={selectClass} value={row.employeeId} onChange={(e) => updateTeamRow(index, { employeeId: e.target.value })}>
                    <option value="">Select employee...</option>
                    {employees.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </Field>
                <Field label="Role">
                  <select className={selectClass} value={row.role} onChange={(e) => updateTeamRow(index, { role: e.target.value })}>
                    {ASSIGNMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeTeamRow(index)}>Remove</Button>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Property Information</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <TextField label="Property Type" value={form.propertyType} onChange={set("propertyType")} placeholder="e.g., Apartment, Villa, Office" />
          <TextField label="Construction Stage" value={form.constructionStage} onChange={set("constructionStage")} placeholder="e.g., Raw, Plastered, Painted" />
          <TextField label="Total Floors" type="number" value={form.totalFloors} onChange={set("totalFloors")} />
          <TextField label="Total Area (sq.ft)" type="number" value={form.totalArea} onChange={set("totalArea")} />
          <TextField label="Location" value={form.location} onChange={set("location")} />
          <TextField label="Map Location (link)" value={form.mapLocation} onChange={set("mapLocation")} />
        </div>
        <TextAreaField label="Site Address" value={form.siteAddress} onChange={set("siteAddress")} rows={2} />

        <SectionTitle>Notes</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextAreaField label="Remarks" value={form.remarks} onChange={set("remarks")} />
          <TextAreaField label="Internal Notes" value={form.internalNotes} onChange={set("internalNotes")} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create Measurement"}</Button>
        </div>
      </form>
    </div>
  );
}

/** Read-only view of who this measurement is for, inherited from the lead / site visit. */
export function ContactContextCard({ lead, customer, visit }: { lead?: any; customer?: any; visit?: any }) {
  if (!lead && !customer) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {customer && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
          <p className="text-base font-semibold mt-1">{customer.name || "—"}</p>
          <dl className="mt-3 space-y-1 text-sm">
            <ContactRow label="Code" value={customer.customerCode} />
            <ContactRow label="Type" value={customer.customerType} />
            <ContactRow label="Phone" value={customer.phone} />
            <ContactRow label="Email" value={customer.email} />
            <ContactRow label="City" value={customer.city} />
            <ContactRow label="Site Address" value={customer.siteAddress || customer.billingAddress} />
          </dl>
        </div>
      )}
      {lead && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead</p>
          <p className="text-base font-semibold mt-1">
            {lead.name || "—"}{lead.leadNumber ? ` · ${lead.leadNumber}` : ""}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            <ContactRow label="Mobile" value={lead.mobileNumber} />
            <ContactRow label="Email" value={lead.email} />
            <ContactRow label="City" value={lead.city} />
            <ContactRow label="Address" value={lead.address} />
            <ContactRow label="Site Visit" value={visit?.visitNumber} />
          </dl>
        </div>
      )}
    </div>
  );
}

function ContactRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground min-w-24">{label}</dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}
