import { Plus, Trash2, GripVertical } from 'lucide-react';

/**
 * Shared form primitives for the Website / CMS admin pages. Kept local to the module so the
 * catalog editors stay consistent (labels, spacing, list editors) without pulling in a form lib.
 */

/** Small labelled section divider so compact forms stay scannable. */
export function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}

export function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-700">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[80px] ${props.className ?? ''}`} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        checked ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-input bg-background text-muted-foreground'
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {label}
    </button>
  );
}

/** Edit an array of plain strings (benefits, applications, gallery URLs, highlights…). */
export function StringListEditor({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const list = value ?? [];
  const set = (i: number, v: string) => onChange(list.map((x, j) => (j === i ? v : x)));
  const add = () => onChange([...list, '']);
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-1.5">
      {list.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <TextInput value={item} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          <button type="button" onClick={() => remove(i)} className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}

/** Edit an array of {key,val} objects (spec rows, process steps, FAQ items). Generic over two fields. */
export function PairListEditor<T extends Record<string, any>>({ value, onChange, fields, blank }: {
  value: T[]; onChange: (v: T[]) => void;
  fields: { key: keyof T; placeholder: string }[];
  blank: T;
}) {
  const list = value ?? [];
  const set = (i: number, key: keyof T, v: string) => onChange(list.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  const add = () => onChange([...list, { ...blank }]);
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {list.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded-md border border-dashed p-2">
          <GripVertical className="mt-2 h-4 w-4 shrink-0 text-slate-300" />
          <div className="flex-1 space-y-1.5">
            {fields.map((f) => (
              f.key === fields[fields.length - 1].key && String(f.placeholder).length > 20 ? (
                <TextArea key={String(f.key)} value={item[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} className="min-h-[56px]" />
              ) : (
                <TextInput key={String(f.key)} value={item[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} />
              )
            ))}
          </div>
          <button type="button" onClick={() => remove(i)} className="mt-1 shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  );
}
