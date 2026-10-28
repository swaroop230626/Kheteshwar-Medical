import { useCallback, useEffect, useState } from 'react'
import { fetchDoctors, type DoctorOption } from '../register/api'
import { fetchCustomers, fetchSellableBatches, type CustomerOption, type SellableBatch } from './api'

export type LoadState = 'loading' | 'ready' | 'error'

export function useBillingData(branchId: string) {
  const [batches, setBatches] = useState<SellableBatch[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    // doctors are optional: if the doctors table is not created yet, billing still works for normal medicines
    Promise.all([fetchSellableBatches(branchId), fetchCustomers(branchId), fetchDoctors().catch((): DoctorOption[] => [])])
      .then(([b, c, d]) => {
        if (cancelled) return
        setBatches(b)
        setCustomers(c)
        setDoctors(d)
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
  return { batches, customers, doctors, state, reload }
}
