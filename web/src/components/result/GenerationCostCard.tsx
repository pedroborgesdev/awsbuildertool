import { useI18n } from '../../i18n/context'
import { eyebrowClass } from '../../styles'
import type { GenerateResponse } from '../../types'

export function GenerationCostCard({ cost }: { cost: GenerateResponse['cost'] }) {
  const { locale, t } = useI18n()
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: cost.currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
  return (
    <section className="mt-5 border border-border border-l-4 border-l-orange bg-panel p-4" aria-label={t.cost.label}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`${eyebrowClass} text-orange`}>{t.cost.title}</p>
          <p className="mt-2 text-sm text-muted-light">{t.cost.text}</p>
        </div>
        <strong className="whitespace-nowrap text-lg text-orange">{money.format(cost.total)}</strong>
      </div>
      {cost.estimated && (
        <p className="mt-4 text-[10px] leading-4 text-muted-light">{t.cost.estimated}</p>
      )}
    </section>
  )
}
