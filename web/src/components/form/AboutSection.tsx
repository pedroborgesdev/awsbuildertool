import { useI18n } from '../../i18n/context'
import { Field } from '../ui/Field'
import { Toggle } from '../ui/Toggle'
import { PhotoControl } from '../photo/PhotoControl'
import type { GenerateRequest } from '../../types'

interface AboutSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
}

export function AboutSection({ form, onUpdate, onImportPhoto }: AboutSectionProps) {
  const { t } = useI18n()

  return (
    <div className="step-fields">
      <Toggle checked={form.useAboutFooter} onChange={(value) => onUpdate('useAboutFooter', value)} label={t.about.toggle} />
      <fieldset disabled={!form.useAboutFooter} className={`about-fields ${form.useAboutFooter ? '' : 'about-fields-disabled'}`}>
        <div className="about-grid">
          <Field label={t.about.name} hint={`${form.aboutName.length}/80`}>
            <input maxLength={80} value={form.aboutName} onChange={(e) => onUpdate('aboutName', e.target.value)} placeholder={t.about.namePlaceholder} />
          </Field>
          <Field label={t.about.subtitle} hint={`${form.aboutSubtitle.length}/120`}>
            <input maxLength={120} value={form.aboutSubtitle} onChange={(e) => onUpdate('aboutSubtitle', e.target.value)} placeholder={t.about.subtitlePlaceholder} />
          </Field>
          <PhotoControl photo={form.aboutPhoto} onImport={onImportPhoto} onRemove={() => onUpdate('aboutPhoto', '')} />
        </div>
        <p className="field-note">{t.about.note}</p>
      </fieldset>
    </div>
  )
}
