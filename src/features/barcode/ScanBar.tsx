import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { CameraScanner } from './CameraScanner'

interface Props {
  // return 'stop' to close the camera (for example when the barcode is unknown)
  onScan: (code: string) => 'continue' | 'stop' | void
  status: string | null
  disabled?: boolean
  label?: string
}

// A box that takes a barcode from a USB/Bluetooth scanner (it types the number + Enter),
// from typing, or from the phone camera.
export function ScanBar({ onScan, status, disabled = false, label = 'Barcode scan કરો' }: Props) {
  const [value, setValue] = useState('')
  const [camera, setCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // on a computer, keep the cursor here so a hardware scanner works straight away
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus()
  }, [])

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = value.trim()
    if (code === '' || disabled) return
    setValue('')
    onScan(code)
    inputRef.current?.focus()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <form onSubmit={submit} className="flex gap-2" role="search" aria-label={label}>
        <div className="relative min-w-0 flex-1">
          <label htmlFor="scan-input" className="sr-only">{label}</label>
          <Icon name="scan" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-brand dark:text-brand-bright" />
          <input
            id="scan-input"
            ref={inputRef}
            className="field pl-10"
            placeholder={`${label} (Scanner / લખો)`}
            value={value}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button type="button" className="btn-primary shrink-0 gap-2" disabled={disabled} onClick={() => setCamera(true)} aria-label="Camera થી scan કરો">
          <Icon name="camera" />
          <span className="hidden sm:inline">Camera</span>
        </button>
      </form>
      {status && !camera && <p role="status" className="mt-2 text-sm font-medium">{status}</p>}

      {camera && (
        <CameraScanner
          status={status}
          onClose={() => setCamera(false)}
          onDetected={(code) => {
            if (onScan(code) === 'stop') setCamera(false)
          }}
        />
      )}
    </div>
  )
}
