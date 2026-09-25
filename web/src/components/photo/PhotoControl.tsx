import { useI18n } from '../../i18n/context'
import { fieldLabelClass } from '../../styles'
import { Button } from '../ui/Button'

interface PhotoControlProps {
  photo: string
  onImport: (file?: File) => void
  onRemove: () => void
}

export function PhotoControl({ photo, onImport, onRemove }: PhotoControlProps) {
  const { t } = useI18n()
  const photoClass = 'row-span-2 grid size-[86px] place-items-center border border-border bg-code object-cover text-center text-[10px] leading-[1.05] font-extrabold text-muted max-[520px]:size-18'

  return (
    <div>
      <p className={`${fieldLabelClass} mb-2`}>{t.about.photo}</p>
      <div className="grid grid-cols-[86px_1fr] gap-2 max-[520px]:grid-cols-[72px_1fr]">
        {photo ? <img className={photoClass} src={photo} alt={t.about.photoAlt} /> : <span className={photoClass} aria-hidden="true">{t.about.photoEmpty}</span>}
        <label className="grid min-h-9 w-full cursor-pointer place-items-center border border-border bg-transparent px-3 text-[11px] font-extrabold text-white hover:border-white">
          {t.about.import}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              onImport(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
        {photo && (
          <Button className="w-full" variant="mini" onClick={onRemove}>
            {t.about.remove}
          </Button>
        )}
      </div>
    </div>
  )
}
