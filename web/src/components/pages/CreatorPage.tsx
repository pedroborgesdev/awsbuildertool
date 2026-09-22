import { useEffect, type FormEvent } from 'react'
import { canVisitStep, colorThemes, contentLevels, creatorSteps, formats, pageThemes } from '../../constants'
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
  const current = creatorSteps[step]
  const format = formats.find((item) => item.value === form.platform) ?? formats[0]
  const depth = contentLevels.find((item) => item.value === form.contentLevel)
  const color = colorThemes.find((item) => item.value === form.colorTheme)
  const appearance = pageThemes.find((item) => item.value === form.pageTheme)

  useEffect(() => {
    document.querySelector('.creator-scroll')?.scrollTo({ top: 0 })
    document.getElementById('creator-title')?.focus()
  }, [step])

  return (
    <div className="creator-scroll app-scrollbar">
      <div className="creator-layout">
        <nav className="creator-progress" aria-label="Brief progress">
          <p>Step {step + 1} of {creatorSteps.length}</p>
          <ol className="creator-steps">
            {creatorSteps.map((item, index) => {
              const open = canVisitStep(index, form)
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className={index === step ? 'creator-step-current' : index < step ? 'creator-step-done' : ''}
                    aria-current={index === step ? 'step' : undefined}
                    disabled={!open || busy}
                    onClick={() => onStepChange(index)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item.label}
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

        <aside className="creator-aside" aria-label="Brief summary">
          <article className="brief-preview">
            <p className="eyebrow text-green">{format.channel}</p>
            <h2>{form.theme.trim() || 'Your next post'}</h2>
            <p>{form.goal.trim() || 'The goal appears here as you write it.'}</p>
            <ul>
              <li>{format.label}</li>
              <li>{form.postCount} {form.postCount === 1 ? 'page' : 'pages'}</li>
              <li>{depth?.label}</li>
              <li>{color?.label}</li>
              <li>{appearance?.label}</li>
            </ul>
          </article>
        </aside>
      </div>
    </div>
  )
}
