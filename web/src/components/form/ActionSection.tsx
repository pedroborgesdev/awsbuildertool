import { Field } from '../ui/Field'
import { FieldBlock } from '../ui/FieldBlock'
import { Toggle } from '../ui/Toggle'
import type { GenerateRequest } from '../../types'

interface ActionSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function ActionSection({ form, onUpdate }: ActionSectionProps) {
  return (
    <FieldBlock number="04" title="Action and context" accent="orange">
      <div className="grid gap-6 lg:grid-cols-3">
        <Field label="Desired CTA" hint="optional">
          <input maxLength={280} value={form.cta} onChange={(e) => onUpdate('cta', e.target.value)} placeholder="E.g.: Save this to build your next pipeline" />
        </Field>
        <Field label="Language">
          <input value={form.language} onChange={(e) => onUpdate('language', e.target.value)} />
        </Field>
        <Field label="Hugging Face model" hint="OpenAI-compatible">
          <input value={form.model} onChange={(e) => onUpdate('model', e.target.value)} placeholder="openai/gpt-oss-120b:fastest" />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Toggle checked={form.firstPageCta} onChange={(value) => onUpdate('firstPageCta', value)} label="CTA on the first post" />
        <Toggle checked={form.lastPageCta} onChange={(value) => onUpdate('lastPageCta', value)} label="CTA on the last post" />
      </div>
      <div className="mt-6">
        <Field label="Additional context" hint={`${form.additionalContext.length}/4000`}>
          <textarea maxLength={4000} rows={5} value={form.additionalContext} onChange={(e) => onUpdate('additionalContext', e.target.value)} placeholder="Required facts, topics, examples, content restrictions…" />
        </Field>
      </div>
    </FieldBlock>
  )
}
