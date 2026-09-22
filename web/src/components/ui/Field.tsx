import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  hint?: string
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="field-label">{label}</span>
        {hint && <span className="text-[11px] text-muted-light">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
