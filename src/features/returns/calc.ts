import type { ReturnItem } from './api'

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

export function remainingQty(it: ReturnItem): number {
  return Math.max(it.qty - it.returned, 0)
}

export function parseReturnQty(s: string): number | null {
  if (s.trim() === '') return 0
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 ? n : null
}

// Same rule as supabase/create_sales_return.sql:
// proportional to qty; the last return of a line takes exactly what is left.
function part(whole: number, before: number, billed: number, returned: number, q: number): number {
  if (returned + q === billed) return round2(whole - before)
  return round2((whole * q) / billed)
}

export function refundFor(it: ReturnItem, q: number): number {
  if (q <= 0 || it.qty <= 0) return 0
  const t = part(it.taxable, it.retTaxable, it.qty, it.returned, q)
  const c = part(it.cgst, it.retCgst, it.qty, it.returned, q)
  const s = part(it.sgst, it.retSgst, it.qty, it.returned, q)
  const i = part(it.igst, it.retIgst, it.qty, it.returned, q)
  return round2(t + c + s + i)
}
