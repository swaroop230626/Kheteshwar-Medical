import { useEffect, useRef, useState, type FormEvent } from 'react'
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
    <div>
      <form onSubmit={submit} className="flex gap-2" role="search" aria-label={label}>
        <label htmlFor="scan-input" className="sr-only">{label}</label>
        <input
          id="scan-input"
          ref={inputRef}
          className="field"
          placeholder={`${label} (Scanner / કેમેરા / લખો)`}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="button" className="btn-ghost shrink-0" disabled={disabled} onClick={() => setCamera(true)} aria-label="Camera થી scan કરો">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
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
