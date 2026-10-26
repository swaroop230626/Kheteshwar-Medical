import { supabase } from '../../lib/supabase'

export type StatusKey = 'expired' | 'expiring' | 'low' | 'ok'

export interface StockRow {
  batchId: string
  medicineId: string
  name: string
  batchNo: string
  expiryDate: string // YYYY-MM-DD
  daysLeft: number
  stock: number // grn_items qty − bill_items qty (cancelled bills excluded)
  dbStock: number // stock_batches.qty_on_hand, shown only as a cross-check
  mrp: number
  reorderLevel: number
  statuses: StatusKey[] // first item is the main status
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

// PostgREST returns at most 1000 rows per request, so read page by page.
async function fetchAll(page: (from: number, to: number) => Page): Promise<unknown[]> {
  const size = 1000
  const out: unknown[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < size) break
  }
  return out
}

function sumByBatch(rows: unknown[]): Map<string, number> {
  const sums = new Map<string, number>()
  for (const r of rows) {
    if (!isRecord(r)) continue
    const id = r.batch_id
    const qty = toNum(r.qty)
    if (typeof id === 'string' && qty !== null) sums.set(id, (sums.get(id) ?? 0) + qty)
  }
  return sums
}

export function daysUntil(iso: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}

export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

export function statusesFor(
  stock: number,
  daysLeft: number,
  medicineSellable: number,
  reorderLevel: number,
): StatusKey[] {
  const s: StatusKey[] = []
  if (stock > 0 && daysLeft < 0) s.push('expired')
  else if (stock > 0 && daysLeft <= 90) s.push('expiring')
  // Low stock is judged per medicine: sellable (non-expired) stock of all its batches
  if (medicineSellable <= reorderLevel) s.push('low')
  return s.length > 0 ? s : ['ok']
}

export async function fetchStockRows(branchId: string): Promise<StockRow[]> {
  const [batches, medicines, grnItems, billItems] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from('stock_batches')
        .select('id, medicine_id, batch_no, expiry_date, mrp, qty_on_hand')
        .eq('branch_id', branchId)
        .order('id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('medicines').select('id, name, reorder_level').is('deleted_at', null).order('id').range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('grn_items').select('batch_id, qty').eq('branch_id', branchId).order('id').range(a, b),
    ),
    // inner join on bills so cancelled (deleted_at set) bills are left out
    fetchAll((a, b) =>
      supabase
        .from('bill_items')
        .select('batch_id, qty, bills!inner(deleted_at)')
        .eq('branch_id', branchId)
        .is('bills.deleted_at', null)
        .order('id')
        .range(a, b),
    ),
  ])

  const received = sumByBatch(grnItems)
  const sold = sumByBatch(billItems)

  const meds = new Map<string, { name: string; reorderLevel: number }>()
  for (const m of medicines) {
    if (!isRecord(m)) continue
    const reorder = toNum(m.reorder_level)
    if (typeof m.id === 'string' && typeof m.name === 'string') {
      meds.set(m.id, { name: m.name, reorderLevel: reorder ?? 0 })
    }
  }

  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  type Draft = Omit<StockRow, 'statuses'>
  const drafts: Draft[] = []
  const sellable = new Map<string, number>()

  for (const b of batches) {
    if (!isRecord(b)) continue
    const { id, medicine_id, batch_no, expiry_date } = b
    if (
      typeof id !== 'string' ||
      typeof medicine_id !== 'string' ||
      typeof batch_no !== 'string' ||
      typeof expiry_date !== 'string'
    ) {
      continue
    }
    const med = meds.get(medicine_id)
    const daysLeft = daysUntil(expiry_date, today)
    if (!med || daysLeft === null) continue

    const stock = (received.get(id) ?? 0) - (sold.get(id) ?? 0)
    if (daysLeft >= 0 && stock > 0) sellable.set(medicine_id, (sellable.get(medicine_id) ?? 0) + stock)

    drafts.push({
      batchId: id,
      medicineId: medicine_id,
      name: med.name,
      batchNo: batch_no,
      expiryDate: expiry_date,
      daysLeft,
      stock,
      dbStock: toNum(b.qty_on_hand) ?? 0,
      mrp: toNum(b.mrp) ?? 0,
      reorderLevel: med.reorderLevel,
    })
  }

  return drafts
    .map((d) => ({
      ...d,
      statuses: statusesFor(d.stock, d.daysLeft, sellable.get(d.medicineId) ?? 0, d.reorderLevel),
    }))
    .sort((x, y) => x.name.localeCompare(y.name) || x.expiryDate.localeCompare(y.expiryDate))
}
