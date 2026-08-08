import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { boqApi } from "@/api/boqApi";
import { BOQ_CATEGORIES, BOQ_UNITS, type Boq, type BoqItem } from "@/types/boq";
import { Field, SectionTitle, TextAreaField, selectClass } from "../leads/fields";

interface PickerOption { id: number; label: string }

const EMPTY_ITEM: BoqItem = {
  itemName: "", category: BOQ_CATEGORIES[0], unit: BOQ_UNITS[0], quantity: 1,
  floorName: "", roomName: "",
};

const EMPTY_FORM: Partial<Boq> = {
  notes: "", discountType: "PERCENT", discount: 0, taxPercent: 0, items: [],
};

function num(v: any) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export default function BoqForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<Partial<Boq>>({
    ...EMPTY_FORM,
    customer: searchParams.get("customerId") ? { id: Number(searchParams.get("customerId")) } : undefined,
    project: searchParams.get("projectId") ? { id: Number(searchParams.get("projectId")) } : undefined,
    measurement: searchParams.get("measurementId") ? { id: Number(searchParams.get("measurementId")) } : undefined,
  });
  const [customers, setCustomers] = useState<PickerOption[]>([]);
  const [projects, setProjects] = useState<PickerOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/customers?size=200").then((res) => setCustomers(
      (res.data.content || []).map((c: any) => ({ id: c.id, label: c.name }))
    )).catch(console.error);
    api.get("/projects?size=200").then((res) => setProjects(
      (res.data.content || res.data || []).map((p: any) => ({ id: p.id, label: p.projectName }))
    )).catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    boqApi.get(id).then((b) => setForm(b)).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const set = (key: keyof Boq) => (value: any) => setForm((f) => ({ ...f, [key]: value }));
  const setRef = (key: "customer" | "project") => (value: string) =>
    setForm((f) => ({ ...f, [key]: value ? { id: Number(value) } : undefined }));

  const items = form.items || [];
  const setItem = (index: number, patch: Partial<BoqItem>) => {
    setForm((f) => {
      const next = [...(f.items || [])];
      next[index] = { ...next[index], ...patch };
      return { ...f, items: next };
    });
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...(f.items || []), { ...EMPTY_ITEM }] }));
  const removeItem = (index: number) => setForm((f) => ({ ...f, items: (f.items || []).filter((_, i) => i !== index) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      const saved = isEdit ? await boqApi.update(Number(id), payload) : await boqApi.create(payload);
      navigate(`/boq/${saved.id}`);
    } catch (err: any) {
      console.error("Error saving BOQ:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to save BOQ. Please check the required fields.");
    } finally {
      setSaving(false);
    }
  };

  // Client is carried over from the measurement at generation — a customer if the lead was already
  // converted, otherwise the lead itself. Shown read-only so it never has to be re-keyed.
  const client = form.customer || form.lead;
  const clientPhone = client?.mobileNumber || client?.phone || client?.whatsappNumber;

  if (loading) return <div className="p-8 text-muted-foreground">Loading BOQ...</div>;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit BOQ" : "New BOQ"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up the floor / room / item structure. Add materials and labour on the BOQ detail page once saved.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border shadow-sm">
        <SectionTitle>Relationships</SectionTitle>
        {client?.name && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="font-medium flex items-center gap-2">
                {client.name}
                <span className="text-[10px] uppercase px-2 py-0.5 bg-background border rounded-full">
                  {form.customer ? "Customer" : "Lead"}
                </span>
              </span>
              {client.companyName && <span className="text-muted-foreground">{client.companyName}</span>}
              {clientPhone && <span className="text-muted-foreground">Phone: {clientPhone}</span>}
              {client.email && <span className="text-muted-foreground">Email: {client.email}</span>}
              {form.measurement?.measurementNumber && <span className="text-muted-foreground">From {form.measurement.measurementNumber}</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Client details are carried over from the measurement automatically — no need to re-enter them.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Customer (optional)">
            <select className={selectClass} value={form.customer?.id ?? ""} onChange={(e) => setRef("customer")(e.target.value)}>
              <option value="">{form.lead?.name ? `Lead: ${form.lead.name}` : "No customer yet"}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Project (optional)">
            <select className={selectClass} value={form.project?.id ?? ""} onChange={(e) => setRef("project")(e.target.value)}>
              <option value="">None</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Property Name">
            <Input value={form.propertyName ?? ""} onChange={(e) => set("propertyName")(e.target.value)} placeholder="e.g. Villa 42" />
          </Field>
        </div>

        <SectionTitle>Items (Floor / Room / Item)</SectionTitle>
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2 min-w-[110px]">Floor</th>
                <th className="text-left p-2 min-w-[110px]">Room</th>
                <th className="text-left p-2 min-w-[140px]">Category</th>
                <th className="text-left p-2 min-w-[160px]">Item Name</th>
                <th className="text-right p-2 w-20">Length</th>
                <th className="text-right p-2 w-20">Width</th>
                <th className="text-right p-2 w-20">Height</th>
                <th className="text-right p-2 w-20">Qty</th>
                <th className="text-left p-2 w-24">Unit</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={10} className="text-center text-muted-foreground p-4">No items yet — click "Add Item" below.</td></tr>
              ) : items.map((it, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1.5"><Input value={it.floorName ?? ""} onChange={(e) => setItem(i, { floorName: e.target.value })} /></td>
                  <td className="p-1.5"><Input value={it.roomName ?? ""} onChange={(e) => setItem(i, { roomName: e.target.value })} /></td>
                  <td className="p-1.5">
                    <select className={selectClass} value={it.category ?? ""} onChange={(e) => setItem(i, { category: e.target.value })}>
                      {BOQ_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5"><Input value={it.itemName ?? ""} onChange={(e) => setItem(i, { itemName: e.target.value })} required /></td>
                  <td className="p-1.5"><Input type="number" className="text-right" value={it.length ?? ""} onChange={(e) => setItem(i, { length: num(e.target.value) })} /></td>
                  <td className="p-1.5"><Input type="number" className="text-right" value={it.width ?? ""} onChange={(e) => setItem(i, { width: num(e.target.value) })} /></td>
                  <td className="p-1.5"><Input type="number" className="text-right" value={it.height ?? ""} onChange={(e) => setItem(i, { height: num(e.target.value) })} /></td>
                  <td className="p-1.5"><Input type="number" className="text-right" value={it.quantity ?? 1} onChange={(e) => setItem(i, { quantity: num(e.target.value) })} /></td>
                  <td className="p-1.5">
                    <select className={selectClass} value={it.unit ?? ""} onChange={(e) => setItem(i, { unit: e.target.value })}>
                      {BOQ_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5 text-center">
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Materials, labour and stock checks are managed per-item on the BOQ detail page after saving.
          </p>
        )}

        <SectionTitle>Charges</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Discount Type">
            <select className={selectClass} value={form.discountType ?? "PERCENT"} onChange={(e) => set("discountType")(e.target.value)}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </Field>
          <Field label={`Discount ${form.discountType === "FLAT" ? "(₹)" : "(%)"}`}>
            <Input type="number" value={form.discount ?? 0} onChange={(e) => set("discount")(num(e.target.value))} />
          </Field>
          <Field label="Tax (%)">
            <Input type="number" value={form.taxPercent ?? 0} onChange={(e) => set("taxPercent")(num(e.target.value))} />
          </Field>
        </div>

        <SectionTitle>Notes</SectionTitle>
        <TextAreaField label="Notes" value={form.notes} onChange={set("notes")} />

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create BOQ"}</Button>
        </div>
      </form>
    </div>
  );
}
