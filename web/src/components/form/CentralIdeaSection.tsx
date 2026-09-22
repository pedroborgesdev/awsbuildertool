import { Field } from '../ui/Field'
import type { GenerateRequest } from '../../types'

interface CentralIdeaSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function CentralIdeaSection({ form, onUpdate }: CentralIdeaSectionProps) {
  return (
    <div className="step-fields">
      <Field label="What is the post about?" hint={`${form.theme.length}/180`}>
        <input required minLength={3} maxLength={180} value={form.theme} onChange={(e) => onUpdate('theme', e.target.value)} placeholder="E.g.: CI/CD with AWS services" />
      </Field>
      <Field label="What should someone take from it?" hint={`${form.goal.length}/500`}>
        <input required minLength={3} maxLength={500} value={form.goal} onChange={(e) => onUpdate('goal', e.target.value)} placeholder="E.g.: Show how a pipeline gets an app to production" />
      </Field>
      <Field label="Who is it for?">
        <input value={form.audience} onChange={(e) => onUpdate('audience', e.target.value)} placeholder="E.g.: Developers learning AWS" />
      </Field>
      <Field label="Context" hint={`${form.additionalContext.trim().length}/8000`}>
        <textarea className="context-input" required minLength={400} maxLength={8000} rows={12} value={form.additionalContext} onChange={(e) => onUpdate('additionalContext', e.target.value)} placeholder="Facts, examples, sources, and anything the post must include or leave out." />
      </Field>
    </div>
  )
}
