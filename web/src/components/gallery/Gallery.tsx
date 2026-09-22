import { useEffect, useState } from 'react'
import { ImageViewer } from './ImageViewer'
import type { GenerateResponse } from '../../types'

interface GalleryProps {
  result: GenerateResponse | null
  loading: boolean
}

export function Gallery({ result, loading }: GalleryProps) {
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => setViewerIndex(null), [result?.jobId])

  if (loading) {
    return (
      <div className="gallery-loading" role="status" aria-live="polite">
        <div className="loading-card" />
        <div className="loading-card" />
        <p>Composing your pages…</p>
      </div>
    )
  }

  if (!images.length) {
    return <p className="gallery-empty-note">Your pages will appear here when they are ready.</p>
  }

  return (
    <>
      <div className="gallery-grid">
        {images.map((file, index) => (
          <figure key={file.url} className="generated-card">
            <button type="button" onClick={() => setViewerIndex(index)} aria-label={`Open post ${index + 1}`}>
              <img src={file.url} alt={`Post ${index + 1}`} loading="lazy" />
            </button>
            <figcaption>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <span>Post {index + 1}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {viewerIndex !== null && images[viewerIndex] && (
        <ImageViewer images={images} index={viewerIndex} onChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </>
  )
}
