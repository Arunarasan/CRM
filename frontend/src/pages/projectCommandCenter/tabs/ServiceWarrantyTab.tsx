import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Wrench, Plus, Loader2, IndianRupee,
  FileText, CheckCircle2, AlertTriangle, ExternalLink, Save,
} from "lucide-react";
import {
  serviceWarrantyApi, ServiceWarrantyOverview, ServiceWork, WarrantyCover,
} from "@/api/serviceWarrantyApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { format } from "date-fns";

const WARRANTY_TYPES = [
  { v: "SERVICE", l: "Service warranty" },
  { v: "PRODUCT", l: "Product warranty" },
  { v: "NONE", l: "Not under warranty" },
];
const CHARGE_TYPES = [
  { v: "FREE", l: "Free (in-warranty)" },
  { v: "PAID", l: "Paid (chargeable)" },
];
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const selectCls =
  "w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none";

const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd MMM yyyy") : "—");
const money = (n?: number | null) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN")}`);

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-amber-50 text-amber-700 ring-amber-200",
    IN_PROGRESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    RESOLVED: "bg-slate-100 text-slate-600 ring-slate-200",
    CLOSED: "bg-slate-100 text-slate-500 ring-slate-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${styles[status] || styles.OPEN}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ChargeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 ring-1 ring-slate-200">Not set</span>;
  const paid = type === "PAID";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${paid ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
      {paid ? "Paid" : "Free"}
    </span>
  );
}

