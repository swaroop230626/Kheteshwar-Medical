import { useCallback, useEffect, useState } from 'react'
import { fetchStockRows, type StockRow } from './stock'

export type LoadState = 'loading' | 'ready' | 'error'

export function useStockRows(branchId: string) {
  const [rows, setRows] = useState<StockRow[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchStockRows(branchId)
      .then((data) => {
        if (cancelled) return
        setRows(data)
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
  return { rows, state, reload }
}
