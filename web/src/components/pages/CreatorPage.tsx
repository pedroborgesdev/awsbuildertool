import { useEffect, type FormEvent } from 'react'
import { canVisitStep, choiceFor, colorThemes, contentLevels, creatorStepIds, pageThemes } from '../../constants'
import { useI18n } from '../../i18n/context'
import { BriefForm } from '../form/BriefForm'
import type { AppConfig, GenerateRequest } from '../../types'

interface CreatorPageProps {
  form: GenerateRequest
  config: AppConfig | null
  step: number
  busy: boolean
  error: string
  onStepChange: (step: number) => void
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
  onExit: () => void
  onSubmit: (event: FormEvent) => void
}

export function CreatorPage({
  form,
  config,
  step,
  busy,
  error,
  onStepChange,
  onUpdate,
  onImportPhoto,
  onExit,
  onSubmit,
}: CreatorPageProps) {
  const { t } = useI18n()
  const stepId = creatorStepIds[step]
  const current = t.steps[stepId]
  const format = choiceFor(form.platform)
  const depth = contentLevels.find((item) => item === form.contentLevel)
  const color = colorThemes.find((item) => item === form.colorTheme)
  const appearance = pageThemes.find((item) => item === form.pageTheme)

  useEffect(() => {
    document.querySelector('.creator-scroll')?.scrollTo({ top: 0 })
    document.getElementById('creator-title')?.focus()
  }, [step])

  return (
    <div className="creator-scroll app-scrollbar">
      <div className="creator-layout">
        <nav className="creator-progress" aria-label={t.creator.progressLabel}>
          <p>{t.creator.progress(step + 1, creatorStepIds.length)}</p>
          <ol className="creator-steps">
            {creatorStepIds.map((id, index) => {
              const open = canVisitStep(index, form)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={index === step ? 'creator-step-current' : index < step ? 'creator-step-done' : ''}
                    aria-current={index === step ? 'step' : undefined}
                    disabled={!open || busy}
                    onClick={() => onStepChange(index)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {t.steps[id].label}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className="creator-stage" aria-labelledby="creator-title">
          <header className="step-intro">
            <p className="eyebrow text-pink">{current.label}</p>
            <h1 id="creator-title" tabIndex={-1}>{current.title}</h1>
            <p>{current.description}</p>
          </header>
          <BriefForm
            form={form}
            config={config}
            step={step}
            busy={busy}
            error={error}
            onUpdate={onUpdate}
            onImportPhoto={onImportPhoto}
            onStepChange={onStepChange}
            onExit={onExit}
            onSubmit={onSubmit}
          />
        </section>

        <aside className="creator-aside" aria-label={t.creator.summaryLabel}>
          <article className="brief-preview">
            <p className="eyebrow text-green">{format.pdf ? t.publish.pdfSlides : format.channels.join(' · ')}</p>
            <h2>{form.theme.trim() || t.creator.previewTitle}</h2>
            <p>{form.goal.trim() || t.creator.previewGoal}</p>
            <ul>
              <li>{format.dimensions}</li>
              <li>{t.creator.pageCount(form.postCount)}</li>
              <li>{depth ? t.levels[depth].label : ''}</li>
              <li>{color ? t.colors[color] : ''}</li>
              <li>{appearance ? t.appearance[appearance].label : ''}</li>
              <li>{form.language}</li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  )
}
