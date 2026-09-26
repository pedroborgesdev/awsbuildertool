import { useI18n } from '../../i18n/context'
import { fieldControlClass, panelGridClass } from '../../styles'
import { Field } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import type { GenerateRequest } from '../../types'

interface ActionSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function ActionSection({ form, onUpdate }: ActionSectionProps) {
  const { t } = useI18n()

  return (
    <div className={panelGridClass}>
      <Field label={t.finish.cta} hint={t.finish.ctaHint}>
        <input className={fieldControlClass} maxLength={280} value={form.cta} onChange={(e) => onUpdate('cta', e.target.value)} placeholder={t.finish.ctaPlaceholder} />
      </Field>
      <Field label={t.finish.tone}>
        <input className={fieldControlClass} value={form.tone} onChange={(e) => onUpdate('tone', e.target.value)} />
      </Field>
      <div className="grid gap-3">
        <Toggle checked={form.firstPageCta} onChange={(value) => onUpdate('firstPageCta', value)} label={t.finish.firstCta} />
        <Toggle checked={form.lastPageCta} onChange={(value) => onUpdate('lastPageCta', value)} label={t.finish.lastCta} />
      </div>
    </div>
  )
}
