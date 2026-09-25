import { colorThemes, languages, pageThemes } from '../../constants'
import { useI18n } from '../../i18n/context'
import { fieldLabelClass, panelGridClass } from '../../styles'
import { AppearanceOption } from '../ui/AppearanceOption'
import { ChoiceCard } from '../ui/ChoiceCard'
import { ThemeOption } from '../ui/ThemeOption'
import type { GenerateRequest } from '../../types'

interface LookSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function LookSection({ form, onUpdate }: LookSectionProps) {
  const { t } = useI18n()

  return (
    <div className={panelGridClass}>
      <fieldset>
        <legend className={`${fieldLabelClass} mb-3`}>{t.look.color}</legend>
        <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-3" role="radiogroup" aria-label={t.look.colorLabel}>
          {colorThemes.map((theme) => (
            <ThemeOption
              key={theme}
              value={theme}
              label={t.colors[theme]}
              selected={form.colorTheme === theme}
              onSelect={() => onUpdate('colorTheme', theme)}
            />
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-light">{t.look.colorNote}</p>
      </fieldset>
      <fieldset>
        <legend className={`${fieldLabelClass} mb-3`}>{t.look.language}</legend>
        <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-3 [&_button]:min-h-13" role="radiogroup" aria-label={t.look.languageLabel}>
          {languages.map((language) => (
            <ChoiceCard key={language} selected={form.language === language} onSelect={() => onUpdate('language', language)}>
              <strong className="block text-sm">{language}</strong>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={`${fieldLabelClass} mb-3`}>{t.look.appearance}</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t.look.appearanceLabel}>
          {pageThemes.map((theme) => (
            <AppearanceOption
              key={theme}
              value={theme}
              label={t.appearance[theme].label}
              description={t.appearance[theme].description}
              selected={form.pageTheme === theme}
              onSelect={() => onUpdate('pageTheme', theme)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
