import { useEffect, useState } from 'react'
import { useI18n } from '../../i18n/context'
import { ImageViewer } from './ImageViewer'
import type { GenerateResponse } from '../../types'

interface GalleryProps {
  result: GenerateResponse | null
  loading: boolean
}

export function Gallery({ result, loading }: GalleryProps) {
  const { t } = useI18n()
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => setViewerIndex(null), [result?.jobId])

  if (loading) {
    const loadingClass = 'aspect-[4/5] animate-loading-sweep border border-grid bg-[linear-gradient(110deg,#161d26_20%,#25313d_45%,#161d26_70%)] [background-size:220%_100%] motion-reduce:animate-none'
    return (
      <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2" role="status" aria-live="polite">
        <div className={loadingClass} />
        <div className={loadingClass} />
        <p className="text-center text-xs text-green">{t.gallery.composing}</p>
      </div>
    )
  }

  if (!images.length) {
    return <p className="mt-3 border border-grid p-6 text-sm leading-relaxed text-muted-light">{t.gallery.empty}</p>
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
        {images.map((file, index) => (
          <figure className="group min-w-0 border border-grid bg-ink" key={file.url}>
            <button
              className="grid cursor-pointer min-h-45 w-full place-items-center overflow-hidden border-0 bg-code p-0 text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green max-[520px]:min-h-35"
              type="button"
              onClick={() => setViewerIndex(index)}
              aria-label={t.gallery.open(index + 1)}
            >
              <img className="block h-auto max-h-[520px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.015] group-focus-within:scale-[1.015]" src={file.url} alt={t.gallery.alt(index + 1)} loading="lazy" />
            </button>
            <figcaption className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-t border-grid p-2.5 text-[10px] text-muted-light">
              <span className="font-black text-green">{String(index + 1).padStart(2, '0')}</span>
              <span>{t.gallery.post(index + 1)}</span>
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
