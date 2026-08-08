import { Input } from "@/components/ui/input";

// Small form primitives shared by the lead dialogs (native selects, styled like
// the rest of the app since there is no shadcn Select component in this project).

export const selectClass =
  "w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm";

export function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TextField({
  label, value, onChange, required, type = "text", placeholder,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} required={required}>
      <Input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function SelectField({
  label, value, onChange, options, required, allowEmpty = true,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select
        className={selectClass}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">Select...</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

export function TextAreaField({
  label, value, onChange, rows = 3, placeholder,
}: {
  label: string;
  value: any;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
        rows={rows}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function CheckboxField({
  label, checked, onChange,
}: { label: string; checked?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-input accent-primary"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1.5 mt-2">
      {children}
    </h4>
  );
}
