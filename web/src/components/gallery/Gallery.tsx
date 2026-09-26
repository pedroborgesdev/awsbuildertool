import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/context'
import { eyebrowClass, scrollbarClass, skeletonClass } from '../../styles'
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
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViewerIndex(null)
    trackRef.current?.scrollTo({ left: 0 })
  }, [result?.jobId])

  function move(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.78, 280), behavior: 'smooth' })
  }

  return (
    <>
      <section className="grid min-w-0 gap-4 overflow-hidden border border-grid bg-panel/50 p-4" aria-labelledby="generated-gallery-title">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className={`${eyebrowClass} text-green`}>{t.gallery.eyebrow}</p>
            <h2 className="mt-1.5 text-xl" id="generated-gallery-title">{t.gallery.title}</h2>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="grid size-11 cursor-pointer place-items-center border border-border bg-ink text-white disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => move(-1)} disabled={loading || images.length < 2} aria-label={t.gallery.previous}>←</button>
            <button className="grid size-11 cursor-pointer place-items-center border border-green bg-green text-ink disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => move(1)} disabled={loading || images.length < 2} aria-label={t.gallery.next}>→</button>
          </div>
        </header>

        <div ref={trackRef} className={`flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 ${scrollbarClass}`} role="region" aria-live="polite" aria-label={t.gallery.title}>
          {loading ? (
            Array.from({ length: 3 }, (_, index) => (
              <div className={`aspect-[4/5] basis-[84%] shrink-0 snap-start border border-grid sm:basis-[56%] lg:basis-[46%] ${skeletonClass}`} key={index} aria-hidden="true" />
            ))
          ) : images.length ? images.map((file, index) => (
            <figure className="group basis-[84%] shrink-0 snap-start border border-grid bg-ink sm:basis-[56%] lg:basis-[46%]" key={file.url}>
              <button
                className="grid aspect-[4/5] w-full cursor-zoom-in place-items-center overflow-hidden border-0 bg-code p-0 text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green"
                type="button"
                onClick={() => setViewerIndex(index)}
                aria-label={t.gallery.open(index + 1)}
              >
                <img className="block size-full object-contain transition-transform duration-200 group-hover:scale-[1.015] group-focus-within:scale-[1.015]" src={file.url} alt={t.gallery.alt(index + 1)} loading="lazy" />
              </button>
              <figcaption className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-t border-grid p-2.5 text-[10px] text-muted-light">
                <span className="font-black text-green">{String(index + 1).padStart(2, '0')}</span>
                <span>{t.gallery.post(index + 1)}</span>
              </figcaption>
            </figure>
          )) : (
            <p className="min-h-52 w-full p-5 text-sm leading-relaxed text-muted-light">{t.gallery.empty}</p>
          )}
        </div>
        {loading && <p className="text-xs text-green" role="status">{t.gallery.composing}</p>}
      </section>
      {viewerIndex !== null && images[viewerIndex] && (
        <ImageViewer images={images} index={viewerIndex} onChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </>
  )
}
