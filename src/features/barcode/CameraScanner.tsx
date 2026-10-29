import { useEffect, useRef, useState } from 'react'

interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix']

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
  status: string | null // last result, shown under the camera
}

// Camera scanner. Uses the browser's own detector when there is one (Chrome on Android),
// otherwise the ZXing library (iPhone Safari and others).
export function CameraScanner({ onDetected, onClose, status }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0
    let stopZxing: (() => void) | null = null
    let last = { code: '', at: 0 }

    function handle(code: string) {
      const now = Date.now()
      if (code === last.code && now - last.at < 1500) return // same barcode still in front of the camera
      last = { code, at: now }
      onDetectedRef.current(code)
    }

    async function start() {
      const video = videoRef.current
      if (!video) return
      try {
        const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
        if (Ctor) {
          let detector: BarcodeDetectorLike
          try {
            detector = new Ctor({ formats: FORMATS })
          } catch {
            detector = new Ctor()
          }
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          if (stopped) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          video.srcObject = stream
          await video.play()
          timer = window.setInterval(() => {
            if (video.readyState < 2) return
            detector
              .detect(video)
              .then((found) => {
                if (found.length > 0 && found[0].rawValue) handle(found[0].rawValue)
              })
              .catch(() => undefined)
          }, 300)
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            video,
            (result) => {
              if (result) handle(result.getText())
            },
          )
          if (stopped) controls.stop()
          else stopZxing = () => controls.stop()
        }
      } catch (e) {
        const name = e instanceof Error ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera ની પરવાનગી આપો (browser ની address bar માં).'
            : name === 'NotFoundError'
              ? 'Camera મળ્યો નથી.'
              : 'Camera શરૂ થઈ શક્યો નથી. Barcode લખીને પણ ચાલશે.',
        )
      }
    }

    void start()
    return () => {
      stopped = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
      stopZxing?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <video ref={videoRef} playsInline muted className="max-h-[60vh] w-full max-w-md rounded-xl bg-black object-cover" />
      {error ? (
        <p role="alert" className="max-w-md rounded-lg bg-red-100 p-3 text-center text-sm text-red-900">{error}</p>
      ) : (
        <p className="text-center text-sm text-white">Barcode ને camera સામે રાખો.</p>
      )}
      {status && <p role="status" className="max-w-md rounded-lg bg-white/90 px-3 py-2 text-center text-sm font-semibold text-slate-900">{status}</p>}
      <button type="button" className="btn-primary" onClick={onClose}>બંધ કરો</button>
    </div>
  )
}
