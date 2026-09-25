interface NumberControlProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
}

export function NumberControl({ value, min, max, onChange, decreaseLabel, increaseLabel }: NumberControlProps) {
  return (
    <div className="grid min-h-12 w-[min(220px,100%)] grid-cols-[42px_1fr_42px] border border-border bg-ink">
      <button className="border-0 bg-transparent text-xl text-green" type="button" aria-label={decreaseLabel} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output className="grid place-items-center border-x border-border font-extrabold">{String(value).padStart(2, '0')}</output>
      <button className="border-0 bg-transparent text-xl text-green" type="button" aria-label={increaseLabel} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}
