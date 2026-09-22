import { Field } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import type { GenerateRequest } from '../../types'

interface ActionSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function ActionSection({ form, onUpdate }: ActionSectionProps) {
  return (
    <div className="step-fields">
      <Field label="Call to action" hint="optional">
        <input maxLength={280} value={form.cta} onChange={(e) => onUpdate('cta', e.target.value)} placeholder="E.g.: Save this for your next build" />
      </Field>
      <details className="adjustments">
        <summary>Additional adjustments</summary>
        <div className="step-fields">
          <Field label="Voice and tone">
            <input value={form.tone} onChange={(e) => onUpdate('tone', e.target.value)} />
          </Field>
          <div className="toggle-row">
            <Toggle checked={form.firstPageCta} onChange={(value) => onUpdate('firstPageCta', value)} label="Call to action on the first page" />
            <Toggle checked={form.lastPageCta} onChange={(value) => onUpdate('lastPageCta', value)} label="Call to action on the last page" />
          </div>
          <Field label="Anything else to include" hint={`${form.additionalContext.length}/4000`}>
            <textarea maxLength={4000} rows={4} value={form.additionalContext} onChange={(e) => onUpdate('additionalContext', e.target.value)} placeholder="Facts, examples, or topics to leave out." />
          </Field>
        </div>
      </details>
    </div>
  )
}
