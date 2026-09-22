import { colorThemes, languages, pageThemes } from '../../constants'
import { AppearanceOption } from '../ui/AppearanceOption'
import { ChoiceCard } from '../ui/ChoiceCard'
import { ThemeOption } from '../ui/ThemeOption'
import type { GenerateRequest } from '../../types'

interface LookSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function LookSection({ form, onUpdate }: LookSectionProps) {
  return (
    <div className="step-fields">
      <fieldset>
        <legend className="field-label mb-3">Theme color</legend>
        <div className="theme-picker" role="radiogroup" aria-label="Theme color">
          {colorThemes.map((theme) => (
            <ThemeOption
              key={theme.value}
              value={theme.value}
              label={theme.label}
              selected={form.colorTheme === theme.value}
              onSelect={() => onUpdate('colorTheme', theme.value)}
            />
          ))}
        </div>
        <p className="field-note">One color stays consistent. Colorful uses the Builder Center palette across the set.</p>
      </fieldset>
      <fieldset>
        <legend className="field-label mb-3">Language</legend>
        <div className="language-picker" role="radiogroup" aria-label="Post language">
          {languages.map((language) => (
            <ChoiceCard key={language} selected={form.language === language} onSelect={() => onUpdate('language', language)}>
              <strong className="block text-sm">{language}</strong>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="field-label mb-3">Page appearance</legend>
        <div className="appearance-picker" role="radiogroup" aria-label="Light or dark page appearance">
          {pageThemes.map((theme) => (
            <AppearanceOption
              key={theme.value}
              value={theme.value}
              label={theme.label}
              description={theme.description}
              selected={form.pageTheme === theme.value}
              onSelect={() => onUpdate('pageTheme', theme.value)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  )
}
