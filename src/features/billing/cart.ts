import type { SellableBatch } from './api'

export type PayMethod = 'cash' | 'upi' | 'card' | 'credit'
export type CustomerMode = 'walkin' | 'existing' | 'new'

export const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'Credit (ઉધાર)' },
]

export interface CartLine {
  key: string
  medicineId: string
  name: string
  gstRate: number
  batchId: string
  qty: string
}

export interface PayRow {
  key: string
  method: PayMethod
  amount: string // '' = automatically takes the remaining amount
}

export interface CustomerDraft {
  mode: CustomerMode
  customerId: string
  newName: string
  newPhone: string
}

export const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

let counter = 0
export function nextKey(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

export function parseQty(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isInteger(n) && n >= 1 ? n : null
}

export interface LineAmounts {
  taxable: number
  gst: number
  cgst: number
  sgst: number
  total: number
}

// Same rule as supabase/create_bill.sql: GST is added on top of MRP × qty.
export function lineAmounts(mrp: number, qty: number, gstRate: number): LineAmounts {
  const taxable = round2(mrp * qty)
  const gst = round2((taxable * gstRate) / 100)
  const cgst = round2(gst / 2)
  return { taxable, gst, cgst, sgst: round2(gst - cgst), total: round2(taxable + gst) }
}

export interface CartTotals {
  taxable: number
  gst: number
  total: number
}

export function cartTotals(lines: CartLine[], batchById: Map<string, SellableBatch>): CartTotals {
  let taxable = 0
  let gst = 0
  for (const l of lines) {
    const b = batchById.get(l.batchId)
    const q = parseQty(l.qty)
    if (!b || q === null) continue
    const a = lineAmounts(b.mrp, q, l.gstRate)
    taxable += a.taxable
    gst += a.gst
  }
  return { taxable: round2(taxable), gst: round2(gst), total: round2(taxable + gst) }
}

export interface ResolvedPayments {
  amounts: number[]
  sum: number
  invalid: boolean
}

// Rows with an empty amount share the remaining amount (only the first empty row gets it).
export function resolvePayments(rows: PayRow[], total: number): ResolvedPayments {
  let invalid = false
  let given = 0
  for (const r of rows) {
    if (r.amount.trim() === '') continue
    const n = Number(r.amount)
    if (!Number.isFinite(n) || n < 0) invalid = true
    else given += n
  }
  let remainder = Math.max(round2(total - given), 0)
  const amounts = rows.map((r) => {
    if (r.amount.trim() !== '') {
      const n = Number(r.amount)
      return Number.isFinite(n) && n >= 0 ? round2(n) : 0
    }
    const v = remainder
    remainder = 0
    return v
  })
  return { amounts, sum: round2(amounts.reduce((s, a) => s + a, 0)), invalid }
}
