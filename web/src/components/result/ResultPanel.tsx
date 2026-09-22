import { Button } from '../ui/Button'
import type { GenerateResponse, StudioMode } from '../../types'

interface ResultPanelProps {
  mode: StudioMode
  prompt: string
  result: GenerateResponse | null
  stale: boolean
  copied: boolean
  onCopy: () => void
  onDownload: () => void
  onClose: () => void
}

export function ResultPanel({ mode, prompt, result, stale, copied, onCopy, onDownload, onClose }: ResultPanelProps) {
  const content = mode === 'result' && result ? result.script : prompt
  return (
    <section className="mt-8 border border-grid bg-code">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-grid p-4">
        <div>
          <p className="eyebrow text-green">{mode === 'result' ? 'Code and rendering ready' : 'Production prompt'}</p>
          <p className="mt-1 text-sm text-muted-light">
            {mode === 'result' && result ? `${result.filename} • ${result.model} • job ${result.jobId.slice(0, 8)}` : 'Review the production contract'}
          </p>
        </div>
        <div className="flex gap-2">
          {mode === 'result' && <Button variant="mini" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy'}</Button>}
          {mode === 'result' && <Button variant="mini-accent" onClick={onDownload}>Download .py</Button>}
          <Button variant="mini" onClick={onClose}>Close</Button>
        </div>
      </header>
      {stale && <div className="border-b border-orange bg-orange/10 px-5 py-3 text-xs font-bold text-orange">Preview predates the current changes. Generate again to update it.</div>}
      {mode === 'result' && <div className="border-b border-grid px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-green">Reproducible file: studio renderer, content, and layout seed</div>}
      <pre tabIndex={0} className="app-scrollbar max-h-[620px] min-w-0 overflow-auto whitespace-pre-wrap break-all p-5 text-xs leading-6 text-code-text md:p-7">{content}</pre>
    </section>
  )
}
