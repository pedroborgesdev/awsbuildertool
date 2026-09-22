import { useState, type FormEvent } from 'react'
import { stepIssue } from '../../constants'
import { AboutSection } from './AboutSection'
import { ActionSection } from './ActionSection'
import { CentralIdeaSection } from './CentralIdeaSection'
import { FormatSection } from './FormatSection'
import { LookSection } from './LookSection'
import { ReviewStep } from './ReviewStep'
import { Button } from '../ui/Button'
import { ErrorAlert } from '../ui/Alert'
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
  const [attempted, setAttempted] = useState(false)
  const issue = attempted ? stepIssue(step, form) : ''
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
    if (step < 3) {
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
    <form onSubmit={submit} className="brief-form" aria-busy={busy}>
      <fieldset disabled={busy} className="step-panel">
        {step === 0 && <CentralIdeaSection form={form} onUpdate={onUpdate} />}
        {step === 1 && <FormatSection form={form} onUpdate={onUpdate} />}
        {step === 2 && <LookSection form={form} onUpdate={onUpdate} />}
        {step === 3 && (
          <>
            <AboutSection form={form} onUpdate={onUpdate} onImportPhoto={onImportPhoto} />
            <ActionSection form={form} onUpdate={onUpdate} />
            <ReviewStep form={form} onEdit={(next) => { setAttempted(false); onStepChange(next) }} />
          </>
        )}
      </fieldset>
      {issue && <p className="step-issue" role="alert">{issue}</p>}
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="creator-nav">
        <Button variant="secondary" onClick={() => { setAttempted(false); step === 0 ? onExit() : onStepChange(step - 1) }} disabled={busy}>
          {step === 0 ? 'Home' : 'Previous'}
        </Button>
        {step < 3 ? (
          <Button onClick={continueStep} disabled={busy}>Continue</Button>
        ) : (
          <Button type="submit" disabled={generateDisabled}>
            {busy ? 'Creating posts…' : 'Create posts'} <span aria-hidden="true">↗</span>
          </Button>
        )}
      </div>
    </form>
  )
}
