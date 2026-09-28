import { useEffect, useState, type FormEvent } from 'react'
import { creatorStepIds, stepIssue } from '../../constants'
import { useI18n } from '../../i18n/context'
import { AboutSection } from './AboutSection'
import { ActionSection } from './ActionSection'
import { CentralIdeaSection } from './CentralIdeaSection'
import { ContentImagesSection } from './ContentImagesSection'
import { FormatSection } from './FormatSection'
import { LookSection } from './LookSection'
import { ReviewStep } from './ReviewStep'
import { Button } from '../ui/Button'
import { scrollbarClass } from '../../styles'
import type { AppConfig, GenerateRequest } from '../../types'

const errorPopupDurationMs = 8_000

interface BriefFormProps {
  form: GenerateRequest
  config: AppConfig | null
  step: number
  busy: boolean
  error: string
  onUpdate: <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => void
  onImportPhoto: (file?: File) => void
  onImportContentImages: (files: File[]) => void
  onRemoveContentImage: (id: string) => void
  onDismissError: () => void
  onStepChange: (step: number) => void
  onExit: () => void
  onSubmit: (event: FormEvent) => void
}

export function BriefForm({ form, config, step, busy, error, onUpdate, onImportPhoto, onImportContentImages, onRemoveContentImage, onDismissError, onStepChange, onExit, onSubmit }: BriefFormProps) {
  const { t } = useI18n()
  const [attempted, setAttempted] = useState(false)
  const issueKey = attempted ? stepIssue(step, form) : ''
  const popupMessage = issueKey ? t.errors[issueKey] : error
  const lastStep = creatorStepIds.length - 1
  const generateDisabled = busy || !config?.designSystemReady || !config.rendererReady || (!config.mockMode && !config.tokenConfigured)

  useEffect(() => {
    if (!popupMessage) return
    const timeout = window.setTimeout(() => {
      setAttempted(false)
      if (error) onDismissError()
    }, errorPopupDurationMs)
    return () => window.clearTimeout(timeout)
  }, [popupMessage])

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

  function dismissPopup() {
    setAttempted(false)
    if (error) onDismissError()
  }

  return (
    <form onSubmit={submit} className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]" aria-busy={busy}>
      {popupMessage && (
        <div
          className="fixed top-[calc(84px+env(safe-area-inset-top))] left-1/2 z-50 grid w-[min(540px,calc(100vw-24px))] -translate-x-1/2 grid-cols-[minmax(0,1fr)_44px] border border-orange border-l-4 bg-panel text-orange shadow-[7px_7px_0_#10161e]"
          role="alert"
        >
          <p className="self-center px-4 py-3.5 text-sm leading-relaxed font-bold">{popupMessage}</p>
          <button
            className="grid min-h-11 cursor-pointer place-items-center border-0 border-l border-orange bg-orange text-2xl leading-none font-black text-ink hover:bg-white focus-visible:bg-white focus-visible:outline-none"
            type="button"
            onClick={dismissPopup}
            aria-label={t.errors.dismiss}
          >
            ×
          </button>
          <span className="col-span-full block h-1 origin-left bg-orange [animation:popup-countdown_8s_linear_forwards]" aria-hidden="true" />
        </div>
      )}
      <div data-creator-scroll className={`min-h-0 overflow-x-hidden overflow-y-scroll overscroll-y-contain px-5 py-5 min-[980px]:px-8 ${scrollbarClass}`}>
        <fieldset disabled={busy} className="m-0 grid gap-[22px] border-0 p-0">
          {step === 0 && (
            <>
              <CentralIdeaSection form={form} onUpdate={onUpdate} />
              <ContentImagesSection images={form.images} onImport={onImportContentImages} onRemove={onRemoveContentImage} />
              <ActionSection form={form} onUpdate={onUpdate} />
            </>
          )}
          {step === 1 && <FormatSection form={form} onUpdate={onUpdate} />}
          {step === 2 && <LookSection form={form} onUpdate={onUpdate} />}
          {step === 3 && <AboutSection form={form} onUpdate={onUpdate} onImportPhoto={onImportPhoto} />}
          {step === 4 && <ReviewStep form={form} onEdit={(next) => { setAttempted(false); onStepChange(next) }} />}
        </fieldset>
      </div>
      <div className="flex shrink-0 gap-2.5 border-t border-grid bg-ink px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] min-[980px]:justify-between min-[980px]:px-8 min-[980px]:pb-3 [&>button]:flex-1 min-[980px]:[&>button]:min-w-[148px] min-[980px]:[&>button]:flex-none">
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
