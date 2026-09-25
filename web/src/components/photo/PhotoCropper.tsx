import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/context'
import { eyebrowClass, fieldLabelClass, scrollbarClass } from '../../styles'
import { Button } from '../ui/Button'

const cropSize = 420

interface PhotoCropperProps {
  source: string
  onCancel: () => void
  onConfirm: (photo: string) => void
}

export function PhotoCropper({ source, onCancel, onConfirm }: PhotoCropperProps) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ pointer: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dimensions = useMemo(() => {
    if (!image) return { base: 1, width: cropSize, height: cropSize }
    const base = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight)
    return { base, width: image.naturalWidth * base * zoom, height: image.naturalHeight * base * zoom }
  }, [image, zoom])

  function clamp(next: { x: number; y: number }, width = dimensions.width, height = dimensions.height) {
    return {
      x: Math.min(0, Math.max(cropSize - width, next.x)),
      y: Math.min(0, Math.max(cropSize - height, next.y)),
    }
  }

  useEffect(() => {
    const photo = new Image()
    photo.onload = () => {
      const base = Math.max(cropSize / photo.naturalWidth, cropSize / photo.naturalHeight)
      const width = photo.naturalWidth * base
      const height = photo.naturalHeight * base
      setImage(photo)
      setZoom(1)
      setOffset({ x: (cropSize - width) / 2, y: (cropSize - height) / 2 })
    }
    photo.src = source
  }, [source])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, cropSize, cropSize)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, offset.x, offset.y, dimensions.width, dimensions.height)
  }, [image, offset, dimensions])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', close)
    }
  }, [onCancel])

  function changeZoom(value: number) {
    if (!image) return
    const oldWidth = dimensions.width
    const oldHeight = dimensions.height
    const centerX = (cropSize / 2 - offset.x) / oldWidth
    const centerY = (cropSize / 2 - offset.y) / oldHeight
    const base = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight)
    const width = image.naturalWidth * base * value
    const height = image.naturalHeight * base * value
    setZoom(value)
    setOffset(clamp({ x: cropSize / 2 - centerX * width, y: cropSize / 2 - centerY * height }, width, height))
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const scale = cropSize / event.currentTarget.getBoundingClientRect().width
    dragRef.current = { pointer: event.pointerId, x: event.clientX * scale, y: event.clientY * scale, offsetX: offset.x, offsetY: offset.y }
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointer !== event.pointerId) return
    const scale = cropSize / event.currentTarget.getBoundingClientRect().width
    setOffset(clamp({ x: drag.offsetX + event.clientX * scale - drag.x, y: drag.offsetY + event.clientY * scale - drag.y }))
  }

  function finishCrop() {
    if (!image) return
    const output = document.createElement('canvas')
    output.width = 1080
    output.height = 1080
    const context = output.getContext('2d')
    if (!context) return
    const scale = dimensions.base * zoom
    const sourceX = -offset.x / scale
    const sourceY = -offset.y / scale
    const sourceSide = cropSize / scale
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, sourceX, sourceY, sourceSide, sourceSide, 0, 0, 1080, 1080)
    onConfirm(output.toDataURL('image/jpeg', .9))
  }

  return (
    <div className={`fixed inset-0 z-130 grid place-items-center overflow-auto bg-black/90 p-5 backdrop-blur-sm max-[520px]:items-end max-[520px]:p-0 ${scrollbarClass}`} role="dialog" aria-modal="true" aria-label={t.crop.label} onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="w-[min(580px,100%)] border border-border bg-ink shadow-[16px_16px_0_rgba(0,0,0,.34)] max-[520px]:w-full max-[520px]:shadow-none" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-5 border-b border-grid py-4 pr-[18px] pl-[22px]">
          <div>
            <p className={`${eyebrowClass} text-blue`}>{t.crop.eyebrow}</p>
            <h2 className="mt-2 text-lg font-bold">{t.crop.title}</h2>
          </div>
          <Button variant="close" onClick={onCancel} aria-label={t.crop.cancel}>×</Button>
        </header>
        <div className="grid gap-[18px] p-6 max-[520px]:p-4">
          <div className="relative aspect-square w-[min(420px,100%)] justify-self-center overflow-hidden bg-code [background-image:linear-gradient(45deg,#25313d_25%,transparent_25%),linear-gradient(-45deg,#25313d_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#25313d_75%),linear-gradient(-45deg,transparent_75%,#25313d_75%)] [background-position:0_0,0_10px,10px_-10px,-10px_0] [background-size:20px_20px]">
            <canvas
              className="block size-full cursor-grab touch-none active:cursor-grabbing"
              ref={canvasRef}
              width={cropSize}
              height={cropSize}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={() => { dragRef.current = null }}
              onPointerCancel={() => { dragRef.current = null }}
            />
            <span className="pointer-events-none absolute inset-0 border-[3px] border-blue shadow-[inset_0_0_0_1px_#161d26] before:absolute before:inset-x-0 before:top-1/3 before:bottom-1/3 before:border-y before:border-white/40 before:content-[''] after:absolute after:inset-y-0 after:right-1/3 after:left-1/3 after:border-x after:border-white/40 after:content-['']" aria-hidden="true" />
          </div>
          <label className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5">
            <span className={fieldLabelClass}>{t.crop.zoom}</span>
            <input className="w-full accent-blue" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} />
          </label>
          <p className="text-xs leading-5 text-muted-light">{t.crop.hint}</p>
        </div>
        <footer className="flex justify-end gap-2.5 border-t border-grid px-5 py-4 max-[520px]:flex-wrap max-[520px]:p-3">
          <Button className="max-[520px]:min-w-35 max-[520px]:flex-1" variant="secondary" onClick={onCancel}>{t.crop.dismiss}</Button>
          <Button className="max-[520px]:min-w-35 max-[520px]:flex-1" variant="primary" disabled={!image} onClick={finishCrop}>{t.crop.confirm}</Button>
        </footer>
      </section>
    </div>
  )
}
