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
  onRetry: () => void
  onReset: () => void
}

export function ResultPage({ result, stale, loading, error, onRetry, onReset }: ResultPageProps) {
  const { t } = useI18n()
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const hasDownloads = Boolean(preview || documents.length)

  return (
    <div className={`min-h-0 overflow-auto ${scrollbarClass}`}>
      <main className="grid min-h-full w-full gap-6 bg-ink px-5 pt-8 pb-16 min-[1200px]:mx-[72px] min-[1200px]:w-auto min-[1200px]:px-10 min-[1600px]:px-14">
        <header className="grid gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-end">
          <div>
            <p className={`${eyebrowClass} text-green`}>{loading ? t.result.creatingEyebrow : t.result.readyEyebrow}</p>
            <h1 className="mt-2 max-w-[14ch] text-[clamp(2rem,6vw,3.4rem)] leading-[.98]">{loading ? t.result.creatingTitle : t.result.readyTitle}</h1>
            <p className="mt-3 max-w-[38rem] leading-relaxed text-muted-light">{loading ? t.result.creatingText : t.result.readyText(images.length)}</p>
          </div>
          <div className="grid gap-4 min-[720px]:grid-flow-col min-[720px]:justify-end">
            {result && <Button variant="secondary" onClick={onRetry} disabled={loading}>{t.result.retry}</Button>}
            <Button onClick={onReset} disabled={loading}>{t.result.another}</Button>
          </div>
        </header>

        {error && !loading && <ErrorAlert>{error}</ErrorAlert>}

        {stale && !loading && (
          <p className="border-l-4 border-orange bg-orange/10 px-3.5 py-3 text-sm text-orange" role="status">{t.result.stale}</p>
        )}

        <div className="grid gap-4 min-[980px]:grid-cols-[minmax(0,1fr)_280px] min-[980px]:items-start">
          <Gallery result={result} loading={loading} />
          {!loading && (hasDownloads || result) && (
            <aside aria-label={t.result.downloads}>
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
