import { useI18n } from '../../i18n/context'
import { fieldControlClass, panelGridClass } from '../../styles'
import { Field } from '../ui/Field'
import type { GenerateRequest } from '../../types'

interface CentralIdeaSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function CentralIdeaSection({ form, onUpdate }: CentralIdeaSectionProps) {
  const { t } = useI18n()
  const contextLength = form.additionalContext.trim().length

  return (
    <div className={panelGridClass}>
      <Field label={t.idea.topic} hint={`${form.theme.length}/180`}>
        <input className={fieldControlClass} required minLength={3} maxLength={180} value={form.theme} onChange={(e) => onUpdate('theme', e.target.value)} placeholder={t.idea.topicPlaceholder} />
      </Field>
      <Field label={t.idea.goal} hint={`${form.goal.length}/500`}>
        <input className={fieldControlClass} required minLength={3} maxLength={500} value={form.goal} onChange={(e) => onUpdate('goal', e.target.value)} placeholder={t.idea.goalPlaceholder} />
      </Field>
      <Field label={t.idea.audience}>
        <input className={fieldControlClass} value={form.audience} onChange={(e) => onUpdate('audience', e.target.value)} placeholder={t.idea.audiencePlaceholder} />
      </Field>
      <Field
        label={t.idea.context}
        hint={<span className={contextLength >= 200 ? 'font-extrabold text-green' : ''}>{t.idea.contextMinimum(contextLength)}</span>}
      >
        <textarea className={`${fieldControlClass} min-h-[280px] resize-none`} required minLength={200} maxLength={8000} rows={12} value={form.additionalContext} onChange={(e) => onUpdate('additionalContext', e.target.value)} placeholder={t.idea.contextPlaceholder} />
      </Field>
    </div>
  )
}
