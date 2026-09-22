import { colorThemes, contentLevels, creatorStepIds, formats, pageThemes } from '../../constants'
import { useI18n } from '../../i18n/context'
import type { GenerateRequest } from '../../types'

export function ReviewStep({ form, onEdit }: { form: GenerateRequest; onEdit: (step: number) => void }) {
  const { t } = useI18n()
  const format = formats.find((item) => item.value === form.platform) ?? formats[0]
  const depth = contentLevels.find((item) => item === form.contentLevel)
  const color = colorThemes.find((item) => item === form.colorTheme)
  const appearance = pageThemes.find((item) => item === form.pageTheme)
  const labels = [t.review.idea, t.review.publish, t.review.look, t.review.about, t.review.finish]
  const summary = [
    form.theme.trim() || t.review.topicMissing,
    `${format.dimensions} · ${format.value === 'linkedin-document' ? t.publish.recommendedPdf : t.publish.recommended(format.channel)} · ${t.review.pages(form.postCount)} · ${depth ? t.levels[depth].label : ''}`,
    `${color ? t.colors[color] : ''} · ${appearance ? t.appearance[appearance].label : ''} · ${form.language}`,
    form.useAboutFooter ? (form.aboutName.trim() || t.review.nameMissing) : t.review.footerOff,
    form.cta.trim() || t.review.ctaMissing,
  ]

  return (
    <section className="review-card" aria-label={t.review.title}>
      <h2>{t.review.title}</h2>
      <ul>
        {creatorStepIds.map((id, index) => (
          <li key={id}>
            <div>
              <span>{labels[index]}</span>
              <strong>{summary[index]}</strong>
            </div>
            <button type="button" onClick={() => onEdit(index)}>{t.review.edit}</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
