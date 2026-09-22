import type { GenerateResponse } from '../../types'

export function GenerationCostCard({ cost }: { cost: GenerateResponse['cost'] }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return (
    <section className="cost-card mt-5" aria-label="Estimated cost">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-orange">Estimated cost</p>
          <p className="mt-2 text-sm text-muted-light">For this set of posts</p>
        </div>
        <strong className="cost-total">{money.format(cost.total)}</strong>
      </div>
      {cost.estimated && (
        <p className="mt-4 text-[10px] leading-4 text-muted-light">Part of the usage wasn&apos;t priced, so it isn&apos;t in the total.</p>
      )}
    </section>
  )
}
