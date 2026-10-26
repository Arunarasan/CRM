import type { CompanyProfile } from "@/lib/companyProfile";
import { billToLines, fromLines, gstinError, type BillTo } from "@/lib/billTo";

/**
 * "From" (our company) and "Bill To" (the customer's company) blocks printed on quotations and invoices.
 * While `editing`, the Bill To block becomes a small form; "Save to customer profile" copies the edited
 * details onto the customer record as well (otherwise they apply to this document only).
 */
export default function BillToPanel({ company, value, onChange, editing, label = "Bill To", canSaveToCustomer, saveToCustomer, onSaveToCustomerChange }: {
  company: Partial<CompanyProfile>;
  value: BillTo;
  onChange: (b: BillTo) => void;
  editing: boolean;
  label?: string;
  canSaveToCustomer?: boolean;
  saveToCustomer?: boolean;
  onSaveToCustomerChange?: (v: boolean) => void;
}) {
  const set = (patch: Partial<BillTo>) => onChange({ ...value, ...patch });
  const gErr = editing ? gstinError(value.gstin) : null;
  const input = "w-full rounded border border-slate-300 bg-amber-50 px-2 py-1 text-[13px] text-slate-800";
  const box = "flex-1 min-w-[240px] rounded-[10px] border border-[var(--line,#e2e8f0)] bg-white px-3.5 py-2.5";
  const cap = "text-[12px] uppercase tracking-wide text-slate-500";
  const fromL = fromLines(company);
  const toL = billToLines(value);
  return (
    <div className="flex flex-wrap gap-2.5 mb-4 print:break-inside-avoid">
      <div className={box}>
        <div className={cap}>From</div>
        <div className="text-[15px] font-semibold text-slate-900">{company.name}</div>
        {fromL.map((l) => <div key={l} className="text-[12.5px] text-slate-600 whitespace-pre-line">{l}</div>)}
      </div>
      <div className={box}>
        <div className={cap}>{label}</div>
        {editing ? (
          <div className="mt-1 grid grid-cols-2 gap-1.5 print:hidden">
            <input className={`${input} col-span-2`} placeholder="Company / customer name" value={value.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
            <input className={`${input} ${gErr ? "!border-red-500" : ""}`} placeholder="GSTIN (optional)" maxLength={15} value={value.gstin ?? ""} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
            <input className={input} placeholder="State" value={value.state ?? ""} onChange={(e) => set({ state: e.target.value })} />
            <textarea className={`${input} col-span-2`} rows={2} placeholder="Billing address" value={value.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
            <input className={input} placeholder="Phone" value={value.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
            <input className={input} placeholder="Email" value={value.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
            {gErr && <div className="col-span-2 text-[11.5px] text-red-600">{gErr}</div>}
            {canSaveToCustomer && (
              <label className="col-span-2 mt-1 flex items-center gap-1.5 text-[12.5px] text-slate-700">
                <input type="checkbox" checked={!!saveToCustomer} onChange={(e) => onSaveToCustomerChange?.(e.target.checked)} />
                Save to customer profile
              </label>
            )}
          </div>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-slate-900">{value.name || "—"}</div>
            {toL.map((l) => <div key={l} className="text-[12.5px] text-slate-600 whitespace-pre-line">{l}</div>)}
          </>
        )}
      </div>
    </div>
  );
}
