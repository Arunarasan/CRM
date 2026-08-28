import { useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full border border-forest/15 bg-white px-4 py-3 text-sm text-forest placeholder:text-forest/35 transition-colors focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold'

function Label({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-forest/70">
      {label} {required && <span className="text-gold-dark">*</span>}
    </label>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  className?: string
}

export function Input({
  label,
  required,
  className,
  ...props
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  const id = useId()
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} />
      <input id={id} required={required} className={fieldBase} {...props} />
    </div>
  )
}

export function Textarea({
  label,
  required,
  className,
  ...props
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>) {
  const id = useId()
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} />
      <textarea id={id} required={required} rows={4} className={cn(fieldBase, 'resize-y')} {...props} />
    </div>
  )
}

export function Select({
  label,
  required,
  className,
  children,
  ...props
}: FieldProps & { children: ReactNode } & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'>) {
  const id = useId()
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} />
      <select id={id} required={required} className={cn(fieldBase, 'appearance-none bg-[right_1rem_center] pr-10')} {...props}>
        {children}
      </select>
    </div>
  )
}
