import { useCallback, useEffect, useState } from 'react'
import { fetchCustomers, fetchSellableBatches, type CustomerOption, type SellableBatch } from './api'

export type LoadState = 'loading' | 'ready' | 'error'

export function useBillingData(branchId: string) {
  const [batches, setBatches] = useState<SellableBatch[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    Promise.all([fetchSellableBatches(branchId), fetchCustomers(branchId)])
      .then(([b, c]) => {
        if (cancelled) return
        setBatches(b)
        setCustomers(c)
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
  return { batches, customers, state, reload }
}
