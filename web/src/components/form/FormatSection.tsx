import { contentLevels, formats } from '../../constants'
import { ChoiceCard } from '../ui/ChoiceCard'
import { Field } from '../ui/Field'
import { NumberControl } from '../ui/NumberControl'
import type { GenerateRequest } from '../../types'

interface FormatSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function FormatSection({ form, onUpdate }: FormatSectionProps) {
  return (
    <div className="step-fields">
      <fieldset>
        <legend className="field-label mb-3">Where will it be published?</legend>
        <div className="format-grid" role="radiogroup" aria-label="Publication format">
          {formats.map((format) => (
            <ChoiceCard key={format.value} selected={form.platform === format.value} onSelect={() => onUpdate('platform', format.value)}>
              <span className="text-xs uppercase tracking-[0.16em] text-muted-light">{format.channel}</span>
              <strong className="mt-2 block text-sm">{format.label}</strong>
              <span className="mt-1 block text-xs text-muted-light">{format.dimensions}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label mb-3">How much should it say?</legend>
        <div className="choice-grid" role="radiogroup" aria-label="Information level">
          {contentLevels.map((level) => (
            <ChoiceCard key={level.value} selected={form.contentLevel === level.value} onSelect={() => onUpdate('contentLevel', level.value)}>
              <strong className="block text-sm">{level.label}</strong>
              <span className="mt-2 block text-xs leading-5 text-muted-light">{level.description}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <Field label="Pages" hint="1–10">
        <NumberControl
          value={form.postCount}
          min={1}
          max={10}
          onChange={(value) => onUpdate('postCount', value)}
          decreaseLabel="Decrease pages"
          increaseLabel="Increase pages"
        />
      </Field>
    </div>
  )
}
