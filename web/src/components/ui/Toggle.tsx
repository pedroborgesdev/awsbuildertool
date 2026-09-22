interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'toggle-active' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-box" aria-hidden="true">{checked ? '✓' : ''}</span>
      {label}
    </button>
  )
}
