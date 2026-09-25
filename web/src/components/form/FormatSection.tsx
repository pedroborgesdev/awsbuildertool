import { contentLevels, formatChoices } from '../../constants'
import { useI18n } from '../../i18n/context'
import { fieldLabelClass, panelGridClass } from '../../styles'
import { ChoiceCard } from '../ui/ChoiceCard'
import { Field } from '../ui/Field'
import { NumberControl } from '../ui/NumberControl'
import type { GenerateRequest } from '../../types'

interface FormatSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function FormatSection({ form, onUpdate }: FormatSectionProps) {
  const { t } = useI18n()

  return (
    <div className={panelGridClass}>
      <fieldset>
        <legend className={`${fieldLabelClass} mb-3`}>{t.publish.where}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.publish.whereLabel}>
          {formatChoices.map((choice) => (
            <ChoiceCard key={choice.id} selected={choice.values.includes(form.platform)} onSelect={() => onUpdate('platform', choice.values[0])}>
              <strong className="block text-sm">{choice.dimensions}</strong>
              <span className="mt-2 block text-xs leading-5 text-muted-light">
                {choice.pdf ? t.publish.pdfSlides : t.publish.recommended(choice.channels)}
              </span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={`${fieldLabelClass} mb-3`}>{t.publish.depth}</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.publish.depthLabel}>
          {contentLevels.map((level) => (
            <ChoiceCard key={level} selected={form.contentLevel === level} onSelect={() => onUpdate('contentLevel', level)}>
              <strong className="block text-sm">{t.levels[level].label}</strong>
              <span className="mt-2 block text-xs leading-5 text-muted-light">{t.levels[level].description}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <Field label={t.publish.pages} hint={t.publish.pagesHint}>
        <NumberControl
          value={form.postCount}
          min={1}
          max={10}
          onChange={(value) => onUpdate('postCount', value)}
          decreaseLabel={t.publish.decrease}
          increaseLabel={t.publish.increase}
        />
      </Field>
    </div>
  )
}
