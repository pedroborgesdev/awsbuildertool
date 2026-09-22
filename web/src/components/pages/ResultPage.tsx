import { useI18n } from '../../i18n/context'
import { DownloadFile } from '../ui/DownloadFile'
import { Button } from '../ui/Button'
import { Gallery } from '../gallery/Gallery'
import { GenerationCostCard } from '../result/GenerationCostCard'
import type { GenerateResponse } from '../../types'

interface ResultPageProps {
  result: GenerateResponse | null
  stale: boolean
  loading: boolean
  onEdit: () => void
  onReset: () => void
}

export function ResultPage({ result, stale, loading, onEdit, onReset }: ResultPageProps) {
  const { t } = useI18n()
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const hasDownloads = Boolean(preview || documents.length)

  return (
    <div className="result-scroll app-scrollbar">
      <main className="result-page">
        <header className="result-heading">
          <div>
            <p className="eyebrow text-green">{loading ? t.result.creatingEyebrow : t.result.readyEyebrow}</p>
            <h1>{loading ? t.result.creatingTitle : t.result.readyTitle}</h1>
            <p>{loading ? t.result.creatingText : t.result.readyText(images.length)}</p>
          </div>
          <div className="result-actions">
            <Button variant="secondary" onClick={onEdit} disabled={loading}>{t.result.edit}</Button>
            <Button onClick={onReset} disabled={loading}>{t.result.another}</Button>
          </div>
        </header>

        {stale && !loading && (
          <p className="stale-note" role="status">{t.result.stale}</p>
        )}

        <div className="result-layout">
          <Gallery result={result} loading={loading} />
          {!loading && (hasDownloads || result) && (
            <aside className="result-side" aria-label={t.result.downloads}>
              {hasDownloads && (
                <div className="download-stack">
                  <p className="eyebrow text-blue">{t.result.files}</p>
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
