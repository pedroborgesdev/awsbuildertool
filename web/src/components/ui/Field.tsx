import type { ReactNode } from 'react'
import { fieldLabelClass } from '../../styles'

interface FieldProps {
  label: string
  hint?: ReactNode
  children: ReactNode
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block min-w-0 max-w-full">
      <span className="mb-2 flex min-w-0 items-center justify-between gap-3">
        <span className={fieldLabelClass}>{label}</span>
        {hint && <span className="text-[11px] text-muted-light">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
