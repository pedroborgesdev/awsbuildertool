import { useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { Button } from '../ui/Button'
import type { GeneratedAsset } from '../../types'

interface ImageViewerProps {
  images: GeneratedAsset[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
}

export function ImageViewer({ images, index, onChange, onClose }: ImageViewerProps) {
  const { t } = useI18n()
  const current = images[index]
  const previous = () => onChange((index - 1 + images.length) % images.length)
  const next = () => onChange((index + 1) % images.length)

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [index, images.length, onClose])

  return (
    <div
      className="image-viewer app-scrollbar"
      role="dialog"
      aria-modal="true"
      aria-label={t.viewer.label(index + 1, images.length)}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="viewer-grid" onMouseDown={(event) => event.stopPropagation()}>
        <header className="viewer-header">
          <div>
            <p className="eyebrow text-green">{t.viewer.heading(index + 1, images.length)}</p>
          </div>
          <Button variant="close" onClick={onClose} autoFocus aria-label={t.viewer.close}>×</Button>
        </header>

        <div className="viewer-stage">
          <img src={current.url} alt={`${t.viewer.alt(index + 1)}: ${current.name}`} />
        </div>

        <footer className="viewer-navigation">
          <button type="button" onClick={previous} disabled={images.length < 2}>
            <span aria-hidden="true">←</span> {t.viewer.back}
          </button>
          <a className="viewer-download" href={current.url} download={current.name.split('/').pop()}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5v8M5 7.5 8 10.5 11 7.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
            <span>{t.viewer.download}</span>
          </a>
          <span>{current.width} × {current.height}</span>
          <button type="button" onClick={next} disabled={images.length < 2}>
            {t.viewer.next} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
