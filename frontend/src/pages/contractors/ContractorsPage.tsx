import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { Contractor } from "@/types/contractor";
import { TRADES, CONTRACTOR_TYPES, CONTRACTOR_STATUS_TONE } from "@/types/contractor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Star, Pencil } from "lucide-react";

const STATUSES = ["ACTIVE", "INACTIVE", "BLACKLISTED", "PENDING_APPROVAL"];

const rating = (v?: number) =>
  v == null ? "—" : (
    <span className="inline-flex items-center gap-1 font-semibold">
      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{Number(v).toFixed(1)}
    </span>
  );

const EMPTY: Partial<Contractor> = { status: "ACTIVE", trade: "CARPENTRY", retentionPercentage: 5 };

export default function ContractorsPage() {
  const [rows, setRows] = useState<Contractor[]>([]);
  const [search, setSearch] = useState("");
  const [trade, setTrade] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Contractor>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    contractorApi.list({ search: search || undefined, trade: trade || undefined, status: status || undefined, size: 100 })
      .then((p) => setRows(p.content ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, trade, status]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof Contractor, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setForm(EMPTY); setError(null); setOpen(true); };
  const openEdit = (c: Contractor) => { setForm({ ...c }); setError(null); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim()) { setError("Contractor name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      if (form.id) await contractorApi.update(form.id, form);
      else await contractorApi.create(form);
      setOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the contractor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name, company, code or phone…"
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={trade}
                onChange={(e) => setTrade(e.target.value)}>
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-white px-3 text-sm" value={status}
                onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New Contractor</Button>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="p-3 font-semibold">Code</th>
                <th className="p-3 font-semibold">Contractor</th>
                <th className="p-3 font-semibold">Trade</th>
                <th className="p-3 font-semibold">Contact</th>
                <th className="p-3 font-semibold text-center">Packages</th>
                <th className="p-3 font-semibold text-center">Rating</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No contractors match these filters.
                </td></tr>
              )}
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-xs text-slate-500">{c.contractorCode ?? "—"}</td>
                  <td className="p-3">
                    <Link to={`/contractors/directory/${c.id}`} className="font-bold text-slate-800 hover:text-primary">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.companyName || c.ownerName || "—"}</div>
                  </td>
                  <td className="p-3">
                    {c.trade ? <Badge className="bg-slate-100 text-slate-700">{c.trade.replace(/_/g, " ")}</Badge> : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    <div>{c.phone || "—"}</div>
                    <div className="text-muted-foreground">{c.email || ""}</div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-semibold">{c.completedWorkPackages ?? 0}</span>
                    <span className="text-muted-foreground"> / {c.totalWorkPackages ?? 0}</span>
                  </td>
                  <td className="p-3 text-center">{rating(c.overallRating)}</td>
                  <td className="p-3">
                    <Badge className={CONTRACTOR_STATUS_TONE[c.status] ?? "bg-slate-100 text-slate-700"}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? `Edit ${form.name}` : "New Contractor"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Identity</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Contractor name *">
                  <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Company name">
                  <Input value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} />
                </Field>
                <Field label="Owner name">
                  <Input value={form.ownerName ?? ""} onChange={(e) => set("ownerName", e.target.value)} />
                </Field>
                <Field label="Contact person">
                  <Input value={form.contactPerson ?? ""} onChange={(e) => set("contactPerson", e.target.value)} />
                </Field>
                <Field label="Mobile">
                  <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label="Alternate phone">
                  <Input value={form.alternatePhone ?? ""} onChange={(e) => set("alternatePhone", e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Status">
                  <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          value={form.status ?? "ACTIVE"} onChange={(e) => set("status", e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Trade</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Primary trade">
                  <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          value={form.trade ?? ""} onChange={(e) => set("trade", e.target.value)}>
                    <option value="">—</option>
                    {TRADES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </Field>
                <Field label="Contractor type">
                  <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          value={form.contractorType ?? ""} onChange={(e) => set("contractorType", e.target.value)}>
                    <option value="">—</option>
                    {CONTRACTOR_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </Field>
                <Field label="Other trades (comma separated)">
                  <Input value={form.trades ?? ""} onChange={(e) => set("trades", e.target.value)}
                         placeholder="PAINTING, TILES" />
                </Field>
                <Field label="Skills / notes">
                  <Input value={form.skills ?? ""} onChange={(e) => set("skills", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Statutory & banking</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="GSTIN"><Input value={form.gstin ?? ""} onChange={(e) => set("gstin", e.target.value)} /></Field>
                <Field label="PAN"><Input value={form.pan ?? ""} onChange={(e) => set("pan", e.target.value)} /></Field>
                <Field label="UPI ID"><Input value={form.upiId ?? ""} onChange={(e) => set("upiId", e.target.value)} /></Field>
                <Field label="Bank name"><Input value={form.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} /></Field>
                <Field label="Account number">
                  <Input value={form.bankAccountNumber ?? ""} onChange={(e) => set("bankAccountNumber", e.target.value)} />
                </Field>
                <Field label="IFSC"><Input value={form.bankIfsc ?? ""} onChange={(e) => set("bankIfsc", e.target.value)} /></Field>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Commercial</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Daily rate (₹)">
                  <Input type="number" value={form.dailyRate ?? ""} onChange={(e) => set("dailyRate", Number(e.target.value))} />
                </Field>
                <Field label="Retention %">
                  <Input type="number" value={form.retentionPercentage ?? ""}
                         onChange={(e) => set("retentionPercentage", Number(e.target.value))} />
                </Field>
                <Field label="TDS %">
                  <Input type="number" value={form.tdsPercentage ?? ""}
                         onChange={(e) => set("tdsPercentage", Number(e.target.value))} />
                </Field>
                <Field label="Credit days">
                  <Input type="number" value={form.creditDays ?? ""} onChange={(e) => set("creditDays", Number(e.target.value))} />
                </Field>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Compliance</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Agreement no."><Input value={form.agreementNumber ?? ""} onChange={(e) => set("agreementNumber", e.target.value)} /></Field>
                <Field label="Agreement start">
                  <Input type="date" value={form.agreementStartDate ?? ""} onChange={(e) => set("agreementStartDate", e.target.value)} />
                </Field>
                <Field label="Agreement end">
                  <Input type="date" value={form.agreementEndDate ?? ""} onChange={(e) => set("agreementEndDate", e.target.value)} />
                </Field>
                <Field label="Insurance no."><Input value={form.insuranceNumber ?? ""} onChange={(e) => set("insuranceNumber", e.target.value)} /></Field>
                <Field label="Insurance expiry">
                  <Input type="date" value={form.insuranceExpiryDate ?? ""} onChange={(e) => set("insuranceExpiryDate", e.target.value)} />
                </Field>
                <Field label="Licence expiry">
                  <Input type="date" value={form.licenseExpiryDate ?? ""} onChange={(e) => set("licenseExpiryDate", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Address"><Input value={form.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} /></Field>
                <Field label="City"><Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
                <Field label="State"><Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} /></Field>
                <Field label="Pincode"><Input value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)} /></Field>
              </div>
            </section>

            {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">{error}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Contractor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
