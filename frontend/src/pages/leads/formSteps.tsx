import { Check, ChevronDown } from "lucide-react";

// Compact step-form primitives shared by the admin "New Lead" dialog and the employee-portal
// mobile "Add Lead" sheet, so both read as the same numbered, open/close step form.

export const areaCls = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm min-h-[56px]";

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Local yyyy-mm-dd for today + n days (for quick date chips). */
export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

export function F({ label, required, className = "", children }: {
  label: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors active:scale-95 ${
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** One numbered step: header toggles it; collapsed + filled shows a ✓ and the summary line. */
export function Step({ n, title, hint, summary, open, onToggle, onNext, children }: {
  n: number; title: string; hint?: string; summary?: string; open: boolean;
  onToggle: () => void; onNext?: () => void; children: React.ReactNode;
}) {
  const done = !!summary;
  return (
    <section className={`rounded-lg border transition-colors ${open ? "border-primary/40 bg-card shadow-sm" : "bg-muted/20"}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-emerald-600 text-white" : open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          {done && !open ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          {!open && (
            <span className="block truncate text-xs text-muted-foreground">{summary || hint}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {children}
          {onNext && (
            <div className="flex justify-end">
              <button type="button" onClick={onNext} className="text-xs font-semibold text-primary hover:underline">
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Open-steps state + toggle / next helpers for a fixed step order. */
export function stepControls<K extends string>(
  order: K[], openSteps: Set<K>, setOpenSteps: React.Dispatch<React.SetStateAction<Set<K>>>,
) {
  const toggle = (k: K) => setOpenSteps((s) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const goNext = (k: K) => setOpenSteps((s) => {
    const next = new Set(s);
    next.delete(k);
    const after = order[order.indexOf(k) + 1];
    if (after) next.add(after);
    return next;
  });
  return (k: K, summary: string) => ({
    n: order.indexOf(k) + 1,
    open: openSteps.has(k),
    onToggle: () => toggle(k),
    summary,
    onNext: order.indexOf(k) < order.length - 1 ? () => goNext(k) : undefined,
  });
}
