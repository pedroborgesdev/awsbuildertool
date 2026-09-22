import type { GenerateResponse } from '../../types'

export function GenerationCostCard({ cost }: { cost: GenerateResponse['cost'] }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency || 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return (
    <section className="cost-card mt-6" aria-label="Generation cost">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-orange">Generation cost</p>
          <p className="mt-2 text-sm text-muted-light">HF + Jev usage reported by providers</p>
        </div>
        <strong className="cost-total">{money.format(cost.total)}</strong>
      </div>
      <div className="cost-breakdown mt-5">
        <div><span>Hugging Face</span><strong>{money.format(cost.hf)}</strong></div>
        <div><span>Jev</span><strong>{money.format(cost.jev)}</strong></div>
      </div>
      {(cost.hfPromptTokens > 0 || cost.hfCompletionTokens > 0) && (
        <p className="mt-3 text-[10px] text-muted-light">HF tokens: {cost.hfPromptTokens.toLocaleString()} input + {cost.hfCompletionTokens.toLocaleString()} output</p>
      )}
      {(cost.jevPromptTokens > 0 || cost.jevCompletionTokens > 0) && (
        <p className="mt-1 text-[10px] text-muted-light">Jev tokens: {cost.jevPromptTokens.toLocaleString()} input + {cost.jevCompletionTokens.toLocaleString()} output</p>
      )}
      {cost.estimated && (
        <p className="mt-4 text-[10px] leading-4 text-muted-light">Usage or token pricing is unavailable for part of this generation, so that provider was not added to the total.</p>
      )}
    </section>
  )
}
