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
    </div>
  )
}
