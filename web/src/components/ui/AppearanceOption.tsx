import type { PageTheme } from '../../types'

interface AppearanceOptionProps {
  value: PageTheme
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

export function AppearanceOption({ value, label, description, selected, onSelect }: AppearanceOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`appearance-option appearance-option-${value} ${selected ? 'appearance-option-active' : ''}`}
      onClick={onSelect}
    >
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  )
}
