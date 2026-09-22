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
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const hasDownloads = Boolean(preview || documents.length)

  return (
    <div className="result-scroll app-scrollbar">
      <main className="result-page">
        <header className="result-heading">
          <div>
            <p className="eyebrow text-green">{loading ? 'Creating' : 'Ready'}</p>
            <h1>{loading ? 'Composing your pages.' : 'Ready to share.'}</h1>
            <p>
              {loading
                ? 'This usually takes a moment. The pages will appear here.'
                : `${images.length} ${images.length === 1 ? 'page is' : 'pages are'} ready to open or download.`}
            </p>
          </div>
          <div className="result-actions">
            <Button variant="secondary" onClick={onEdit} disabled={loading}>Edit brief</Button>
            <Button onClick={onReset} disabled={loading}>Create another</Button>
          </div>
        </header>

        {stale && !loading && (
          <p className="stale-note" role="status">These pages were made before your latest changes. Create them again to refresh the set.</p>
        )}

        <div className="result-layout">
          <Gallery result={result} loading={loading} />
          {!loading && (hasDownloads || result) && (
            <aside className="result-side" aria-label="Downloads">
              {hasDownloads && (
                <div className="download-stack">
                  <p className="eyebrow text-blue">Files</p>
                  {preview && <DownloadFile href={preview.url} badge="PNG">Carousel overview</DownloadFile>}
                  {documents.map((file) => (
                    <DownloadFile key={file.url} href={file.url} badge="PDF" trailing="↓">Download PDF</DownloadFile>
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
