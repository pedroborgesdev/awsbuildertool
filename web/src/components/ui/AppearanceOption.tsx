import type { PageTheme } from '../../types'

interface AppearanceOptionProps {
  value: PageTheme
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

const appearanceClass: Record<PageTheme, string> = {
  dark: 'bg-code text-white',
  light: 'bg-[#f8f8fa] text-ink',
  both: 'bg-[linear-gradient(105deg,#10161e_0_49.5%,#f8f8fa_50.5%_100%)] text-blue',
}

export function AppearanceOption({ value, label, description, selected, onSelect }: AppearanceOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={[
        'cursor-pointer grid min-h-22 content-center gap-1.5 border px-3.5 py-3 text-left',
        'transition-[border-color,box-shadow,transform] duration-150 hover:border-blue',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
        appearanceClass[value],
        selected ? 'border-blue shadow-[inset_0_-4px_#42b4ff]' : 'border-border',
      ].join(' ')}
      onClick={onSelect}
    >
      <strong className="text-xs tracking-[.08em] uppercase">{label}</strong>
      <span className="text-[11px] leading-normal">{description}</span>
    </button>
  )
}
