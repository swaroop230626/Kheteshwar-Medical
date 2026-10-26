import { useCallback, useEffect, useState } from 'react'
import { fetchGrns, fetchMedicines, type Grn, type MedicineOption } from './api'

export type LoadState = 'loading' | 'ready' | 'error'

export function usePurchases(branchId: string) {
  const [grns, setGrns] = useState<Grn[]>([])
  const [medicines, setMedicines] = useState<MedicineOption[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([fetchGrns(branchId), fetchMedicines()])
      .then(([g, m]) => {
        if (cancelled) return
        setGrns(g)
        setMedicines(m)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [branchId, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])
  return { grns, medicines, state, reload }
}
