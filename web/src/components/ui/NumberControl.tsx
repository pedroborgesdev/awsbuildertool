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
    <div className="number-control">
      <button type="button" aria-label={decreaseLabel} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output>{String(value).padStart(2, '0')}</output>
      <button type="button" aria-label={increaseLabel} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}
