import { useEffect, useState } from "react";
import { purchaseApi } from "@/api/purchaseApi";
import { toast } from "@/components/ui/toast";
import type { Supplier, SupplierProfile } from "@/types/purchase";
import { PO_STATUS_TONE } from "@/types/purchase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Truck, Star, Pencil, Search } from "lucide-react";

const currency = (n?: number) => `₹${(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const EMPTY: Partial<Supplier> = { performanceRating: 3, status: "ACTIVE" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<Partial<Supplier>>(EMPTY);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);

  const load = () => purchaseApi.getSuppliers(search || undefined).then(setSuppliers).catch(console.error);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!form.name) return toast.error("Supplier name is required.");
    const req = form.id ? purchaseApi.updateSupplier(form.id, form) : purchaseApi.createSupplier(form);
    req.then(() => { setIsFormOpen(false); setForm(EMPTY); load(); toast.success("Supplier saved."); })
      .catch(() => toast.error("Failed to save supplier."));
  };

  const openProfile = (s: Supplier) => {
    purchaseApi.getSupplierProfile(s.id).then(setProfile).catch(console.error);
  };

  const field = (label: string, key: keyof Supplier, type = "text", placeholder = "") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} placeholder={placeholder} value={(form[key] as any) ?? ""}
        onChange={(e) => setForm({ ...form, [key]: type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input className="pl-9 w-64" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setForm(EMPTY); setIsFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Add Supplier</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col">
            <div className="flex items-start justify-between mb-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Truck className="w-6 h-6" /></div>
              <div className="flex items-center gap-1">
                {s.status === "INACTIVE" && <Badge className="bg-slate-200 text-slate-500">INACTIVE</Badge>}
                <Button variant="ghost" size="icon" onClick={() => { setForm(s); setIsFormOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              </div>
            </div>
            <button className="text-left" onClick={() => openProfile(s)}>
              <h3 className="text-base font-bold text-slate-800 hover:text-primary">{s.name}</h3>
            </button>
            <p className="text-xs font-semibold text-slate-500 mb-2">{s.contactPerson || "No contact person"} · {s.phone || "—"}</p>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i <= (s.performanceRating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
              ))}
              {s.leadTimeDays != null && <span className="text-[11px] text-slate-400 ml-2">~{s.leadTimeDays}d lead time</span>}
            </div>
            <div className="mt-auto pt-3 border-t grid grid-cols-2 gap-y-1 text-xs">
              <span className="text-slate-400">GSTIN</span><span className="font-semibold text-slate-700 text-right">{s.gstin || "—"}</span>
              <span className="text-slate-400">Payment terms</span><span className="font-semibold text-slate-700 text-right">{s.paymentTerms || "—"}</span>
              <span className="text-slate-400">Credit limit</span><span className="font-semibold text-slate-700 text-right">{s.creditLimit != null ? currency(s.creditLimit) : "—"}</span>
            </div>
          </div>
        ))}
        {suppliers.length === 0 && <div className="col-span-full p-8 text-center text-sm text-muted-foreground bg-white border rounded-2xl">No suppliers yet.</div>}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
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
            <Button className="w-full" onClick={save}>{form.id ? "Save Changes" : "Create Supplier"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile dialog */}
      <Dialog open={!!profile} onOpenChange={(open) => !open && setProfile(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {profile && (
            <>
              <DialogHeader><DialogTitle>{profile.supplier.name}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-lg font-black text-slate-900">{profile.totalOrders}</div>
                  <div className="text-[11px] font-semibold text-slate-500">Total POs</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-lg font-black text-slate-900">{currency(profile.totalOrderedValue)}</div>
                  <div className="text-[11px] font-semibold text-slate-500">Ordered Value</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-lg font-black text-red-600">{currency(profile.outstandingBalance)}</div>
                  <div className="text-[11px] font-semibold text-slate-500">Outstanding</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-lg font-black text-slate-900">{profile.onTimeDeliveryPercent != null ? `${profile.onTimeDeliveryPercent}%` : "—"}</div>
                  <div className="text-[11px] font-semibold text-slate-500">On-time Delivery</div>
                </div>
              </div>

              <h4 className="font-bold text-sm text-slate-700 mt-4 mb-2">Past Purchases</h4>
              <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                {profile.pastPurchases.map((po) => (
                  <div key={po.id} className="p-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-bold text-slate-800">{po.poNumber}</span>
                      <span className="text-xs text-slate-400 ml-2">{po.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={PO_STATUS_TONE[po.status]}>{po.status}</Badge>
                      <span className="font-bold">{currency(po.totalAmount)}</span>
                    </div>
                  </div>
                ))}
                {profile.pastPurchases.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">No purchases yet.</div>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
