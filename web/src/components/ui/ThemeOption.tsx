import type { ColorTheme } from '../../types'

interface ThemeOptionProps {
  value: ColorTheme
  label: string
  selected: boolean
  onSelect: () => void
}

export function ThemeOption({ value, label, selected, onSelect }: ThemeOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`theme-option theme-option-${value} ${selected ? 'theme-option-active' : ''}`}
      onClick={onSelect}
    >
      <span>{label}</span>
    </button>
  )
}
