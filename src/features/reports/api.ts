import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

export interface DailyRow {
  date: string // YYYY-MM-DD (India date)
  bills: number
  sales: number
  returns: number
  net: number
  cash: number
  upi: number
  card: number
  credit: number
}

export interface GstRow {
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface GstSummary {
  net: GstRow[] // sales - returns, per GST rate
  sales: GstRow // totals
  returns: GstRow // totals
}

export interface BranchRow {
  id: string
  name: string
  bills: number
  sales: number
  returns: number
  net: number
}

export type ReportResult<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

function failure<T>(err: { message: string; code?: string }): ReportResult<T> {
  const missing = err.code === 'PGRST202' || err.message.includes('Could not find the function')
  return {
    ok: false,
    message: missing
      ? 'Report function Supabase માં બનાવ્યું નથી. supabase/reports.sql અને reports_v2.sql ચલાવો.'
      : 'Report લોડ થઈ શક્યો નથી. ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.',
    technical: `${err.code ?? ''} ${err.message}`.trim(),
  }
}

export async function fetchDailySales(branchId: string | null, from: string, to: string): Promise<ReportResult<DailyRow[]>> {
  try {
    const { data, error } = await supabase.rpc('report_daily_sales', { p_branch: branchId, p_from: from, p_to: to })
    if (error) return failure(error)
    const out: DailyRow[] = []
    for (const r of (data ?? []) as unknown[]) {
      if (!isRecord(r) || typeof r.sale_date !== 'string') continue
      out.push({
        date: r.sale_date,
        bills: toNum(r.bill_count) ?? 0,
        sales: toNum(r.sales_total) ?? 0,
        returns: toNum(r.returns_total) ?? 0,
        net: toNum(r.net_total) ?? 0,
        cash: toNum(r.cash_total) ?? 0,
        upi: toNum(r.upi_total) ?? 0,
        card: toNum(r.card_total) ?? 0,
        credit: toNum(r.credit_total) ?? 0,
      })
    }
    return { ok: true, data: out }
  } catch (e) {
    return failure({ message: e instanceof Error ? e.message : String(e) })
  }
}

const zero = (rate: number): GstRow => ({ rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 })

export async function fetchGstSummary(branchId: string | null, from: string, to: string): Promise<ReportResult<GstSummary>> {
  try {
    const { data, error } = await supabase.rpc('report_gst_summary', { p_branch: branchId, p_from: from, p_to: to })
    if (error) return failure(error)

    const byRate = new Map<number, { s: GstRow; r: GstRow }>()
    const sales = zero(-1)
    const returns = zero(-1)
    for (const row of (data ?? []) as unknown[]) {
      if (!isRecord(row)) continue
      const rate = toNum(row.gst_rate)
      if (rate === null) continue
      const cur = byRate.get(rate) ?? { s: zero(rate), r: zero(rate) }
      const target = row.kind === 'returns' ? cur.r : cur.s
      const tot = row.kind === 'returns' ? returns : sales
      for (const k of ['taxable', 'cgst', 'sgst', 'igst', 'total'] as const) {
        const v = toNum(row[k]) ?? 0
        target[k] = round2(target[k] + v)
        tot[k] = round2(tot[k] + v)
      }
      byRate.set(rate, cur)
    }

    const net: GstRow[] = [...byRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, { s, r }]) => ({
        rate,
        taxable: round2(s.taxable - r.taxable),
        cgst: round2(s.cgst - r.cgst),
        sgst: round2(s.sgst - r.sgst),
        igst: round2(s.igst - r.igst),
        total: round2(s.total - r.total),
      }))
    return { ok: true, data: { net, sales, returns } }
  } catch (e) {
    return failure({ message: e instanceof Error ? e.message : String(e) })
  }
}

export async function fetchBranchSales(from: string, to: string): Promise<ReportResult<BranchRow[]>> {
  try {
    const { data, error } = await supabase.rpc('report_branch_sales', { p_from: from, p_to: to })
    if (error) return failure(error)
    const out: BranchRow[] = []
    for (const r of (data ?? []) as unknown[]) {
      if (!isRecord(r) || typeof r.branch_id !== 'string' || typeof r.branch_name !== 'string') continue
      out.push({
        id: r.branch_id,
        name: r.branch_name,
        bills: toNum(r.bill_count) ?? 0,
        sales: toNum(r.sales_total) ?? 0,
        returns: toNum(r.returns_total) ?? 0,
        net: toNum(r.net_total) ?? 0,
      })
    }
    return { ok: true, data: out }
  } catch (e) {
    return failure({ message: e instanceof Error ? e.message : String(e) })
  }
}
