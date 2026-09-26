import { useI18n } from '../../i18n/context'
import { eyebrowClass, scrollbarClass } from '../../styles'
import { ErrorAlert } from '../ui/Alert'
import { DownloadFile } from '../ui/DownloadFile'
import { Button } from '../ui/Button'
import { Gallery } from '../gallery/Gallery'
import { GenerationCostCard } from '../result/GenerationCostCard'
import type { GenerateResponse } from '../../types'

interface ResultPageProps {
  result: GenerateResponse | null
  stale: boolean
  loading: boolean
  error: string
  onEdit: () => void
  onRetry: () => void
  onReset: () => void
}

export function ResultPage({ result, stale, loading, error, onEdit, onRetry, onReset }: ResultPageProps) {
  const { t } = useI18n()
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const hasDownloads = Boolean(preview || documents.length)

  return (
    <div className={`min-h-0 overflow-auto border-x border-grid min-[1200px]:mx-[96px] min-[1600px]:mx-[112px] ${scrollbarClass}`}>
      <div className="sticky top-0 z-30 border-b border-grid bg-ink/95 backdrop-blur-sm">
        <div className="flex min-h-16 w-full items-center justify-end gap-2 overflow-x-auto px-5 py-2.5 min-[980px]:px-8 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <Button variant="secondary" onClick={onEdit} disabled={loading}>{t.result.edit}</Button>
          <Button variant="secondary" onClick={onRetry} disabled={loading || !result}>{t.result.retry}</Button>
          <Button onClick={onReset} disabled={loading}>{t.result.another}</Button>
        </div>
      </div>

      <main className="grid min-h-full w-full min-w-0 gap-6 bg-ink px-5 pt-7 pb-16 min-[980px]:px-8">
        <header>
          <p className={`${eyebrowClass} text-green`}>{loading ? t.result.creatingEyebrow : t.result.readyEyebrow}</p>
          <h1 className="mt-2 max-w-[14ch] text-[clamp(2rem,6vw,3.4rem)] leading-[.98]">{loading ? t.result.creatingTitle : t.result.readyTitle}</h1>
          <p className="mt-3 max-w-[38rem] leading-relaxed text-muted-light">{loading ? t.result.creatingText : t.result.readyText(images.length)}</p>
        </header>

        {error && !loading && <ErrorAlert>{error}</ErrorAlert>}

        {stale && !loading && (
          <p className="border-l-4 border-orange bg-orange/10 px-3.5 py-3 text-sm text-orange" role="status">{t.result.stale}</p>
        )}

        <div className="grid min-w-0 gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_300px] min-[1100px]:items-start">
          <Gallery result={result} loading={loading} />
          {!loading && (hasDownloads || result) && (
            <aside className="grid gap-5 border border-grid bg-panel/50 p-4 min-[1100px]:sticky min-[1100px]:top-20" aria-label={t.result.downloads}>
              {hasDownloads && (
                <div className="grid gap-3">
                  <p className={`${eyebrowClass} text-blue`}>{t.result.files}</p>
                  {preview && <DownloadFile href={preview.url} badge="PNG">{t.result.overview}</DownloadFile>}
                  {documents.map((file) => (
                    <DownloadFile key={file.url} href={file.url} badge="PDF" trailing="↓">{t.result.pdf}</DownloadFile>
                  ))}
                </div>
              )}
              {result && <GenerationCostCard cost={result.cost} />}
            </aside>
          )}
        </div>
      </main>
    </div>
  )
}
