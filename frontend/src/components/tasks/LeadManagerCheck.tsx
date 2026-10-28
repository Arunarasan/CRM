/** Tick on a lead task's assign screen: the person assigned also becomes the lead manager (quote owner). */
export default function LeadManagerCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-600">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-semibold text-slate-800">Make lead manager</span>
        {" "}— can edit this lead&apos;s quote and create its project without admin approval; others can&apos;t edit the quote.
      </span>
    </label>
  );
}