/** One warranty-cover chip (service or product), with an in-warranty / expired badge. */
function CoverChip({ label, cover }: { label: string; cover: WarrantyCover }) {
  const expired = cover.endDate != null && !cover.inWarranty;
  return (
    <div className="flex-1 min-w-[180px] rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {cover.endDate == null ? (
          <span className="text-[11px] text-slate-400">Not set</span>
        ) : cover.inWarranty ? (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            {cover.daysLeft} days left
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 ring-1 ring-rose-200">
            Expired
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-lg font-bold ${expired ? "text-rose-600" : "text-slate-800"}`}>{fmtDate(cover.endDate)}</span>
        {cover.months != null && <span className="text-[11px] text-slate-400">{cover.months} mo</span>}
      </div>
    </div>
  );
}

export default function ServiceWarrantyTab({ projectId }: { projectId: number }) {
  const [data, setData] = useState<ServiceWarrantyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (): Promise<void> =>
    serviceWarrantyApi.getOverview(projectId).then(setData).catch(() => { toast.error("Failed to load service & warranty"); });

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  if (!data.completed) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-2 text-sm font-semibold text-amber-800">Available after handover</p>
        <p className="text-xs text-amber-600">Mark the project completed to activate warranty and log service works.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WarrantyCard data={data} projectId={projectId} onSaved={load} />
      <ServiceWorksCard data={data} projectId={projectId} onChanged={load} />
    </div>
  );
}

/* ------------------------------- Warranty -------------------------------- */

function WarrantyCard({ data, projectId, onSaved }: { data: ServiceWarrantyOverview; projectId: number; onSaved: () => Promise<void> }) {
  const w = data.warranty;
  const [form, setForm] = useState({
    startDate: w.startDate || "",
    serviceMonths: w.service.months ?? data.defaults.serviceMonths,
    productMonths: w.product.months ?? data.defaults.productMonths,
    notes: w.notes || "",
  });
  const [editing, setEditing] = useState(!w.activated);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await serviceWarrantyApi.activateWarranty(projectId, {
        startDate: form.startDate || undefined,
        serviceMonths: Number(form.serviceMonths),
        productMonths: Number(form.productMonths),
        notes: form.notes,
      });
      toast.success("Warranty saved");
      setEditing(false);
      await onSaved();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save warranty");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" /> Warranty Cover
        </h3>
        {w.activated && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">Edit</button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <CoverChip label="Service warranty ends" cover={w.service} />
            <CoverChip label="Product warranty ends" cover={w.product} />
          </div>
          <div className="text-xs text-slate-400">
            Cover started {fmtDate(w.startDate)}
            {w.notes && <span className="block mt-1 text-slate-500">{w.notes}</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-slate-500">Cover start date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1 h-9" />
              <p className="mt-1 text-[11px] text-slate-400">Defaults to the completion date.</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Service warranty (months)</Label>
              <Input type="number" min={0} value={form.serviceMonths} onChange={(e) => setForm((f) => ({ ...f, serviceMonths: Number(e.target.value) }))} className="mt-1 h-9" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Product warranty (months)</Label>
              <Input type="number" min={0} value={form.productMonths} onChange={(e) => setForm((f) => ({ ...f, productMonths: Number(e.target.value) }))} className="mt-1 h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="What's covered, exclusions, etc."
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            {w.activated && <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl">Cancel</Button>}
            <Button onClick={save} disabled={saving} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {w.activated ? "Save changes" : "Activate warranty"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Service works ----------------------------- */

function ServiceWorksCard({ data, projectId, onChanged }: { data: ServiceWarrantyOverview; projectId: number; onChanged: () => Promise<void> }) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center">
          <Wrench className="w-4 h-4 mr-2 text-emerald-600" /> Service Works
          <span className="ml-2 text-xs font-normal text-slate-400">({data.serviceWorks.length})</span>
        </h3>
        <Button onClick={() => setCreating(true)} size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-1.5" /> Log service work
        </Button>
      </div>

      {data.serviceWorks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          No service works yet. Log one when the customer reports an issue.
        </div>
      ) : (
        <div className="space-y-3">
          {data.serviceWorks.map((sw) => (
            <ServiceWorkRow key={sw.id} work={sw} onChanged={onChanged} />
          ))}
        </div>
      )}

      {creating && (
        <CreateWorkDialog projectId={projectId} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await onChanged(); }} />
      )}
    </section>
  );
}

function ServiceWorkRow({ work, onChanged }: { work: ServiceWork; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [form, setForm] = useState({
    warrantyType: work.warrantyType || "",
    chargeType: work.chargeType || "",
    chargeAmount: work.chargeAmount ?? ("" as number | ""),
    status: work.status,
    resolutionNotes: work.resolutionNotes || "",
  });

  const save = async () => {
    setSaving(true);
    try {
      await serviceWarrantyApi.updateServiceWork(work.id, {
        warrantyType: form.warrantyType || null,
        chargeType: form.chargeType || null,
        chargeAmount: form.chargeAmount === "" ? null : Number(form.chargeAmount),
        status: form.status,
        resolutionNotes: form.resolutionNotes,
      });
      toast.success("Service work updated");
      setOpen(false);
      await onChanged();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">{work.subject}</span>
            {work.origin === "PORTAL" && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">From customer</span>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            {work.issueType && <span>{work.issueType}</span>}
            <span>· {fmtDate(work.createdAt)}</span>
            {work.taskId && (
              <Link to={`/tasks?taskId=${work.taskId}`} className="inline-flex items-center gap-0.5 text-emerald-600 hover:underline">
                Task #{work.taskId} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
        <StatusBadge status={work.status} />
        <ChargeBadge type={work.chargeType} />
        {work.chargeType === "PAID" && <span className="text-sm font-semibold text-slate-700">{money(work.chargeAmount)}</span>}
        {work.invoiceNumber && (
          <Link to={`/finance/invoices/${work.invoiceId}`} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline">
            <FileText className="w-3.5 h-3.5" /> {work.invoiceNumber}
          </Link>
        )}
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-slate-500 hover:text-emerald-600">
          {open ? "Close" : "Manage"}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {work.description && <p className="text-xs text-slate-500">{work.description}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-slate-500">Warranty claim</Label>
              <select value={form.warrantyType} onChange={(e) => setForm((f) => ({ ...f, warrantyType: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">— Select —</option>
                {WARRANTY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Free or paid</Label>
              <select value={form.chargeType} onChange={(e) => setForm((f) => ({ ...f, chargeType: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">— Not decided —</option>
                {CHARGE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Charge amount</Label>
              <Input
                type="number" min={0} disabled={form.chargeType !== "PAID"}
                value={form.chargeAmount}
                onChange={(e) => setForm((f) => ({ ...f, chargeAmount: e.target.value === "" ? "" : Number(e.target.value) }))}
                className="mt-1 h-9" placeholder={form.chargeType === "PAID" ? "0" : "Free"}
              />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Status</Label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={`${selectCls} mt-1`}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-slate-500">Resolution notes</Label>
              <Input value={form.resolutionNotes} onChange={(e) => setForm((f) => ({ ...f, resolutionNotes: e.target.value }))} className="mt-1 h-9" placeholder="What was done" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {form.chargeType === "PAID" && !work.invoiceNumber && (
                <Button variant="outline" size="sm" onClick={() => setInvoicing(true)} className="rounded-xl border-emerald-200 text-emerald-700">
                  <IndianRupee className="w-3.5 h-3.5 mr-1" /> Raise invoice
                </Button>
              )}
              {work.invoiceNumber && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Invoiced ({work.invoiceStatus})
                </span>
              )}
            </div>
            <Button onClick={save} disabled={saving} size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Save
            </Button>
          </div>

          {invoicing && (
            <RaiseInvoiceDialog work={work} suggestedAmount={form.chargeAmount === "" ? null : Number(form.chargeAmount)}
              onClose={() => setInvoicing(false)} onDone={async () => { setInvoicing(false); await onChanged(); }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Dialogs --------------------------------- */

function CreateWorkDialog({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({
    subject: "", issueType: "", priority: "MEDIUM", warrantyType: "", chargeType: "",
    chargeAmount: "" as number | "", preferredDate: "", description: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.subject.trim()) { toast.error("A subject is required"); return; }
    setSaving(true);
    try {
      await serviceWarrantyApi.createServiceWork(projectId, {
        subject: form.subject.trim(),
        issueType: form.issueType || undefined,
        priority: form.priority,
        warrantyType: form.warrantyType || null,
        chargeType: form.chargeType || null,
        chargeAmount: form.chargeAmount === "" ? null : Number(form.chargeAmount),
        preferredDate: form.preferredDate || undefined,
        description: form.description || undefined,
      });
      toast.success("Service work logged");
      await onCreated();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not log service work");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log service work</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-500">What's the issue? *</Label>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1" placeholder="e.g. Wardrobe hinge loose" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-500">Type</Label>
              <Input value={form.issueType} onChange={(e) => setForm((f) => ({ ...f, issueType: e.target.value }))} className="mt-1" placeholder="Carpentry, electrical…" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Priority</Label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={`${selectCls} mt-1`}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Warranty claim</Label>
              <select value={form.warrantyType} onChange={(e) => setForm((f) => ({ ...f, warrantyType: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">— Select —</option>
                {WARRANTY_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Free or paid</Label>
              <select value={form.chargeType} onChange={(e) => setForm((f) => ({ ...f, chargeType: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="">— Decide later —</option>
                {CHARGE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            {form.chargeType === "PAID" && (
              <div>
                <Label className="text-xs text-slate-500">Charge amount</Label>
                <Input type="number" min={0} value={form.chargeAmount} onChange={(e) => setForm((f) => ({ ...f, chargeAmount: e.target.value === "" ? "" : Number(e.target.value) }))} className="mt-1" placeholder="0" />
              </div>
            )}
            <div>
              <Label className="text-xs text-slate-500">Preferred date</Label>
              <Input type="date" value={form.preferredDate} onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">Details</Label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Log work
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RaiseInvoiceDialog({ work, suggestedAmount, onClose, onDone }: {
  work: ServiceWork; suggestedAmount: number | null; onClose: () => void; onDone: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    chargeAmount: (suggestedAmount ?? work.chargeAmount ?? "") as number | "",
    gstRate: 18, gstType: "CGST_SGST", collectNow: false, paymentMethod: "CASH",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (form.chargeAmount === "" || Number(form.chargeAmount) <= 0) { toast.error("Enter a charge amount"); return; }
    setSaving(true);
    try {
      await serviceWarrantyApi.raiseInvoice(work.id, {
        chargeAmount: Number(form.chargeAmount),
        gstRate: Number(form.gstRate),
        gstType: form.gstType,
        collectNow: form.collectNow,
        paymentMethod: form.paymentMethod,
      });
      toast.success("Invoice raised");
      await onDone();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not raise invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Raise invoice — {work.subject}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-slate-500">Charge amount *</Label>
              <Input type="number" min={0} value={form.chargeAmount} onChange={(e) => setForm((f) => ({ ...f, chargeAmount: e.target.value === "" ? "" : Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">GST rate %</Label>
              <Input type="number" min={0} value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-500">GST type</Label>
              <select value={form.gstType} onChange={(e) => setForm((f) => ({ ...f, gstType: e.target.value }))} className={`${selectCls} mt-1`}>
                <option value="CGST_SGST">CGST + SGST (intra-state)</option>
                <option value="IGST">IGST (inter-state)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Payment method</Label>
              <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} className={`${selectCls} mt-1`}>
                {["CASH", "UPI", "CARD", "BANK_TRANSFER", "CHEQUE"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.collectNow} onChange={(e) => setForm((f) => ({ ...f, collectNow: e.target.checked }))} className="rounded border-slate-300" />
            Collect payment now (mark invoice paid)
          </label>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
            This creates a real invoice in Billing for the project's customer.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <IndianRupee className="w-4 h-4 mr-2" />} Raise invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
