import { useEffect, type FormEvent } from 'react'
import { canVisitStep, creatorStepIds } from '../../constants'
import { useI18n } from '../../i18n/context'
import { eyebrowClass } from '../../styles'
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

  useEffect(() => {
    document.querySelector('[data-creator-scroll]')?.scrollTo({ top: 0 })
    document.getElementById('creator-title')?.focus()
  }, [step])

  return (
    <div className="isolate h-full min-h-0 overflow-hidden border-x border-grid bg-ink min-[1200px]:mx-[96px] min-[1600px]:mx-[112px]">
      <div className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] bg-ink">
        <nav className="border-b border-grid px-5 py-3 min-[980px]:px-8" aria-label={t.creator.progressLabel}>
          <p className="text-[10px] font-extrabold tracking-[.08em] text-muted-light uppercase">{t.creator.progress(step + 1, creatorStepIds.length)}</p>
          <ol className="mt-2 grid list-none grid-cols-5 gap-2 p-0">
            {creatorStepIds.map((id, index) => {
              const open = canVisitStep(index, form)
              const currentStep = index === step
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={[
                      'flex min-h-11 w-full cursor-pointer items-center gap-2 border border-grid bg-ink p-2 text-left text-[11px] font-extrabold text-muted-light disabled:cursor-not-allowed disabled:opacity-50',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
                      'max-[699px]:text-[0px] max-[699px]:text-transparent',
                      currentStep ? 'border-green! text-white! max-[699px]:[&_span]:text-green!' : index < step ? 'text-white!' : '',
                    ].join(' ')}
                    aria-current={currentStep ? 'step' : undefined}
                    disabled={!open || busy}
                    onClick={() => onStepChange(index)}
                  >
                    <span className="block text-[10px] text-blue max-[699px]:text-xs">{String(index + 1).padStart(2, '0')}</span>
                    {t.steps[id].label}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]" aria-labelledby="creator-title">
          <header className="border-b border-grid px-5 py-5 min-[980px]:px-8">
            <p className={`${eyebrowClass} text-pink`}>{current.label}</p>
            <h1 className="mt-2 max-w-[16ch] text-[clamp(1.8rem,4vw,2.8rem)] leading-[.98] outline-none" id="creator-title" tabIndex={-1}>{current.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-light">{current.description}</p>
          </header>
          <div className="min-h-0">
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

      </div>
    </div>
  )
}
