import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord, toNum } from '../../lib/parse'
import { fetchStockRows, type StockRow } from '../medicines/stock'

// ---------- types ----------

export type Section<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'error'; technical: string }

export interface SalesSummary {
  total: number
  count: number
}

export interface CreditSummary {
  total: number
  customersDue: number
}

export interface ExpiryItem {
  batchId: string
  name: string
  batchNo: string
  expiryDate: string
  daysLeft: number
  stock: number
}

export interface LowItem {
  medicineId: string
  name: string
  stock: number
  reorderLevel: number
}

export interface StockSummary {
  red: number // 0..30 days
  yellow: number // 31..90 days
  expired: ExpiryItem[] // already expired, still has stock
  soon: ExpiryItem[] // expires within 30 days
  low: LowItem[]
}

// ---------- today (India time), independent of the device time zone ----------

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function nextDay(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10)
}

// ---------- fetchers (read only) ----------

async function fetchSales(branchId: string): Promise<SalesSummary> {
  const today = istToday()
  // Works for both a date column and a timestamptz column: [today 00:00 IST, tomorrow 00:00 IST)
  const start = `${today}T00:00:00+05:30`
  const end = `${nextDay(today)}T00:00:00+05:30`
  const rows = await fetchAll((a, b) =>
    supabase
      .from('bills')
      .select('id, total_amount')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .gte('bill_date', start)
      .lt('bill_date', end)
      .order('id')
      .range(a, b),
  )
  let paise = 0
  let count = 0
  for (const r of rows) {
    if (!isRecord(r)) continue
    paise += Math.round((toNum(r.total_amount) ?? 0) * 100)
    count += 1
  }
  return { total: paise / 100, count }
}

async function fetchCredit(branchId: string): Promise<CreditSummary> {
  const rows = await fetchAll((a, b) =>
    supabase
      .from('customers')
      .select('id, balance')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('id')
      .range(a, b),
  )
  let paise = 0
  let customersDue = 0
  for (const r of rows) {
    if (!isRecord(r)) continue
    const bal = toNum(r.balance) ?? 0
    paise += Math.round(bal * 100)
    if (bal > 0) customersDue += 1
  }
  return { total: paise / 100, customersDue }
}

// Uses the same stock calculation as the Medicines page, so the numbers always match it.
function summarise(rows: StockRow[]): StockSummary {
  const toItem = (r: StockRow): ExpiryItem => ({
    batchId: r.batchId,
    name: r.name,
    batchNo: r.batchNo,
    expiryDate: r.expiryDate,
    daysLeft: r.daysLeft,
    stock: r.stock,
  })

  let red = 0
  let yellow = 0
  const expired: ExpiryItem[] = []
  const soon: ExpiryItem[] = []
  const sellable = new Map<string, number>()
  const lowMeds = new Map<string, { name: string; reorderLevel: number }>()

  for (const r of rows) {
    if (r.stock > 0) {
      if (r.daysLeft < 0) expired.push(toItem(r))
      else {
        sellable.set(r.medicineId, (sellable.get(r.medicineId) ?? 0) + r.stock)
        if (r.daysLeft <= 30) {
          red += 1
          soon.push(toItem(r))
        } else if (r.daysLeft <= 90) yellow += 1
      }
    }
    if (r.statuses.includes('low')) lowMeds.set(r.medicineId, { name: r.name, reorderLevel: r.reorderLevel })
  }

  const low: LowItem[] = [...lowMeds.entries()]
    .map(([medicineId, m]) => ({
      medicineId,
      name: m.name,
      stock: sellable.get(medicineId) ?? 0,
      reorderLevel: m.reorderLevel,
    }))
    .sort((x, y) => x.stock - y.stock || x.name.localeCompare(y.name))

  expired.sort((x, y) => x.daysLeft - y.daysLeft || x.name.localeCompare(y.name))
  soon.sort((x, y) => x.daysLeft - y.daysLeft || x.name.localeCompare(y.name))
  return { red, yellow, expired, soon, low }
}

async function fetchStockSummary(branchId: string): Promise<StockSummary> {
  return summarise(await fetchStockRows(branchId))
}

// ---------- hook ----------

function track<T>(
  work: Promise<T>,
  set: (s: Section<T>) => void,
  cancelled: () => boolean,
): void {
  work
    .then((data) => {
      if (!cancelled()) set({ state: 'ready', data })
    })
    .catch((e: unknown) => {
      if (!cancelled()) set({ state: 'error', technical: e instanceof Error ? e.message : String(e) })
    })
}

export function useDashboard(branchId: string) {
  const [sales, setSales] = useState<Section<SalesSummary>>({ state: 'loading' })
  const [stock, setStock] = useState<Section<StockSummary>>({ state: 'loading' })
  const [credit, setCredit] = useState<Section<CreditSummary>>({ state: 'loading' })
  const [key, setKey] = useState(0)

  useEffect(() => {
    let done = false
    const cancelled = () => done
    setSales({ state: 'loading' })
    setStock({ state: 'loading' })
    setCredit({ state: 'loading' })
    track(fetchSales(branchId), setSales, cancelled)
    track(fetchStockSummary(branchId), setStock, cancelled)
    track(fetchCredit(branchId), setCredit, cancelled)
    return () => {
      done = true
    }
  }, [branchId, key])

  const reload = useCallback(() => setKey((k) => k + 1), [])
  const loading = sales.state === 'loading' || stock.state === 'loading' || credit.state === 'loading'
  return { sales, stock, credit, loading, reload }
}
