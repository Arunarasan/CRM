import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { purchaseApi } from "@/api/purchaseApi";
import type { Supplier, SupplierProfile } from "@/types/purchase";
import { PO_STATUS_TONE } from "@/types/purchase";
import { useGoBack } from "@/hooks/useGoBack";
import { toast } from "@/components/ui/toast";
import { apiError } from "@/lib/apiError";
import { resolveFileUrl } from "@/lib/uploadFile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import ImageCaptureField from "@/components/ImageCaptureField";
import {
  ArrowLeft, Truck, Star, Phone, Mail, MessageCircle, MapPin, Pencil,
  Building2, CreditCard, Landmark, Receipt, Gauge, CheckCircle2, AlertTriangle, Wallet,
} from "lucide-react";

const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "UPI", "CHEQUE", "CARD"];

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtDate = (d?: string) => (d ? format(new Date(d), "MMM d, yyyy") : "—");
const digits = (s?: string) => (s || "").replace(/\D/g, "");

export default function SupplierProfilePage() {
  const { id } = useParams();
  const supplierId = Number(id);
  const goBack = useGoBack("/purchases/suppliers");

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<{ amount?: number; paymentMethod: string; paymentDate: string; referenceNumber?: string; proofUrl?: string; notes?: string }>(
    { paymentMethod: "BANK_TRANSFER", paymentDate: new Date().toISOString().slice(0, 10) }
  );
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    purchaseApi.getSupplierProfile(supplierId).then(setProfile).catch(() => setNotFound(true));
  }, [supplierId]);

  useEffect(() => { load(); }, [load]);

  if (notFound) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={goBack}><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">Supplier not found.</div>
      </div>
    );
  }
  if (!profile) return <div className="p-8 text-slate-500">Loading supplier…</div>;

  const s = profile.supplier;
  const creditLimit = profile.creditLimit ?? s.creditLimit ?? 0;
  const creditUsedPct = creditLimit > 0 ? Math.min(100, Math.round((profile.outstandingBalance / creditLimit) * 100)) : 0;

  const openEdit = () => { setForm(s); setEditOpen(true); };

  const openPay = () => {
    setPayForm({ amount: pendingAmt > 0 ? pendingAmt : undefined, paymentMethod: "BANK_TRANSFER", paymentDate: new Date().toISOString().slice(0, 10) });
    setPayOpen(true);
  };
  const submitPay = () => {
    if (!payForm.amount || payForm.amount <= 0) return toast.error("Enter an amount to pay.");
    setPaying(true);
    purchaseApi.paySupplier(supplierId, {
      amount: payForm.amount,
      paymentMethod: payForm.paymentMethod,
      paymentDate: payForm.paymentDate,
      referenceNumber: payForm.referenceNumber || undefined,
      proofUrl: payForm.proofUrl || undefined,
      notes: payForm.notes || undefined,
    })
      .then(() => { setPayOpen(false); load(); toast.success("Payment recorded and split across orders."); })
      .catch((e) => toast.error(apiError(e, "Failed to record the payment.")))
      .finally(() => setPaying(false));
  };

  // Preview how the entered amount splits across open orders, oldest first (queue).
  const allocate = (amount: number) => {
    let remaining = amount;
    const rows = (profile.pendingOrders || []).map((o) => {
      const alloc = Math.max(Math.min(remaining, o.pending), 0);
      remaining -= alloc;
      return { ...o, alloc };
    });
    return { rows, advance: Math.max(remaining, 0) };
  };
  const saveEdit = () => {
    if (!form.name) return toast.error("Supplier name is required.");
    purchaseApi.updateSupplier(supplierId, form)
      .then(() => { setEditOpen(false); load(); toast.success("Supplier updated."); })
      .catch((e) => toast.error(apiError(e, "Failed to update supplier.")));
  };
  const field = (label: string, key: keyof Supplier, type = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} placeholder={placeholder} value={(form[key] as any) ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value })} />
    </div>
  );

  const address = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ");

  const pendingAmt = profile.pendingAmount ?? Math.max((profile.totalOrderedValue || 0) - (profile.totalPaid || 0), 0);
  const stats = [
    { label: "Purchase Orders", value: String(profile.totalOrders), tone: "text-slate-900" },
    { label: "Ordered Value", value: currency(profile.totalOrderedValue), tone: "text-slate-900" },
    { label: "Paid", value: currency(profile.totalPaid), tone: "text-sky-700" },
    { label: "Pending", value: currency(pendingAmt), tone: pendingAmt > 0 ? "text-red-600" : "text-emerald-600" },
    { label: "On-time Delivery", value: profile.onTimeDeliveryPercent != null ? `${profile.onTimeDeliveryPercent}%` : "—", tone: "text-slate-900" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2"><ArrowLeft className="w-4 h-4 mr-2" /> Back to suppliers</Button>

      {/* Header */}
      <div className="bg-white border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck className="w-8 h-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{s.name}</h1>
              {s.status === "INACTIVE"
                ? <Badge className="bg-slate-200 text-slate-500">INACTIVE</Badge>
                : <Badge className="bg-emerald-100 text-emerald-700">ACTIVE</Badge>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`w-4 h-4 ${i <= (s.performanceRating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                ))}
              </span>
              {s.leadTimeDays != null && <span className="text-sm text-slate-500">~{s.leadTimeDays} day lead time</span>}
              {s.contactPerson && <span className="text-sm text-slate-500">· {s.contactPerson}</span>}
            </div>
          </div>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {s.phone && <a href={`tel:${s.phone}`}><Button variant="outline" size="sm"><Phone className="w-4 h-4 mr-1.5" /> Call</Button></a>}
            {s.phone && <a href={`https://wa.me/${digits(s.phone)}`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp</Button></a>}
            {s.email && <a href={`mailto:${s.email}`}><Button variant="outline" size="sm"><Mail className="w-4 h-4 mr-1.5" /> Email</Button></a>}
            <Button size="sm" onClick={openPay}><Wallet className="w-4 h-4 mr-1.5" /> Pay Supplier</Button>
            <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="w-4 h-4 mr-1.5" /> Edit</Button>
          </div>
        </div>
      </div>

      {/* Money stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((st) => (
          <div key={st.label} className="bg-white border rounded-2xl shadow-sm p-4">
            <div className={`text-xl font-black ${st.tone}`}>{st.value}</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">{st.label}</div>
          </div>
        ))}
      </div>

      {/* Credit usage */}
      {creditLimit > 0 && (
        <div className="bg-white border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-semibold text-slate-700">Credit used</span>
            <span className="text-slate-500">{currency(profile.outstandingBalance)} of {currency(creditLimit)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${creditUsedPct >= 90 ? "bg-red-500" : creditUsedPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${creditUsedPct}%` }} />
          </div>
        </div>
      )}

      {/* Delivery performance & auto rating */}
      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
          <Gauge className="w-4 h-4 text-slate-400" /> Delivery Performance
        </div>
        {profile.deliveredOrders > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PerfTile label="On-time rate" value={profile.onTimeDeliveryPercent != null ? `${profile.onTimeDeliveryPercent}%` : "—"} tone="text-slate-900" />
              <PerfTile label="On time" value={String(profile.onTimeOrders)} tone="text-emerald-600" icon={CheckCircle2} />
              <PerfTile label="Late" value={String(profile.lateOrders)} tone={profile.lateOrders > 0 ? "text-red-600" : "text-slate-400"} icon={AlertTriangle} />
              <PerfTile label="Avg delay" value={profile.avgDelayDays > 0 ? `${profile.avgDelayDays}d` : "0d"} tone="text-slate-900" />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 border p-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={`w-5 h-5 ${i <= (profile.autoRating || s.performanceRating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                ))}
              </div>
              <div className="text-sm text-slate-600">
                Auto rating <b>{profile.autoRating ?? "—"}/5</b> — from {profile.onTimeOrders} of {profile.deliveredOrders} deliveries on time.
                <span className="text-slate-400"> Updates automatically each time goods are received.</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            No deliveries recorded yet. Once goods are received against this supplier's orders, the on-time record and star
            rating are calculated automatically from the receipt date vs the expected delivery date.
          </p>
        )}
      </div>

      {/* Contact + Business info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Contact" icon={Building2}>
          <InfoRow icon={Building2} label="Contact person" value={s.contactPerson} />
          <InfoRow icon={Phone} label="Phone" value={s.phone} />
          <InfoRow icon={Mail} label="Email" value={s.email} />
          <InfoRow icon={MapPin} label="Address" value={address || undefined} />
        </InfoCard>

        <InfoCard title="Business & Bank" icon={CreditCard}>
          <InfoRow icon={CreditCard} label="GSTIN" value={s.gstin} />
          <InfoRow icon={CreditCard} label="PAN" value={s.pan} />
          <InfoRow icon={Receipt} label="Payment terms" value={s.paymentTerms} />
          <InfoRow icon={Landmark} label="Bank" value={s.bankName ? `${s.bankName}${s.bankAccountNumber ? ` · ${s.bankAccountNumber}` : ""}${s.bankIfsc ? ` · ${s.bankIfsc}` : ""}` : undefined} />
        </InfoCard>
      </div>

      {/* Purchase history */}
      <Section title={`Purchase History${profile.pastPurchases.length ? ` (${profile.pastPurchases.length})` : ""}`}>
        {profile.pastPurchases.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No purchases yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {profile.pastPurchases.map((po) => (
              <li key={po.id}>
                <Link to={`/purchases/orders/${po.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <span className="font-semibold text-slate-800">{po.poNumber}</span>
                    <span className="text-slate-400 text-xs ml-2">{fmtDate(po.date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={PO_STATUS_TONE[po.status]}>{po.status}</Badge>
                    <span className="font-bold text-slate-800">{currency(po.totalAmount)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Recent payments */}
      {profile.recentPayments && profile.recentPayments.length > 0 && (
        <Section title="Recent Payments">
          <ul className="divide-y text-sm">
            {profile.recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <span className="font-semibold text-slate-800">{currency(p.amount)}</span>
                  <span className="text-slate-400"> · {p.paymentMethod?.replaceAll("_", " ")} · {fmtDate(p.paymentDate)}</span>
                </div>
                {p.proofUrl && (
                  <a href={resolveFileUrl(p.proofUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-primary hover:underline">
                    <img src={resolveFileUrl(p.proofUrl)} alt="proof" className="h-8 w-8 rounded object-cover border" /> Proof
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Pay Supplier dialog — one amount, auto-split across open orders (oldest first) */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pay {s.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border divide-y text-sm">
              <div className="flex justify-between px-3 py-2"><span className="text-slate-500">Total pending (all orders)</span><span className="font-black text-red-600">{currency(pendingAmt)}</span></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPayForm({ ...payForm, amount: pendingAmt || undefined })}
                className="rounded-full border border-primary bg-primary/5 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                Pay all pending · {currency(pendingAmt)}
              </button>
            </div>
            <div className="space-y-1"><Label>Amount to pay now</Label>
              <Input type="number" min={0} value={payForm.amount ?? ""} onChange={(e) => setPayForm({ ...payForm, amount: parseFloat(e.target.value) || undefined })} /></div>

            {/* Live split preview (queue) */}
            {(payForm.amount ?? 0) > 0 && (() => {
              const { rows, advance } = allocate(payForm.amount || 0);
              const applied = rows.filter((r) => r.alloc > 0);
              return (
                <div className="rounded-lg border overflow-hidden text-sm">
                  <div className="px-3 py-1.5 bg-slate-50 font-semibold text-slate-500 text-xs">This payment splits as</div>
                  <ul className="divide-y">
                    {applied.map((r) => (
                      <li key={r.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-slate-700"><b>{r.poNumber}</b> <span className="text-xs text-slate-400">· balance {currency(r.pending)}</span></span>
                        <span className="font-semibold text-sky-700">{currency(r.alloc)}</span>
                      </li>
                    ))}
                    {applied.length === 0 && <li className="px-3 py-2 text-slate-400">No open orders — full amount goes to supplier account.</li>}
                    {advance > 0 && (
                      <li className="flex items-center justify-between px-3 py-2 bg-amber-50">
                        <span className="text-amber-700">Advance to supplier account</span>
                        <span className="font-semibold text-amber-700">{currency(advance)}</span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Method</Label>
                <select className="w-full border rounded-md h-9 px-2 text-sm bg-white" value={payForm.paymentMethod}
                  onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replaceAll("_", " ")}</option>)}
                </select></div>
              <div className="space-y-1"><Label>Date</Label>
                <Input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Reference #</Label>
              <Input value={payForm.referenceNumber ?? ""} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} /></div>
            <ImageCaptureField
              module="PAYMENT"
              label="Payment proof (screenshot / receipt)"
              value={payForm.proofUrl ? resolveFileUrl(payForm.proofUrl) : ""}
              onChange={({ url }) => setPayForm({ ...payForm, proofUrl: url })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={submitPay} disabled={paying}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("Company Name *", "name")}
              {field("Contact Person", "contactPerson")}
              {field("Email", "email", "email")}
              {field("Phone", "phone")}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {field("City", "city")}
              {field("State", "state")}
              {field("Pincode", "pincode")}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field("GSTIN", "gstin")}
              {field("PAN", "pan")}
              {field("Bank Name", "bankName")}
              {field("Account Number", "bankAccountNumber")}
              {field("IFSC", "bankIfsc")}
              {field("Credit Limit (₹)", "creditLimit", "number")}
              {field("Payment Terms", "paymentTerms", "text", "e.g. 30 days credit")}
              {field("Lead Time (days)", "leadTimeDays", "number")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Performance Rating</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.performanceRating ?? 3}
                  onChange={(e) => setForm({ ...form, performanceRating: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{r} star{r > 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <select className="w-full h-10 rounded-md border border-input px-3 text-sm" value={form.status ?? "ACTIVE"}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Supplier["status"] })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <Button className="w-full" onClick={saveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerfTile({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border p-3">
      <div className={`flex items-center gap-1.5 text-lg font-black ${tone}`}>
        {Icon && <Icon className="w-4 h-4" />} {value}
      </div>
      <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
        <Icon className="w-4 h-4 text-slate-400" /> {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-400">{label}</div>
        <div className="font-medium text-slate-800 break-words">{value || "—"}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b bg-slate-50 font-semibold text-slate-800 text-sm">{title}</div>
      {children}
    </div>
  );
}
