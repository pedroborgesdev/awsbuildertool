import { useState, type FormEvent } from 'react'
import { creatorStepIds, stepIssue } from '../../constants'
import { useI18n } from '../../i18n/context'
import { AboutSection } from './AboutSection'
import { ActionSection } from './ActionSection'
import { CentralIdeaSection } from './CentralIdeaSection'
import { FormatSection } from './FormatSection'
import { LookSection } from './LookSection'
import { ReviewStep } from './ReviewStep'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/Alert'
import { scrollbarClass } from '../../styles'
import type { AppConfig, GenerateRequest } from '../../types'

interface BriefFormProps {
  form: GenerateRequest
  config: AppConfig | null
  step: number
  busy: boolean
  error: string
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
  onStepChange: (step: number) => void
  onExit: () => void
  onSubmit: (event: FormEvent) => void
}

export function BriefForm({ form, config, step, busy, error, onUpdate, onImportPhoto, onStepChange, onExit, onSubmit }: BriefFormProps) {
  const { t } = useI18n()
  const [attempted, setAttempted] = useState(false)
  const issueKey = attempted ? stepIssue(step, form) : ''
  const lastStep = creatorStepIds.length - 1
  const generateDisabled = busy || !config?.designSystemReady || !config.rendererReady || (!config.mockMode && !config.tokenConfigured)

  function continueStep() {
    const problem = stepIssue(step, form)
    if (problem) {
      setAttempted(true)
      return
    }
    setAttempted(false)
    onStepChange(step + 1)
  }

  function submit(event: FormEvent) {
    if (step < lastStep) {
      event.preventDefault()
      continueStep()
      return
    }
    const problem = stepIssue(0, form)
    if (problem) {
      event.preventDefault()
      setAttempted(true)
      onStepChange(0)
      return
    }
    onSubmit(event)
  }

  return (
    <form onSubmit={submit} className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]" aria-busy={busy}>
      <div data-creator-scroll className={`min-h-0 overflow-x-hidden overflow-y-scroll overscroll-y-contain pr-3 pb-5 ${scrollbarClass}`}>
        <fieldset disabled={busy} className="m-0 grid gap-[22px] border-0 p-0">
          {step === 0 && (
            <>
              <CentralIdeaSection form={form} onUpdate={onUpdate} />
              <ActionSection form={form} onUpdate={onUpdate} />
            </>
          )}
          {step === 1 && <FormatSection form={form} onUpdate={onUpdate} />}
          {step === 2 && <LookSection form={form} onUpdate={onUpdate} />}
          {step === 3 && <AboutSection form={form} onUpdate={onUpdate} onImportPhoto={onImportPhoto} />}
          {step === 4 && <ReviewStep form={form} onEdit={(next) => { setAttempted(false); onStepChange(next) }} />}
        </fieldset>
        {issueKey && <p className="mt-[22px] border-l-4 border-orange bg-orange/10 px-3.5 py-3 text-sm text-orange" role="alert">{t.errors[issueKey]}</p>}
        {error && <div className="mt-[22px]"><ErrorAlert>{error}</ErrorAlert></div>}
      </div>
      <div className="flex shrink-0 gap-2.5 border-t border-grid bg-ink py-3 pb-[calc(12px+env(safe-area-inset-bottom))] [&>button]:flex-1 min-[980px]:justify-between min-[980px]:pb-3 min-[980px]:[&>button]:min-w-[148px] min-[980px]:[&>button]:flex-none">
        <Button variant="secondary" onClick={() => { setAttempted(false); step === 0 ? onExit() : onStepChange(step - 1) }} disabled={busy}>
          {step === 0 ? t.nav.home : t.nav.previous}
        </Button>
        {step < lastStep ? (
          <Button onClick={continueStep} disabled={busy}>{t.nav.continue}</Button>
        ) : (
          <Button type="submit" disabled={generateDisabled}>
            {busy ? t.nav.creating : t.nav.create} <span aria-hidden="true">↗</span>
          </Button>
        )}
      </div>
    </form>
  )
}
