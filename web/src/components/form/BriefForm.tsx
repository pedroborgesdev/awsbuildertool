import type { FormEvent } from 'react'
import { AboutSection } from './AboutSection'
import { ActionSection } from './ActionSection'
import { CentralIdeaSection } from './CentralIdeaSection'
import { FormatSection } from './FormatSection'
import { FormActions } from './FormActions'
import type { AppConfig, GenerateRequest } from '../../types'

interface BriefFormProps {
  form: GenerateRequest
  config: AppConfig | null
  busy: 'prompt' | 'generate' | null
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
  onPreview: () => void
  onSubmit: (event: FormEvent) => void
}

export function BriefForm({ form, config, busy, onUpdate, onImportPhoto, onPreview, onSubmit }: BriefFormProps) {
  return (
    <form onSubmit={onSubmit} className="form-shell" aria-busy={busy !== null}>
      <fieldset disabled={busy !== null} className="form-stack">
        <AboutSection form={form} onUpdate={onUpdate} onImportPhoto={onImportPhoto} />
        <CentralIdeaSection form={form} onUpdate={onUpdate} />
        <FormatSection form={form} onUpdate={onUpdate} />
        <ActionSection form={form} onUpdate={onUpdate} />
        <FormActions busy={busy} config={config} onPreview={onPreview} />
      </fieldset>
    </form>
  )
}
