import type { ColorTheme } from '../../types'

interface ThemeOptionProps {
  value: ColorTheme
  label: string
  selected: boolean
  onSelect: () => void
}

const colorClass: Record<ColorTheme, string> = {
  pink: 'text-pink',
  green: 'text-green',
  blue: 'text-blue',
  orange: 'text-orange',
  purple: 'text-purple',
  colorful: 'text-white',
}

export function ThemeOption({ value, label, selected, onSelect }: ThemeOptionProps) {
  const colorful = value === 'colorful'

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={[
        'cursor-pointer grid min-h-13 place-items-center border bg-ink p-2.5 text-xs font-black tracking-[.06em] uppercase',
        'transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
        colorClass[value],
        colorful ? 'hover:border-white' : 'hover:border-current',
        selected
          ? colorful
            ? 'border border-transparent bg-panel [border-image:linear-gradient(90deg,#ff57e9,#00e582,#42b4ff,#ff9900,#ad5cff)_1] shadow-[inset_0_-4px_#42b4ff]'
            : 'border-current bg-[color-mix(in_srgb,currentColor_9%,#161d26)] shadow-[inset_0_-4px_currentColor]'
          : 'border-border',
      ].join(' ')}
      onClick={onSelect}
    >
      <span className={colorful ? 'bg-gradient-to-r from-pink via-blue to-orange bg-clip-text text-transparent' : ''}>{label}</span>
    </button>
  )
}
