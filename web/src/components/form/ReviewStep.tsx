import { choiceFor, colorThemes, contentLevels, creatorStepIds, pageThemes } from '../../constants'
import { useI18n } from '../../i18n/context'
import type { GenerateRequest } from '../../types'

export function ReviewStep({ form, onEdit }: { form: GenerateRequest; onEdit: (step: number) => void }) {
  const { t } = useI18n()
  const format = choiceFor(form.platform)
  const depth = contentLevels.find((item) => item === form.contentLevel)
  const color = colorThemes.find((item) => item === form.colorTheme)
  const appearance = pageThemes.find((item) => item === form.pageTheme)
  const labels = [t.review.idea, t.review.publish, t.review.look, t.review.about, t.review.finish]
  const summary = [
    form.theme.trim() || t.review.topicMissing,
    `${format.dimensions} · ${format.pdf ? t.publish.pdfSlides : t.publish.recommended(format.channels)} · ${t.review.pages(form.postCount)} · ${depth ? t.levels[depth].label : ''}`,
    `${color ? t.colors[color] : ''} · ${appearance ? t.appearance[appearance].label : ''} · ${form.language}`,
    form.useAboutFooter ? (form.aboutName.trim() || t.review.nameMissing) : t.review.footerOff,
    form.cta.trim() || t.review.ctaMissing,
  ]

  return (
    <section className="border border-grid bg-panel p-[18px]" aria-label={t.review.title}>
      <h2 className="text-base">{t.review.title}</h2>
      <ul className="mt-4 grid list-none gap-2.5 p-0">
        {creatorStepIds.map((id, index) => (
          <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-grid pt-2.5" key={id}>
            <div>
              <span className="block text-[11px] font-extrabold tracking-[.08em] text-muted-light uppercase">{labels[index]}</span>
              <strong className="mt-1 block [overflow-wrap:anywhere] text-sm">{summary[index]}</strong>
            </div>
            <button
              className="min-h-11 cursor-pointer border border-border bg-transparent px-3 text-xs font-extrabold text-white hover:border-white focus-visible:border-white focus-visible:outline-none"
              type="button"
              onClick={() => onEdit(index)}
            >
              {t.review.edit}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
