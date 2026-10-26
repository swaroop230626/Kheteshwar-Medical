import { useCallback, useEffect, useState } from 'react'
import { fetchCustomerList, fetchLedger, type Customer, type LedgerEntry } from './api'

export type LoadState = 'loading' | 'ready' | 'error'

export function useCustomers(branchId: string) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [key, setKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchCustomerList(branchId)
      .then((d) => {
        if (cancelled) return
        setCustomers(d)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [branchId, key])

  const reload = useCallback(() => setKey((k) => k + 1), [])
  return { customers, state, reload }
}

export function useLedger(customerId: string) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [key, setKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchLedger(customerId)
      .then((d) => {
        if (cancelled) return
        setEntries(d)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [customerId, key])

  const reload = useCallback(() => setKey((k) => k + 1), [])
  return { entries, state, reload }
}
