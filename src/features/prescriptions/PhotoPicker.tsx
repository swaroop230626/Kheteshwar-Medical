import { MAX_PHOTOS } from './api'

interface Props {
  files: File[]
  onChange: (f: File[]) => void
  disabled: boolean
}

// Pick photos from the camera or gallery (phone) / files (computer)
export function PhotoPicker({ files, onChange, disabled }: Props) {
  return (
    <div className="mt-3">
      <label htmlFor="rx-photos" className="mb-1 block text-sm font-medium">Prescription ફોટો (વૈકલ્પિક, વધુમાં વધુ {MAX_PHOTOS})</label>
      <input
        id="rx-photos"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || files.length >= MAX_PHOTOS}
        className="field file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-medium file:text-brand-strong"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          onChange([...files, ...picked].slice(0, MAX_PHOTOS))
          e.target.value = ''
        }}
      />
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1 text-sm dark:bg-slate-800">
              <span className="min-w-0 break-all">{f.name}</span>
              <button type="button" className="btn-ghost min-w-11 border-0 px-0" disabled={disabled}
                aria-label={`${f.name} દૂર કરો`} onClick={() => onChange(files.filter((_, j) => j !== i))}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
