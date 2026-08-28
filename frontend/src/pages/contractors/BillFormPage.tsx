import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { contractorApi } from "@/api/contractorApi";
import type { PreparedBill } from "@/types/contractor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useGoBack } from "@/hooks/useGoBack";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const pct = (base: number, p?: number) => (p ? (base * p) / 100 : 0);

/**
 * Raises a contractor bill against a work package. The server pre-measures the claim from
 * verified progress minus what earlier bills already covered; this page lets the site engineer
 * adjust deductions and see the net move live before submitting into the approval ladder.
 */
export default function BillFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const workPackageId = Number(params.get("workPackageId"));
  const goBack = useGoBack(`/contractors/work-packages/${workPackageId}`);
  const contractorId = Number(params.get("contractorId"));

  const [billType, setBillType] = useState(params.get("billType") ?? "RUNNING");
  const [draft, setDraft] = useState<PreparedBill | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workPackageId || !contractorId) return;
    contractorApi.prepareBill(workPackageId, contractorId, billType)
      .then((d) => {
        setDraft(d);
        setForm({
          grossAmount: String(d.grossAmount ?? 0),
          materialDeduction: String(d.materialDeduction ?? 0),
          advanceAdjustment: String(d.advanceAdjustment ?? 0),
          penaltyAmount: "0",
          otherDeduction: "0",
          retentionPercentage: String(d.retentionPercentage ?? 0),
          gstPercentage: String(d.gstPercentage ?? 0),
          tdsPercentage: String(d.tdsPercentage ?? 0),
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not prepare the bill."));
  }, [workPackageId, contractorId, billType]);

  const n = (k: string) => Number(form[k] || 0);

  const totals = useMemo(() => {
    const gross = n("grossAmount");
    const deductions = n("materialDeduction") + n("advanceAdjustment") + n("penaltyAmount") + n("otherDeduction");
    const taxable = Math.max(0, gross - deductions);
    const gst = pct(taxable, n("gstPercentage"));
    const tds = pct(taxable, n("tdsPercentage"));
    const retention = pct(taxable, n("retentionPercentage"));
    return { gross, deductions, taxable, gst, tds, retention, net: Math.max(0, taxable + gst - tds - retention) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const save = async (submit: boolean) => {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      const bill = await contractorApi.createBill({
        contractorId,
        workPackageId,
        bill: {
          billType: billType as never,
          billDate: form.billDate || undefined,
          periodFrom: form.periodFrom || undefined,
          periodTo: form.periodTo || undefined,
          contractorInvoiceNumber: form.contractorInvoiceNumber,
          workCompletedPercentage: draft.workCompletedPercentage,
          grossAmount: n("grossAmount"),
          materialDeduction: n("materialDeduction"),
          advanceAdjustment: n("advanceAdjustment"),
          penaltyAmount: n("penaltyAmount"),
          otherDeduction: n("otherDeduction"),
          retentionPercentage: n("retentionPercentage"),
          gstPercentage: n("gstPercentage"),
          tdsPercentage: n("tdsPercentage"),
          measurementNotes: form.measurementNotes,
          remarks: form.remarks,
        },
        items: draft.items.map((i) => ({
          workPackageItem: i.workPackageItemId ? { id: i.workPackageItemId } : null,
          description: i.description,
          unit: i.unit,
          quantity: i.quantity,
          previouslyBilledQuantity: i.previouslyBilledQuantity,
          rate: i.rate ?? 0,
          amount: i.amount,
        })),
      });
      if (submit) await contractorApi.submitBill(bill.id);
      navigate(`/contractors/bills/${bill.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the bill.");
    } finally { setSaving(false); }
  };

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (!workPackageId || !contractorId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Open this from a work package — a contractor bill is always raised against one.
        <div className="mt-3"><Link to="/contractors/work-packages" className="text-primary hover:underline">Go to work packages</Link></div>
      </div>
    );
  }

  if (!draft) return <div className="p-8 text-sm text-muted-foreground">{error ?? "Preparing bill…"}</div>;

  return (
    <div className="space-y-5">
      <button type="button" onClick={goBack}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <h2 className="text-xl font-black text-slate-900">
          New bill — {draft.contractorName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {draft.workPackageCode} · work {draft.workCompletedPercentage ?? 0}% complete
          {draft.unadjustedAdvance > 0 && ` · ${currency(draft.unadjustedAdvance)} advance outstanding`}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Field label="Bill type">
            <select className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                    value={billType} onChange={(e) => setBillType(e.target.value)}>
              {["RUNNING", "FINAL", "ADVANCE"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Bill date"><Input type="date" onChange={(e) => set("billDate", e.target.value)} /></Field>
          <Field label="Period from"><Input type="date" onChange={(e) => set("periodFrom", e.target.value)} /></Field>
          <Field label="Period to"><Input type="date" onChange={(e) => set("periodTo", e.target.value)} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Contractor's invoice number">
            <Input onChange={(e) => set("contractorInvoiceNumber", e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm">Measured work (from verified progress)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500 border-b">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Description</th>
                  <th className="p-3 font-semibold">Unit</th>
                  <th className="p-3 font-semibold text-right">Billable qty</th>
                  <th className="p-3 font-semibold text-right">Prev. billed</th>
                  <th className="p-3 font-semibold text-right">Rate</th>
                  <th className="p-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {draft.items.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nothing measurable to bill yet — verify a progress report first.
                  </td></tr>
                )}
                {draft.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="p-3">{i.description}</td>
                    <td className="p-3">{i.unit ?? "—"}</td>
                    <td className="p-3 text-right">{i.quantity}</td>
                    <td className="p-3 text-right text-muted-foreground">{i.previouslyBilledQuantity ?? 0}</td>
                    <td className="p-3 text-right">{currency(i.rate)}</td>
                    <td className="p-3 text-right font-semibold">{currency(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t space-y-3">
            <Field label="Measurement notes">
              <Input onChange={(e) => set("measurementNotes", e.target.value)}
                     placeholder="Joint measurement taken with site engineer on…" />
            </Field>
            <Field label="Remarks"><Input onChange={(e) => set("remarks", e.target.value)} /></Field>
          </div>
        </div>

        <div className="bg-white border rounded-2xl shadow-sm p-5 h-fit space-y-3">
          <h3 className="font-bold text-slate-800 text-sm">Bill computation</h3>

          <Field label="Gross amount (₹)">
            <Input type="number" value={form.grossAmount ?? ""} onChange={(e) => set("grossAmount", e.target.value)} />
          </Field>

          <div className="pt-2 border-t">
            <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Deductions</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Material recovery">
                <Input type="number" value={form.materialDeduction ?? ""} onChange={(e) => set("materialDeduction", e.target.value)} />
              </Field>
              <Field label="Advance adjustment">
                <Input type="number" value={form.advanceAdjustment ?? ""} onChange={(e) => set("advanceAdjustment", e.target.value)} />
              </Field>
              <Field label="Penalty">
                <Input type="number" value={form.penaltyAmount ?? ""} onChange={(e) => set("penaltyAmount", e.target.value)} />
              </Field>
              <Field label="Other">
                <Input type="number" value={form.otherDeduction ?? ""} onChange={(e) => set("otherDeduction", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-xs font-semibold uppercase text-slate-400 mb-2">Rates</div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="GST %">
                <Input type="number" value={form.gstPercentage ?? ""} onChange={(e) => set("gstPercentage", e.target.value)} />
              </Field>
              <Field label="TDS %">
                <Input type="number" value={form.tdsPercentage ?? ""} onChange={(e) => set("tdsPercentage", e.target.value)} />
              </Field>
              <Field label="Retention %">
                <Input type="number" value={form.retentionPercentage ?? ""} onChange={(e) => set("retentionPercentage", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="pt-3 border-t space-y-1 text-sm">
            <Row label="Gross" value={currency(totals.gross)} />
            <Row label="Total deductions" value={`− ${currency(totals.deductions)}`} minus />
            <Row label="Taxable" value={currency(totals.taxable)} bold />
            <Row label="GST" value={`+ ${currency(totals.gst)}`} />
            <Row label="TDS" value={`− ${currency(totals.tds)}`} minus />
            <Row label="Retention" value={`− ${currency(totals.retention)}`} minus />
            <div className="border-t pt-2">
              <Row label="Net payable" value={currency(totals.net)} bold big />
            </div>
          </div>

          {error && <div className="text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-md p-3">{error}</div>}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => save(false)} disabled={saving}>
              Save draft
            </Button>
            <Button className="flex-1" onClick={() => save(true)} disabled={saving}>
              {saving ? "Saving…" : "Save & submit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, big, minus }: {
  label: string; value: string; bold?: boolean; big?: boolean; minus?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</span>
      <span className={`${bold ? "font-black" : ""} ${big ? "text-lg" : ""} ${minus ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </span>
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
