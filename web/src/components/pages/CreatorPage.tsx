import { useEffect, type FormEvent } from 'react'
import { canVisitStep, choiceFor, colorThemes, contentLevels, creatorStepIds, pageThemes } from '../../constants'
import { useI18n } from '../../i18n/context'
import { eyebrowClass, gridBackgroundClass, scrollbarClass } from '../../styles'
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
    document.querySelector('[data-creator-scroll]')?.scrollTo({ top: 0 })
    document.getElementById('creator-title')?.focus()
  }, [step])

  return (
    <div data-creator-scroll className={`min-h-0 overflow-auto ${scrollbarClass}`}>
      <div className="mx-auto grid w-[min(1180px,100%)] gap-7 px-5 pt-7 pb-[120px] min-[980px]:grid-cols-[180px_minmax(0,1fr)_250px] min-[980px]:items-start min-[980px]:pt-10 min-[980px]:pb-12">
        <nav aria-label={t.creator.progressLabel}>
          <p className="text-xs font-extrabold tracking-[.08em] text-muted-light uppercase min-[980px]:hidden">{t.creator.progress(step + 1, creatorStepIds.length)}</p>
          <ol className="mt-2.5 grid list-none grid-cols-5 gap-2 p-0 min-[980px]:grid-cols-1">
            {creatorStepIds.map((id, index) => {
              const open = canVisitStep(index, form)
              const currentStep = index === step
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={[
                      'w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 min-h-12 border border-grid bg-ink p-2 text-[11px] font-extrabold text-muted-light',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
                      'min-[980px]:flex min-[980px]:items-center min-[980px]:gap-2.5 min-[980px]:text-left',
                      'max-[699px]:text-[0px] max-[699px]:text-transparent',
                      currentStep ? 'border-green! text-white! max-[699px]:[&_span]:text-green!' : index < step ? 'text-white!' : '',
                    ].join(' ')}
                    aria-current={currentStep ? 'step' : undefined}
                    disabled={!open || busy}
                    onClick={() => onStepChange(index)}
                  >
                    <span className="block text-[10px] text-blue min-[980px]:inline max-[699px]:text-xs">{String(index + 1).padStart(2, '0')}</span>
                    {t.steps[id].label}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className="min-w-0" aria-labelledby="creator-title">
          <header>
            <p className={`${eyebrowClass} text-pink`}>{current.label}</p>
            <h1 className="mt-2 max-w-[16ch] text-[clamp(1.8rem,4vw,2.8rem)] leading-[.98] outline-none" id="creator-title" tabIndex={-1}>{current.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-light">{current.description}</p>
          </header>
          <div className="mt-[22px]">
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
          </div>
        </section>

        <aside className="hidden min-w-0 min-[980px]:block" aria-label={t.creator.summaryLabel}>
          <article className={`flex min-h-[280px] flex-col border border-grid p-5 [background-size:42px_42px] ${gridBackgroundClass}`}>
            <p className={`${eyebrowClass} text-green`}>{format.pdf ? t.publish.pdfSlides : format.channels.join(' · ')}</p>
            <h2 className="mt-4 [overflow-wrap:anywhere] text-[1.7rem] leading-[1.05]">{form.theme.trim() || t.creator.previewTitle}</h2>
            <p className="mt-3 text-[13px] leading-normal text-muted-light">{form.goal.trim() || t.creator.previewGoal}</p>
            <ul className="mt-auto flex list-none flex-wrap gap-2 pt-5">
              {[format.dimensions, t.creator.pageCount(form.postCount), depth ? t.levels[depth].label : '', color ? t.colors[color] : '', appearance ? t.appearance[appearance].label : '', form.language].map((item) => (
                <li className="border border-border px-2 py-1.5 text-[11px] font-extrabold" key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </aside>
      </div>
    </div>
  )
}
