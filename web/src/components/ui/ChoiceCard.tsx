import type { ReactNode } from 'react'
import { choiceCardClass } from '../../styles'

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
      className={[
        choiceCardClass,
        selected ? 'border-green bg-green/[.07] shadow-[inset_0_-4px_#00e582]' : '',
      ].join(' ')}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}
