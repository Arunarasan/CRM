import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, onBlur, ...props }, ref) => {
    // Number fields: most forms parse on change (`Number(v) || 0`), so clearing the box snaps a "0"
    // straight back and the user can't erase it. While the field is being edited we show what they
    // typed (including empty) as long as it still means the same number as the form's value; the
    // form keeps its parsed value and validates on submit as before.
    const [draft, setDraft] = React.useState<string | null>(null)
    const controlledNumber = type === "number" && value !== undefined
    const shown =
      controlledNumber && draft !== null && Number(draft || 0) === Number(value || 0) ? draft : value

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={shown}
        onChange={(e) => {
          if (controlledNumber) setDraft(e.target.value)
          onChange?.(e)
        }}
        onBlur={(e) => {
          setDraft(null)
          onBlur?.(e)
        }}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
