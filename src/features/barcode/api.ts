import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord, toNum } from '../../lib/parse'

export type BarcodeKind = 'single' | 'box'

export interface BarcodeInfo {
  id: string
  medicineId: string
  code: string
  kind: BarcodeKind
  units: number
}

export interface MedicineName {
  id: string
  name: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

// 8901234567890 and 08901234567890 are the same barcode (UPC/EAN difference)
export function normalizeCode(code: string): string {
  const t = code.trim()
  return /^\d+$/.test(t) ? t.replace(/^0+/, '') || '0' : t
}

function parseInfo(r: unknown): BarcodeInfo | null {
  if (!isRecord(r) || typeof r.id !== 'string' || typeof r.medicine_id !== 'string' || typeof r.barcode !== 'string') return null
  return {
    id: r.id,
    medicineId: r.medicine_id,
    code: r.barcode,
    kind: r.kind === 'box' ? 'box' : 'single',
    units: Math.max(toNum(r.units) ?? 1, 1),
  }
}

export async function fetchBarcodes(): Promise<BarcodeInfo[]> {
  const rows = await fetchAll((a, b) =>
    supabase.from('medicine_barcodes').select('id, medicine_id, barcode, kind, units').order('id').range(a, b),
  )
  return rows.flatMap((r) => {
    const i = parseInfo(r)
    return i ? [i] : []
  })
}

export async function fetchMedicineBarcodes(medicineId: string): Promise<BarcodeInfo[]> {
  const { data, error } = await supabase
    .from('medicine_barcodes')
    .select('id, medicine_id, barcode, kind, units')
    .eq('medicine_id', medicineId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown[]).flatMap((r) => {
    const i = parseInfo(r)
    return i ? [i] : []
  })
}

export async function fetchMedicineNames(): Promise<MedicineName[]> {
  const rows = await fetchAll((a, b) =>
    supabase.from('medicines').select('id, name').is('deleted_at', null).order('name').order('id').range(a, b),
  )
  return rows.flatMap((r) => (isRecord(r) && typeof r.id === 'string' && typeof r.name === 'string' ? [{ id: r.id, name: r.name }] : []))
}

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('BARCODE_EXISTS')) {
    const name = m.split('BARCODE_EXISTS:')[1]?.split('\n')[0]?.trim()
    return name ? `આ barcode પહેલેથી "${name}" સાથે જોડાયેલો છે.` : 'આ barcode પહેલેથી જોડાયેલો છે.'
  }
  if (err.code === '23505') return 'આ barcode પહેલેથી જોડાયેલો છે.'
  if (m.includes('INVALID_BARCODE')) return 'Barcode ખાલી કે વધુ લાંબો છે.'
  if (m.includes('INVALID_UNITS')) return 'Box માં કેટલા નંગ છે તે 1 કે વધુ લખો.'
  if (m.includes('MEDICINE_NOT_FOUND')) return 'દવા મળી નથી.'
  if (m.includes('NO_COMPANY')) return 'Account set up નથી.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને barcode જોડવાની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) return 'Barcode function બનાવ્યું નથી. supabase/barcodes.sql ચલાવો.'
  return 'Barcode જોડી શકાયો નથી.'
}

export async function linkBarcode(medicineId: string, code: string, kind: BarcodeKind, units: number): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('link_barcode', {
      p_medicine_id: medicineId,
      p_barcode: code,
      p_kind: kind,
      p_units: units,
    })
    if (error) return { ok: false, message: translate(error), technical: `${error.code ?? ''} ${error.message}`.trim() }
    return { ok: true, data: null }
  } catch (e) {
    return { ok: false, message: 'ઇન્ટરનેટ કે server ની સમસ્યા.', technical: e instanceof Error ? e.message : String(e) }
  }
}

export async function removeBarcode(id: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.from('medicine_barcodes').delete().eq('id', id)
    if (error) return { ok: false, message: 'Barcode કાઢી શકાયો નથી.', technical: `${error.code ?? ''} ${error.message}`.trim() }
    return { ok: true, data: null }
  } catch (e) {
    return { ok: false, message: 'ઇન્ટરનેટ કે server ની સમસ્યા.', technical: e instanceof Error ? e.message : String(e) }
  }
}
