import { useCallback, useEffect, useState } from 'react'
import { fetchDues, type DueRow } from '../dues/api'
import { fetchDailySales } from '../reports/api'
import type { Section } from './useDashboard'

export interface WeekDay {
  date: string // YYYY-MM-DD (India date)
  sales: number
  bills: number
}

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

function shiftDay(ymd: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10)
}

// Extra dashboard data: the last 7 days of sales, and who has been unpaid the longest.
// Both are optional: if their SQL has not been run, only that box shows a small message.
export function useExtras(branchId: string, withDues: boolean) {
  const [week, setWeek] = useState<Section<WeekDay[]>>({ state: 'loading' })
  const [dues, setDues] = useState<Section<DueRow[]>>({ state: 'loading' })
  const [key, setKey] = useState(0)

  useEffect(() => {
    let done = false
    setWeek({ state: 'loading' })
    setDues(withDues ? { state: 'loading' } : { state: 'ready', data: [] })

    const today = istToday()
    void fetchDailySales(branchId, shiftDay(today, -6), today).then((res) => {
      if (done) return
      if (!res.ok) {
        setWeek({ state: 'error', technical: res.technical })
        return
      }
      const byDate = new Map(res.data.map((r) => [r.date, r]))
      const days: WeekDay[] = []
      for (let i = 6; i >= 0; i -= 1) {
        const d = shiftDay(today, -i)
        const r = byDate.get(d)
        days.push({ date: d, sales: r?.sales ?? 0, bills: r?.bills ?? 0 })
      }
      setWeek({ state: 'ready', data: days })
    })

    if (withDues) {
      fetchDues(branchId)
        .then((rows) => {
          if (!done) setDues({ state: 'ready', data: rows })
        })
        .catch((e: unknown) => {
          if (!done) setDues({ state: 'error', technical: e instanceof Error ? e.message : String(e) })
        })
    }
    return () => {
      done = true
    }
  }, [branchId, withDues, key])

  const reload = useCallback(() => setKey((k) => k + 1), [])
  return { week, dues, reload }
}
