interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`cursor-pointer inline-flex min-h-11 items-center gap-2.5 border bg-ink px-3 py-[9px] text-left text-xs text-white ${checked ? 'border-orange' : 'border-border'}`}
      onClick={() => onChange(!checked)}
    >
      <span className={`grid size-5 place-items-center border text-ink ${checked ? 'border-orange bg-orange' : 'border-[#657384]'}`} aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}
