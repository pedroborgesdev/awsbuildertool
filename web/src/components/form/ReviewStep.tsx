import { colorThemes, contentLevels, formats, pageThemes } from '../../constants'
import type { GenerateRequest } from '../../types'

const rows = [
  { step: 0, label: 'Idea' },
  { step: 1, label: 'Publish' },
  { step: 2, label: 'Look' },
  { step: 3, label: 'About you' },
  { step: 4, label: 'Finish' },
]

export function ReviewStep({ form, onEdit }: { form: GenerateRequest; onEdit: (step: number) => void }) {
  const format = formats.find((item) => item.value === form.platform) ?? formats[0]
  const depth = contentLevels.find((item) => item.value === form.contentLevel)
  const color = colorThemes.find((item) => item.value === form.colorTheme)
  const appearance = pageThemes.find((item) => item.value === form.pageTheme)
  const summary = [
    form.theme.trim() || 'Topic not set',
    `${format.channel} · ${format.label} · ${form.postCount} pages · ${depth?.label}`,
    `${color?.label} · ${appearance?.label} · ${form.language}`,
    form.useAboutFooter ? (form.aboutName.trim() || 'Name not set yet') : 'Hidden from the footer',
    form.cta.trim() || 'No call to action',
  ]

  return (
    <section className="review-card" aria-label="Brief review">
      <h2>Review before creating</h2>
      <ul>
        {rows.map((row, index) => (
          <li key={row.label}>
            <div>
              <span>{row.label}</span>
              <strong>{summary[index]}</strong>
            </div>
            <button type="button" onClick={() => onEdit(row.step)}>Edit</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
