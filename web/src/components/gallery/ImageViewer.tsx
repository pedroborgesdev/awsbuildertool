import { useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { eyebrowClass, scrollbarClass } from '../../styles'
import { Button } from '../ui/Button'
import type { GeneratedAsset } from '../../types'

type ViewerImage = Pick<GeneratedAsset, 'name' | 'url' | 'width' | 'height'>

interface ImageViewerProps {
  images: ViewerImage[]
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

  const navButtonClass = [
    'min-h-11 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 border border-border bg-transparent text-[11px] font-black text-white',
    'hover:not-disabled:border-blue hover:not-disabled:bg-blue hover:not-disabled:text-ink',
    'focus-visible:border-blue focus-visible:bg-blue focus-visible:text-ink focus-visible:outline-none',
    'max-[760px]:w-full max-[760px]:justify-self-stretch',
  ].join(' ')

  return (
    <div
      className={`fixed inset-0 z-100 grid place-items-center overflow-hidden bg-black/85 p-6 backdrop-blur-[3px] max-[760px]:p-3 ${scrollbarClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={t.viewer.label(index + 1, images.length)}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="grid h-[calc(100dvh-48px)] max-h-[1100px] min-h-0 w-fit max-w-full grid-cols-[minmax(0,max-content)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-border bg-code shadow-[16px_16px_0_rgba(0,0,0,.28)] max-[760px]:h-[calc(100dvh-24px)] max-[760px]:w-full max-[760px]:grid-cols-[minmax(0,1fr)] max-[760px]:shadow-none" onMouseDown={(event) => event.stopPropagation()}>
        <header className="col-span-full flex items-center justify-between gap-5 border-b border-grid bg-ink py-3.5 pr-4 pl-5">
          <p className={`${eyebrowClass} text-green`}>{t.viewer.heading(index + 1, images.length)}</p>
          <Button variant="close" onClick={onClose} autoFocus aria-label={t.viewer.close}>×</Button>
        </header>

        <div className="grid h-full min-h-0 min-w-0 w-fit max-w-[calc(100vw-96px)] place-items-center overflow-hidden bg-ink p-5 [background-image:linear-gradient(to_right,rgba(66,180,255,.11)_1px,transparent_1px),linear-gradient(to_bottom,rgba(66,180,255,.11)_1px,transparent_1px)] [background-size:90px_90px] max-[760px]:w-full max-[760px]:max-w-full max-[760px]:p-3">
          <img className="block h-auto max-h-full w-auto max-w-[min(1200px,calc(100vw-136px))] object-contain shadow-[8px_8px_0_rgba(0,0,0,.32)] max-[760px]:max-w-full" src={current.url} alt={`${t.viewer.alt(index + 1)}: ${current.name}`} />
        </div>

        <footer className="col-span-full grid grid-cols-[minmax(120px,1fr)_auto_auto_minmax(120px,1fr)] items-center gap-3 border-t border-grid bg-ink p-3 max-[760px]:grid-cols-[1fr_auto_1fr] max-[760px]:p-2.5">
          <button className={`${navButtonClass} justify-self-start px-[18px]`} type="button" onClick={previous} disabled={images.length < 2}>
            <span aria-hidden="true">←</span> {t.viewer.back}
          </button>
          <a className="relative inline-flex min-h-11 items-center justify-center gap-2 border border-blue bg-transparent px-4 text-[11px] font-black text-white no-underline hover:bg-blue hover:text-ink focus-visible:bg-blue focus-visible:text-ink focus-visible:outline-none max-[760px]:size-11 max-[760px]:min-h-11 max-[760px]:p-0" href={current.url} download={current.name.split('/').pop()}>
            <svg className="size-4 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5v8M5 7.5 8 10.5 11 7.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
            </svg>
            <span className="max-[760px]:sr-only">{t.viewer.download}</span>
          </a>
          <span className="text-center text-[10px] text-muted-light max-[760px]:hidden">
            {current.width && current.height ? `${current.width} × ${current.height}` : ''}
          </span>
          <button className={`${navButtonClass} justify-self-end border-green bg-green px-[18px] text-ink`} type="button" onClick={next} disabled={images.length < 2}>
            {t.viewer.next} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
