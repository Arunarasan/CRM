/**
 * "Prices include GST" switch used on every document that charges GST (quote, invoice, counter sale,
 * purchase order, contractor bill, service charge). Off = rates are before GST and GST is added on top;
 * on = the rates already contain GST, which is worked out of them and the total doesn't go up.
 */
export default function GstModeToggle({ inclusive, onChange, disabled, size = "md", className = "" }: {
  inclusive: boolean;
  onChange: (inclusive: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const opt = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={inclusive === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={`whitespace-nowrap rounded-md font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${pad} ${
        inclusive === value ? "bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-200" : "text-slate-500 hover:text-slate-700"}`}
    >
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="GST on prices"
      className={`inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 ${disabled ? "opacity-60" : ""} ${className}`}>
      {opt(false, "+ GST extra")}
      {opt(true, "GST included")}
    </div>
  );
}

/** The GST contained in an amount that already includes `rate`% GST. */
export const gstWithin = (inclusiveAmount: number, rate: number) =>
  rate > 0 ? inclusiveAmount - inclusiveAmount / (1 + rate / 100) : 0;
