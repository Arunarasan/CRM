import { Input } from "@/components/ui/input";

/**
 * The work spec a tailor needs for one bundle item — stored as JSON text on the bundle item
 * (`work_spec`), so new fields can be added here without a migration.
 */
export interface WorkSpec {
  type?: string;
  width?: string;
  height?: string;
  panels?: string;
  pleat?: string;
  lining?: string;
  notes?: string;
}

export const SPEC_TYPES = ["Curtain", "Roman Blind", "Blind", "Cushion Cover", "Sofa Cover", "Bedsheet", "Other"];
export const PLEATS = ["Pinch pleat", "Eyelet", "Box pleat", "Ripple", "Rod pocket", "American pleat", "None"];
export const LININGS = ["None", "Standard", "Blackout", "Thermal", "Sheer"];

export function parseSpec(json?: string | null): WorkSpec {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as WorkSpec) : {};
  } catch {
    return { notes: json };
  }
}

/** JSON for the API — null when nothing was filled in. */
export function specToJson(spec: WorkSpec): string | null {
  const clean = Object.fromEntries(Object.entries(spec).filter(([, v]) => v != null && String(v).trim() !== ""));
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

/** One-line summary: "Curtain · 54 × 84 in · 2 panels · Pinch pleat · Blackout lining". */
export function formatSpec(spec: WorkSpec): string {
  const parts: string[] = [];
  if (spec.type) parts.push(spec.type);
  if (spec.width || spec.height) parts.push(`${spec.width || "?"} × ${spec.height || "?"} in`);
  if (spec.panels) {
    const window = !spec.type || ["Curtain", "Roman Blind", "Blind"].includes(spec.type);
    parts.push(window ? `${spec.panels} panel${spec.panels === "1" ? "" : "s"}` : `${spec.panels} pcs`);
  }
  if (spec.pleat && spec.pleat !== "None") parts.push(spec.pleat);
  if (spec.lining && spec.lining !== "None") parts.push(`${spec.lining} lining`);
  return parts.join(" · ");
}

const selectCls = "h-9 w-full rounded-md border bg-white px-2 text-sm";

/** Compact spec editor used on the counter sale and on the bundle page. */
export function WorkSpecFields({ value, onChange }: { value: WorkSpec; onChange: (v: WorkSpec) => void }) {
  const set = (patch: Partial<WorkSpec>) => onChange({ ...value, ...patch });
  const isWindow = !value.type || ["Curtain", "Roman Blind", "Blind"].includes(value.type);
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <label className="text-xs col-span-2 md:col-span-1"><span className="text-slate-500">Type</span>
        <select value={value.type ?? ""} onChange={(e) => set({ type: e.target.value || undefined })} className={`${selectCls} mt-1`}>
          <option value="">—</option>
          {SPEC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="text-xs"><span className="text-slate-500">Width (in)</span>
        <Input inputMode="decimal" value={value.width ?? ""} onChange={(e) => set({ width: e.target.value })} className="h-9 mt-1" /></label>
      <label className="text-xs"><span className="text-slate-500">Height (in)</span>
        <Input inputMode="decimal" value={value.height ?? ""} onChange={(e) => set({ height: e.target.value })} className="h-9 mt-1" /></label>
      {isWindow ? (
        <>
          <label className="text-xs"><span className="text-slate-500">Panels</span>
            <Input inputMode="numeric" value={value.panels ?? ""} onChange={(e) => set({ panels: e.target.value })} className="h-9 mt-1" /></label>
          <label className="text-xs"><span className="text-slate-500">Pleat</span>
            <select value={value.pleat ?? ""} onChange={(e) => set({ pleat: e.target.value || undefined })} className={`${selectCls} mt-1`}>
              <option value="">—</option>
              {PLEATS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="text-slate-500">Lining</span>
            <select value={value.lining ?? ""} onChange={(e) => set({ lining: e.target.value || undefined })} className={`${selectCls} mt-1`}>
              <option value="">—</option>
              {LININGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </>
      ) : (
        <label className="text-xs col-span-2 md:col-span-3"><span className="text-slate-500">Pieces</span>
          <Input inputMode="numeric" value={value.panels ?? ""} onChange={(e) => set({ panels: e.target.value })} className="h-9 mt-1" /></label>
      )}
      <label className="text-xs col-span-2 md:col-span-6"><span className="text-slate-500">Work notes</span>
        <Input value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. hooks every 4 in, hem 3 in" className="h-9 mt-1" /></label>
    </div>
  );
}
