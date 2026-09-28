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

  return (
    <section className="border border-grid bg-panel p-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={fieldLabelClass}>{t.images.title}</p>
          <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-muted-light">{t.images.note}</p>
        </div>
        <span className="shrink-0 text-xs font-extrabold text-blue">{images.length}/5</span>
      </div>

      {images.length > 0 && (
        <ul className="mt-4 grid list-none grid-cols-2 gap-2 p-0 min-[680px]:grid-cols-3 min-[980px]:grid-cols-5">
          {images.map((image) => (
            <li className="min-w-0 border border-border bg-ink p-2" key={image.id}>
              <img className="aspect-square w-full border border-grid object-cover" src={image.dataUrl} alt={image.name} />
              <p className="mt-2 truncate text-[11px] font-extrabold" title={image.name}>{image.name}</p>
              <Button className="mt-2 w-full" variant="mini" onClick={() => onRemove(image.id)}>{t.images.remove}</Button>
            </li>
          ))}
        </ul>
      )}

      <label className={`mt-4 grid min-h-11 w-full place-items-center border border-border bg-transparent px-3 text-xs font-extrabold text-white hover:border-white ${remaining === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
        {remaining > 0 ? t.images.import(remaining) : t.images.full}
        <input
          className="sr-only"
          type="file"
          multiple
          disabled={remaining === 0}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            onImport(Array.from(event.target.files ?? []).slice(0, remaining))
            event.target.value = ''
          }}
        />
      </label>
    </section>
  )
}
