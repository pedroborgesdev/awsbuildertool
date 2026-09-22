import { useEffect, useState } from 'react'
import { DownloadFile } from '../ui/DownloadFile'
import { ImageViewer } from './ImageViewer'
import { PipelineItem } from './PipelineItem'
import type { GenerateResponse } from '../../types'

interface GalleryProps {
  result: GenerateResponse | null
  resultIsStale: boolean
  loading: boolean
  theme: string
  pageCount: number
  channel: string
}

export function Gallery({ result, resultIsStale, loading, theme, pageCount, channel }: GalleryProps) {
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => setViewerIndex(null), [result?.jobId])

  return (
    <aside className="gallery-shell workspace-pane workspace-gallery app-scrollbar bg-panel p-5 md:p-7">
      <div className="gallery-sticky">
        <div className="flex items-end justify-between gap-4 border-b border-grid pb-5">
          <div>
            <p className="eyebrow text-blue">03 / Result</p>
            <h2 className="mt-2 text-xl font-bold">Generated posts</h2>
          </div>
          <span className="text-right text-xs text-muted-light">
            {resultIsStale && images.length ? 'Previous preview · ' : ''}
            {images.length ? `${images.length} images` : `${String(pageCount).padStart(2, '0')} expected`}
          </span>
        </div>

        {loading ? (
          <div className="gallery-loading mt-5" role="status">
            <div className="loading-card" />
            <div className="loading-card" />
            <p className="col-span-full mt-2 text-center text-xs text-green">Preparing your campaign…</p>
          </div>
        ) : images.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {images.map((file, index) => (
              <figure key={file.url} className="generated-card">
                <button type="button" onClick={() => setViewerIndex(index)} title={`View ${file.name} at full size`} aria-label={`Open viewer for post ${index + 1}`}>
                  <img src={file.url} alt={`Generated post ${index + 1}: ${file.name}`} loading="lazy" />
                </button>
                <figcaption>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span className="truncate">{file.width} × {file.height} · {file.name.split('/').pop()}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mt-5 aspect-[4/5] border border-grid bg-ink p-5 preview-card">
            <div className="flex items-start justify-between gap-4">
              <span className="preview-logo">
                <img src="/design-assets/brand/lockup-dark.png" alt="AWS Builder Center" />
              </span>
              <span className="text-xs text-muted-light">{String(pageCount).padStart(2, '0')} pages</span>
            </div>
            <div className="mt-auto">
              <p className="text-xs uppercase tracking-[0.2em] text-pink">{channel}</p>
              <p className="mt-3 break-words text-2xl font-bold leading-tight">{theme || 'Your gallery will appear here'}</p>
              <div className="mt-5 h-2 w-20 bg-green" />
            </div>
          </div>
        )}

        {preview && (
          <DownloadFile className="download-file mt-4" href={preview.url} badge="PNG">
            Carousel overview
          </DownloadFile>
        )}

        {documents.length > 0 && (
          <div className="mt-4 grid gap-2">
            {documents.map((file) => (
              <DownloadFile key={file.url} href={file.url} badge="PDF" trailing="↓">
                {file.name.split('/').pop()}
              </DownloadFile>
            ))}
          </div>
        )}

        {result?.executionLog && (
          <details className="mt-4 min-w-0 border border-grid bg-code p-4 text-xs">
            <summary className="cursor-pointer font-bold text-muted-light">Rendering log</summary>
            <pre className="app-scrollbar mt-3 max-h-48 min-w-0 overflow-auto whitespace-pre-wrap break-all text-code-text">{result.executionLog}</pre>
          </details>
        )}

        <div className="mt-7 border-t border-grid pt-6">
          <p className="eyebrow text-muted-light">Pipeline</p>
          <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <PipelineItem n="1" text="Brief validated in Go" active />
            <PipelineItem n="2" text="AI generates content only" active={Boolean(result)} />
            <PipelineItem n="3" text="3 layouts calculated; 1 selected" active={images.length > 0} />
            <PipelineItem n="4" text="Design and files validated" active={images.length > 0} />
          </ol>
        </div>
      </div>
      {viewerIndex !== null && images[viewerIndex] && (
        <ImageViewer images={images} index={viewerIndex} onChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </aside>
  )
}
