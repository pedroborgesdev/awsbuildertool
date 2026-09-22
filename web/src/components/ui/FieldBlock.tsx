import type { ReactNode } from 'react'
import type { Accent } from '../../types'

interface FieldBlockProps {
  number: string
  title: string
  accent: Accent
  children: ReactNode
}

const accentClass: Record<Accent, string> = {
  pink: 'text-pink',
  green: 'text-green',
  orange: 'text-orange',
  blue: 'text-blue',
}

export function FieldBlock({ number, title, accent, children }: FieldBlockProps) {
  return (
    <section className="form-section bg-panel p-5 md:p-7">
      <div className="mb-6 flex items-center gap-3">
        <span className={`step-number ${accentClass[accent]}`}>{number}</span>
        <h3 className="text-base font-bold">{title}</h3>
      </div>
      {children}
    </section>
  )
}
