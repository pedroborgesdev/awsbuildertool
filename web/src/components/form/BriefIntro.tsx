import { Alert } from '../ui/Alert'
import { GenerationCostCard } from '../result/GenerationCostCard'
import type { AppConfig, GenerateResponse } from '../../types'

interface BriefIntroProps {
  config: AppConfig | null
  result: GenerateResponse | null
}

export function BriefIntro({ config, result }: BriefIntroProps) {
  return (
    <div className="mb-10 max-w-3xl">
      <p className="eyebrow mb-4 text-pink">01 / Configure authorship and content</p>
      <h2 className="display-title">From brief to <span className="text-green">finished post.</span></h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-light">
        Enter the brief and receive finished posts. The AI writes only the content; the studio calculates three valid compositions per page and selects one within the design-system rules.
      </p>
      {config && !config.mockMode && !config.tokenConfigured && (
        <Alert>
          Configure <code>HF_TOKEN</code> on the server to enable generation. Prompt preview remains available.
        </Alert>
      )}
      {config && !config.rendererReady && (
        <Alert className="mt-3">
          Renderer unavailable: {config.rendererMode}. Check that Python 3 and Pillow are installed.
        </Alert>
      )}
      {result && <GenerationCostCard cost={result.cost} />}
    </div>
  )
}
