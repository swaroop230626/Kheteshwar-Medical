import { useEffect, useRef, useState } from 'react'
import { PhotoPicker } from './PhotoPicker'
import { listPrescriptions, uploadPrescriptions, type PhotoFile } from './api'

interface Props {
  branchId: string
  billId: string
  canAdd: boolean
  onChanged: () => void
}

// Photos of one bill's prescription: view them, and add more
export function RxPhotos({ branchId, billId, canAdd, onChanged }: Props) {
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [key, setKey] = useState(0)
  const [picked, setPicked] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const busy = useRef(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    listPrescriptions(billId)
      .then((p) => {
        if (cancelled) return
        setPhotos(p)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [billId, key])

  async function upload() {
    if (busy.current || picked.length === 0) return
    busy.current = true
    setUploading(true)
    setMessage(null)
    const res = await uploadPrescriptions(branchId, billId, picked)
    busy.current = false
    setUploading(false)
    setPicked([])
    setMessage(res.failed > 0 ? `${res.uploaded} ફોટા ઉમેરાયા, ${res.failed} ન ઉમેરાયા. ${res.message}` : `${res.uploaded} ફોટા ઉમેરાયા.`)
    setKey((k) => k + 1)
    if (res.uploaded > 0) onChanged()
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950 print:hidden">
      {state === 'loading' && <p role="status" className="text-sm text-slate-600 dark:text-slate-400">ફોટા લોડ થઈ રહ્યા છે…</p>}
      {state === 'error' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          ફોટા લોડ થઈ શક્યા નથી. supabase/prescriptions.sql ચલાવ્યું છે?{' '}
          <button type="button" className="underline" onClick={() => setKey((k) => k + 1)}>ફરી પ્રયાસ</button>
        </p>
      )}
      {state === 'ready' && photos.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">આ bill માટે કોઈ ફોટો નથી.</p>}
      {state === 'ready' && photos.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <li key={p.id}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block focus-visible:outline-2 focus-visible:outline-brand">
                <img src={p.url} alt={`Prescription ફોટો: ${p.name}`} loading="lazy" className="h-32 w-auto max-w-full rounded-lg border border-slate-300 object-cover dark:border-slate-700" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">ફોટો પર ક્લિક કરતાં મોટો ખુલશે. લિંક 10 મિનિટ ચાલે છે.</p>

      {canAdd && (
        <div className="mt-2">
          <PhotoPicker files={picked} onChange={setPicked} disabled={uploading} />
          {picked.length > 0 && (
            <button type="button" className="btn-primary mt-2" disabled={uploading} onClick={() => void upload()}>
              {uploading ? 'upload થઈ રહ્યું છે…' : `${picked.length} ફોટા ઉમેરો`}
            </button>
          )}
        </div>
      )}
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    </div>
  )
}
