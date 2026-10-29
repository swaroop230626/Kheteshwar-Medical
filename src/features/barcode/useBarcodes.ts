import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchBarcodes, fetchMedicineNames, normalizeCode, type BarcodeInfo, type MedicineName } from './api'

export type BarcodeState = 'loading' | 'ready' | 'error'

// All barcodes of the company, ready for instant lookup after a scan
export function useBarcodes() {
  const [codes, setCodes] = useState<BarcodeInfo[]>([])
  const [medicines, setMedicines] = useState<MedicineName[]>([])
  const [state, setState] = useState<BarcodeState>('loading')
  const [key, setKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([fetchBarcodes(), fetchMedicineNames()])
      .then(([c, m]) => {
        if (cancelled) return
        setCodes(c)
        setMedicines(m)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const byCode = useMemo(() => new Map(codes.map((c) => [normalizeCode(c.code), c])), [codes])
  const reload = useCallback(() => setKey((k) => k + 1), [])
  return { byCode, medicines, state, reload }
}
