import { useI18n } from '../../i18n/context'
import { fieldControlClass, panelGridClass } from '../../styles'
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
    <div className={panelGridClass}>
      <Toggle checked={form.useAboutFooter} onChange={(value) => onUpdate('useAboutFooter', value)} label={t.about.toggle} />
      <fieldset disabled={!form.useAboutFooter} className={`transition-opacity duration-150 ${form.useAboutFooter ? '' : 'opacity-[.38]'}`}>
        <div className="grid gap-3 min-[720px]:grid-cols-2">
          <Field label={t.about.name} hint={`${form.aboutName.length}/80`}>
            <input className={fieldControlClass} maxLength={80} value={form.aboutName} onChange={(e) => onUpdate('aboutName', e.target.value)} placeholder={t.about.namePlaceholder} />
          </Field>
          <Field label={t.about.subtitle} hint={`${form.aboutSubtitle.length}/120`}>
            <input className={fieldControlClass} maxLength={120} value={form.aboutSubtitle} onChange={(e) => onUpdate('aboutSubtitle', e.target.value)} placeholder={t.about.subtitlePlaceholder} />
          </Field>
          <PhotoControl photo={form.aboutPhoto} onImport={onImportPhoto} onRemove={() => onUpdate('aboutPhoto', '')} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-light">{t.about.note}</p>
      </fieldset>
    </div>
  )
}
