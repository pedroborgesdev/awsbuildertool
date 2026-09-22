import { useI18n } from '../../i18n/context'
import { Button } from '../ui/Button'

interface PhotoControlProps {
  photo: string
  onImport: (file?: File) => void
  onRemove: () => void
}

export function PhotoControl({ photo, onImport, onRemove }: PhotoControlProps) {
  const { t } = useI18n()

  return (
    <div>
      <p className="field-label mb-2">{t.about.photo}</p>
      <div className="about-photo-control">
        {photo ? <img src={photo} alt={t.about.photoAlt} /> : <span aria-hidden="true">{t.about.photoEmpty}</span>}
        <label className="mini-button about-photo-import">
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
          <Button variant="mini" onClick={onRemove}>
            {t.about.remove}
          </Button>
        )}
      </div>
    </div>
  )
}
