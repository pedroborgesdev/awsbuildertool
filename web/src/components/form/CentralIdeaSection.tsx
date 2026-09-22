import { Field } from '../ui/Field'
import { FieldBlock } from '../ui/FieldBlock'
import type { GenerateRequest } from '../../types'

interface CentralIdeaSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function CentralIdeaSection({ form, onUpdate }: CentralIdeaSectionProps) {
  return (
    <FieldBlock number="02" title="Central idea" accent="pink">
      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="What is the post topic?" hint={`${form.theme.length}/180`}>
          <input required minLength={3} maxLength={180} value={form.theme} onChange={(e) => onUpdate('theme', e.target.value)} placeholder="E.g.: CI/CD with AWS services" />
        </Field>
        <Field label="What should the post achieve?" hint={`${form.goal.length}/500`}>
          <input required minLength={3} maxLength={500} value={form.goal} onChange={(e) => onUpdate('goal', e.target.value)} placeholder="E.g.: Teach an application's pipeline" />
        </Field>
      </div>
    </FieldBlock>
  )
}
