import { colorThemes, contentLevels, formats, pageThemes } from '../../constants'
import { AppearanceOption } from '../ui/AppearanceOption'
import { ChoiceCard } from '../ui/ChoiceCard'
import { Field } from '../ui/Field'
import { FieldBlock } from '../ui/FieldBlock'
import { NumberControl } from '../ui/NumberControl'
import { ThemeOption } from '../ui/ThemeOption'
import type { GenerateRequest } from '../../types'

interface FormatSectionProps {
  form: GenerateRequest
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
}

export function FormatSection({ form, onUpdate }: FormatSectionProps) {
  return (
    <FieldBlock number="03" title="Format and narrative" accent="green">
      <fieldset>
        <legend className="field-label mb-3">Where will it be published?</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Publication format">
          {formats.map((format) => (
            <ChoiceCard key={format.value} selected={form.platform === format.value} onSelect={() => onUpdate('platform', format.value)}>
              <span className="text-xs uppercase tracking-[0.16em] text-muted-light">{format.channel}</span>
              <strong className="mt-3 block text-sm">{format.label}</strong>
              <span className="mt-1 block text-xs text-muted-light">{format.dimensions}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="field-label mb-3">How much information do you want?</legend>
        <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Information level">
          {contentLevels.map((level) => (
            <ChoiceCard key={level.value} selected={form.contentLevel === level.value} onSelect={() => onUpdate('contentLevel', level.value)}>
              <strong className="block text-sm">{level.label}</strong>
              <span className="mt-2 block text-xs leading-5 text-muted-light">{level.description}</span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="field-label mb-3">What will the theme color be?</legend>
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
        <p className="mt-3 text-xs leading-5 text-muted-light">One color keeps the campaign monochromatic. Colorful distributes official colors randomly and reproducibly.</p>
      </fieldset>
      <fieldset className="mt-6">
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
      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr_1fr]">
        <Field label="Quantity" hint="1–10 pages">
          <NumberControl
            value={form.postCount}
            min={1}
            max={10}
            onChange={(value) => onUpdate('postCount', value)}
            decreaseLabel="Decrease pages"
            increaseLabel="Increase pages"
          />
        </Field>
        <Field label="Audience">
          <input value={form.audience} onChange={(e) => onUpdate('audience', e.target.value)} />
        </Field>
        <Field label="Voice and tone">
          <input value={form.tone} onChange={(e) => onUpdate('tone', e.target.value)} />
        </Field>
      </div>
    </FieldBlock>
  )
}
