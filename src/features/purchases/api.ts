import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

export interface MedicineOption {
  id: string
  name: string
  mrp: number | null
  gstRate: number | null
  deleted: boolean
}

export interface GrnItem {
  id: string
  medicineId: string
  batchNo: string
  expiryDate: string
  qty: number
  purchaseRate: number
  gstRate: number
  lineTotal: number
}

export interface Grn {
  id: string
  grnNo: string
  supplier: string
  invoiceNo: string
  invoiceDate: string
  total: number
  items: GrnItem[]
}

export interface SaveItem {
  medicine_id: string
  batch_no: string
  expiry_date: string
  qty: number
  purchase_rate: number
  mrp: number
  gst_rate: number
}

export interface SaveInput {
  branchId: string
  supplier: string
  invoiceNo: string
  invoiceDate: string
  items: SaveItem[]
}

export type SaveResult = { ok: true } | { ok: false; message: string }

export async function fetchMedicines(): Promise<MedicineOption[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, mrp, gst_rate, deleted_at')
    .order('name')
  if (error) throw new Error(error.message)
  const out: MedicineOption[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string') continue
    out.push({
      id: r.id,
      name: r.name,
      mrp: toNum(r.mrp),
      gstRate: toNum(r.gst_rate),
      deleted: r.deleted_at !== null && r.deleted_at !== undefined,
    })
  }
  return out
}

function parseItem(r: unknown): GrnItem | null {
  if (!isRecord(r)) return null
  const { id, medicine_id, batch_no, expiry_date } = r
  if (
    typeof id !== 'string' ||
    typeof medicine_id !== 'string' ||
    typeof batch_no !== 'string' ||
    typeof expiry_date !== 'string'
  ) {
    return null
  }
  return {
    id,
    medicineId: medicine_id,
    batchNo: batch_no,
    expiryDate: expiry_date,
    qty: toNum(r.qty) ?? 0,
    purchaseRate: toNum(r.purchase_rate) ?? 0,
    gstRate: toNum(r.gst_rate) ?? 0,
    lineTotal: toNum(r.line_total) ?? 0,
  }
}

export async function fetchGrns(branchId: string): Promise<Grn[]> {
  const { data, error } = await supabase
    .from('grns')
    .select(
      'id, grn_no, supplier_name, invoice_no, invoice_date, total_amount, ' +
        'grn_items(id, medicine_id, batch_no, expiry_date, qty, purchase_rate, gst_rate, line_total)',
    )
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)

  const out: Grn[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r)) continue
    const { id, grn_no, supplier_name, invoice_no, invoice_date } = r
    if (typeof id !== 'string' || typeof supplier_name !== 'string' || typeof invoice_no !== 'string') continue
    const rawItems = Array.isArray(r.grn_items) ? (r.grn_items as unknown[]) : []
    const items: GrnItem[] = []
    for (const it of rawItems) {
      const parsed = parseItem(it)
      if (parsed) items.push(parsed)
    }
    out.push({
      id,
      grnNo: typeof grn_no === 'string' ? grn_no : '',
      supplier: supplier_name,
      invoiceNo: invoice_no,
      invoiceDate: typeof invoice_date === 'string' ? invoice_date : '',
      total: toNum(r.total_amount) ?? 0,
      items,
    })
  }
  return out
}

export function batchKey(medicineId: string, batchNo: string): string {
  return `${medicineId}|${batchNo.trim().toLowerCase()}`
}

// Friendly pre-check; the database function checks again inside the transaction.
export async function findExistingBatches(
  branchId: string,
  medicineIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(medicineIds)]
  const found = new Set<string>()
  if (ids.length === 0) return found
  const { data, error } = await supabase
    .from('stock_batches')
    .select('medicine_id, batch_no')
    .eq('branch_id', branchId)
    .in('medicine_id', ids)
  if (error) throw new Error(error.message)
  for (const r of (data ?? []) as unknown[]) {
    if (isRecord(r) && typeof r.medicine_id === 'string' && typeof r.batch_no === 'string') {
      found.add(batchKey(r.medicine_id, r.batch_no))
    }
  }
  return found
}

function translateError(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('BATCH_EXISTS')) {
    const batch = m.split('BATCH_EXISTS:')[1]?.trim()
    return batch ? `આ batch પહેલેથી છે: ${batch}` : 'આ batch પહેલેથી છે.'
  }
  if (m.includes('DUPLICATE_IN_FORM')) return 'એક જ દવાનો એક જ batch ફોર્મમાં બે વાર છે.'
  if (m.includes('EXPIRED')) return 'Expiry date ભૂતકાળની ન હોઈ શકે.'
  if (m.includes('NO_ITEMS')) return 'ઓછામાં ઓછી એક item ઉમેરો.'
  if (m.includes('INVALID_ITEM')) return 'કોઈ item ની વિગતો ખોટી છે. ફરી તપાસો.'
  if (m.includes('MISSING_HEADER')) return 'Supplier, invoice no અને invoice date ભરો.'
  if (err.code === '23505' || m.includes('uq_grns_supplier_inv')) {
    return 'આ supplier નું આ invoice no પહેલેથી નોંધાયેલું છે.'
  }
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) {
    return 'તમને purchase નોંધવાની પરવાનગી નથી.'
  }
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'create_grn function Supabase માં હજી બનાવ્યું નથી. supabase/create_grn.sql ચલાવો.'
  }
  return 'Save થઈ શક્યું નહીં. કંઈ પણ સેવ થયું નથી. ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.'
}

export async function saveGrn(input: SaveInput): Promise<SaveResult> {
  try {
    const { error } = await supabase.rpc('create_grn', {
      p_branch: input.branchId,
      p_supplier: input.supplier,
      p_invoice_no: input.invoiceNo,
      p_invoice_date: input.invoiceDate,
      p_items: input.items,
    })
    if (error) return { ok: false, message: translateError(error) }
    return { ok: true }
  } catch {
    return { ok: false, message: translateError({ message: 'network' }) }
  }
}
