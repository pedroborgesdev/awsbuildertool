import { Field } from '../ui/Field'
import { FieldBlock } from '../ui/FieldBlock'
import { Toggle } from '../ui/Toggle'
import { PhotoControl } from '../photo/PhotoControl'
import type { GenerateRequest } from '../../types'

interface AboutSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
}

export function AboutSection({ form, onUpdate, onImportPhoto }: AboutSectionProps) {
  return (
    <FieldBlock number="01" title="About you" accent="blue">
      <Toggle checked={form.useAboutFooter} onChange={(value) => onUpdate('useAboutFooter', value)} label="Use About you in the footer?" />
      <fieldset disabled={!form.useAboutFooter} className={`about-fields mt-6 ${form.useAboutFooter ? '' : 'about-fields-disabled'}`}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_240px]">
          <Field label="Your name" hint={`${form.aboutName.length}/80`}>
            <input maxLength={80} value={form.aboutName} onChange={(e) => onUpdate('aboutName', e.target.value)} placeholder="Ex.: Pedro Borges" />
          </Field>
          <Field label="Your subtitle" hint={`${form.aboutSubtitle.length}/120`}>
            <input maxLength={120} value={form.aboutSubtitle} onChange={(e) => onUpdate('aboutSubtitle', e.target.value)} placeholder="Ex.: Cloud Engineer · AWS Community Builder" />
          </Field>
          <PhotoControl photo={form.aboutPhoto} onImport={onImportPhoto} onRemove={() => onUpdate('aboutPhoto', '')} />
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-light">The photo will be cropped in a square window and saved at 1080 × 1080 px before upload.</p>
      </fieldset>
    </FieldBlock>
  )
}
