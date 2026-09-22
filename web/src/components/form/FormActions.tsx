import { Button } from '../ui/Button'
import type { AppConfig } from '../../types'

interface FormActionsProps {
  busy: 'prompt' | 'generate' | null
  config: AppConfig | null
  onPreview: () => void
}

export function FormActions({ busy, config, onPreview }: FormActionsProps) {
  const generateDisabled = busy !== null || !config?.designSystemReady || !config.rendererReady || (!config.mockMode && !config.tokenConfigured)

  return (
    <div className="flex flex-col gap-3 bg-panel p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
      <p className="max-w-md text-sm leading-6 text-muted-light">Content, algorithmic composition, and final files are generated in one step.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" disabled={busy !== null} onClick={onPreview}>
          {busy === 'prompt' ? 'Building…' : 'Review prompt'}
        </Button>
        <Button variant="primary" type="submit" disabled={generateDisabled}>
          {busy === 'generate' ? 'Generating posts…' : 'Generate posts'} <span aria-hidden="true">↗</span>
        </Button>
      </div>
    </div>
  )
}
