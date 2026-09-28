import { useLayoutEffect, useRef } from 'react'
import { useI18n } from '../../i18n/context'
import { fieldLabelClass } from '../../styles'
import { Button } from '../ui/Button'
import type { ExternalImage } from '../../types'

interface ContentImagesSectionProps {
  images: ExternalImage[]
  onImport: (files: File[]) => void
  onRemove: (id: string) => void
}

export function ContentImagesSection({ images, onImport, onRemove }: ContentImagesSectionProps) {
  const { t } = useI18n()
  const remaining = 5 - images.length
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const scrollPositionRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (scrollPositionRef.current === null) return
    const scroller = triggerRef.current?.closest<HTMLElement>('[data-creator-scroll]')
    if (scroller) scroller.scrollTop = scrollPositionRef.current
    scrollPositionRef.current = null
    triggerRef.current?.focus({ preventScroll: true })
  }, [images.length])

  function openFilePicker() {
    const scroller = triggerRef.current?.closest<HTMLElement>('[data-creator-scroll]')
    scrollPositionRef.current = scroller?.scrollTop ?? null
    inputRef.current?.click()
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden border border-grid bg-panel p-[18px]">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={fieldLabelClass}>{t.images.title}</p>
          <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-light">{t.images.note}</p>
        </div>
        <span className="shrink-0 text-xs font-extrabold text-blue">{images.length}/5</span>
      </div>

      {images.length > 0 && (
        <ul className="mt-4 grid list-none grid-cols-2 gap-2 p-0 min-[680px]:grid-cols-3 min-[980px]:grid-cols-5">
          {images.map((image) => (
            <li className="min-w-0 max-w-full overflow-hidden border border-border bg-ink p-2" key={image.id}>
              <img className="block aspect-square w-full max-w-full border border-grid object-cover" src={image.dataUrl} alt={image.name} />
              <p className="mt-2 truncate text-[11px] font-extrabold" title={image.name}>{image.name}</p>
              <Button className="mt-2 w-full" variant="mini" onClick={() => onRemove(image.id)}>{t.images.remove}</Button>
            </li>
          ))}
        </ul>
      )}

      <button
        ref={triggerRef}
        className="mt-4 grid min-h-11 w-full cursor-pointer place-items-center border border-border bg-transparent px-3 text-xs font-extrabold text-white hover:border-white focus-visible:border-green focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        type="button"
        disabled={remaining === 0}
        onClick={openFilePicker}
      >
        {remaining > 0 ? t.images.import(remaining) : t.images.full}
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        multiple
        disabled={remaining === 0}
        tabIndex={-1}
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []).slice(0, remaining)
          event.currentTarget.value = ''
          triggerRef.current?.focus({ preventScroll: true })
          onImport(files)
        }}
      />
    </section>
  )
}
