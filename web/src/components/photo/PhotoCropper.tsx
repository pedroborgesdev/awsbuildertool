import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../ui/Button'

const cropSize = 420

interface PhotoCropperProps {
  source: string
  onCancel: () => void
  onConfirm: (photo: string) => void
}

export function PhotoCropper({ source, onCancel, onConfirm }: PhotoCropperProps) {
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
    <div className="crop-overlay app-scrollbar" role="dialog" aria-modal="true" aria-label="Crop photo for the footer" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="crop-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="crop-header">
          <div>
            <p className="eyebrow text-blue">About you</p>
            <h2 className="mt-2 text-lg font-bold">Square crop</h2>
          </div>
          <Button variant="close" onClick={onCancel} aria-label="Cancel crop">×</Button>
        </header>
        <div className="crop-body">
          <div className="crop-canvas-shell">
            <canvas
              ref={canvasRef}
              width={cropSize}
              height={cropSize}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={() => { dragRef.current = null }}
              onPointerCancel={() => { dragRef.current = null }}
            />
            <span className="crop-frame" aria-hidden="true" />
          </div>
          <label className="crop-zoom">
            <span className="field-label">Zoom</span>
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} />
          </label>
          <p className="text-xs leading-5 text-muted-light">Drag the photo inside the square.</p>
        </div>
        <footer className="crop-actions">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!image} onClick={finishCrop}>Use this crop</Button>
        </footer>
      </section>
    </div>
  )
}
