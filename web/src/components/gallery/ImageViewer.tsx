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

        <aside className="viewer-downloads app-scrollbar" aria-label={t.viewer.downloads}>
          <p className="eyebrow text-blue">{t.viewer.download}</p>
          <div className="viewer-download-list">
            {images.map((image, imageIndex) => (
              <a
                key={image.url}
                className={imageIndex === index ? 'viewer-download-active' : ''}
                href={image.url}
                download={image.name.split('/').pop()}
                onClick={() => onChange(imageIndex)}
              >
                <span>{String(imageIndex + 1).padStart(2, '0')}</span>
                <b>PNG</b>
                <span aria-hidden="true">↓</span>
              </a>
            ))}
          </div>
        </aside>

        <footer className="viewer-navigation">
          <button type="button" onClick={previous} disabled={images.length < 2}>
            <span aria-hidden="true">←</span> {t.viewer.back}
          </button>
          <span>{current.width} × {current.height}</span>
          <button type="button" onClick={next} disabled={images.length < 2}>
            {t.viewer.next} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
