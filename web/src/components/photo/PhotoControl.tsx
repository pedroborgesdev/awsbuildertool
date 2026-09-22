import { Button } from '../ui/Button'

interface PhotoControlProps {
  photo: string
  onImport: (file?: File) => void
  onRemove: () => void
}

export function PhotoControl({ photo, onImport, onRemove }: PhotoControlProps) {
  return (
    <div>
      <p className="field-label mb-2">Your photo</p>
      <div className="about-photo-control">
        {photo ? <img src={photo} alt="Photo cropped for the footer" /> : <span aria-hidden="true">1080<br />×<br />1080</span>}
        <label className="mini-button about-photo-import">
          Import
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
            Remove
          </Button>
        )}
      </div>
    </div>
  )
}
