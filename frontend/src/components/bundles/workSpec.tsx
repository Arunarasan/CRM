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
  /** Old single note — read for existing orders; new ones use `notesList`. */
  notes?: string;
  /** Work notes, one per box. */
  notesList?: string[];
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

/** Every work note for an item (the old single note first), blanks dropped. */
export function specNotes(spec: WorkSpec): string[] {
  return [spec.notes, ...(spec.notesList ?? [])].map((n) => (n ?? "").trim()).filter(Boolean);
}

/** JSON for the API — null when nothing was filled in. */
export function specToJson(spec: WorkSpec): string | null {
  const notesList = (spec.notesList ?? []).map((n) => n.trim()).filter(Boolean);
  const clean = Object.fromEntries(Object.entries({ ...spec, notesList: notesList.length ? notesList : undefined })
    .filter(([, v]) => v != null && String(v).trim() !== ""));
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

/** Work notes editor used on the counter sale and the order page: any number of notes per item. */
export function WorkSpecFields({ value, onChange }: { value: WorkSpec; onChange: (v: WorkSpec) => void }) {
  // The old single note becomes the first box so nothing is lost when an existing order is edited.
  const notes = [...(value.notes ? [value.notes] : []), ...(value.notesList ?? [])];
  const boxes = notes.length ? notes : [""];
  const write = (list: string[]) => onChange({ ...value, notes: undefined, notesList: list });
  return (
    <div className="space-y-2">
      {boxes.map((n, i) => (
        <div key={i} className="flex items-start gap-2">
          <label className="text-xs flex-1"><span className="text-slate-500">Work note{boxes.length > 1 ? ` ${i + 1}` : ""}</span>
            <Input value={n} onChange={(e) => write(boxes.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="e.g. hooks every 4 in, hem 3 in" className="h-9 mt-1" /></label>
          {boxes.length > 1 && (
            <button type="button" aria-label="Remove note" onClick={() => write(boxes.filter((_, j) => j !== i))}
              className="mt-6 h-7 w-7 shrink-0 rounded-full text-slate-400 hover:bg-slate-100">×</button>
          )}
        </div>
      ))}
      <button type="button" onClick={() => write([...boxes, ""])} className="text-xs font-semibold text-emerald-700">+ Add another work note</button>
    </div>
  );
}
