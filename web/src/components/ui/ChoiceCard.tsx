import type { ReactNode } from 'react'

interface ChoiceCardProps {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}

export function ChoiceCard({ selected, onSelect, children }: ChoiceCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`format-card ${selected ? 'format-card-active' : ''}`}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}
