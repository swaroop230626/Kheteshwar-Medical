import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

export interface NewMedicine {
  name: string
  genericName: string
  manufacturer: string
  hsnCode: string
  gstRate: number
  schedule: string
  mrp: number
  reorderLevel: number
}

// Form values as text (what the inputs show)
export interface MedicineDraft {
  name: string
  genericName: string
  manufacturer: string
  hsnCode: string
  gst: string
  schedule: string
  mrp: string
  reorder: string
}

export type CreateResult = { ok: true; id: string } | { ok: false; message: string; technical: string }

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('DUPLICATE_NAME') || err.code === '23505') return 'આ નામની દવા પહેલેથી છે.'
  if (m.includes('INVALID_NAME')) return 'દવાનું નામ લખવું જરૂરી છે.'
  if (m.includes('INVALID_GST')) return 'GST માત્ર 0, 5, 12 કે 18 હોઈ શકે.'
  if (m.includes('INVALID_SCHEDULE')) return 'Schedule માત્ર OTC, H, H1 કે X હોઈ શકે.'
  if (m.includes('INVALID_MRP')) return 'MRP 0 થી વધુ હોવો જોઈએ.'
  if (m.includes('INVALID_REORDER')) return 'Reorder level 0 કે વધુ હોવો જોઈએ.'
  if (m.includes('NO_COMPANY')) return 'Account set up નથી, owner નો સંપર્ક કરો.'
  if (m.includes('MEDICINE_NOT_FOUND')) return 'દવા મળી નથી. યાદી ફરી લોડ કરો.'
  if (m.includes('NOT_ALLOWED')) return 'તમને આ દવા સુધારવાની પરવાનગી નથી.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને આ કામની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'Function Supabase માં બનાવ્યું નથી. supabase/create_medicine.sql અને update_medicine.sql ચલાવો.'
  }
  return 'દવા સેવ થઈ શકી નહીં. કંઈ પણ સેવ થયું નથી.'
}

function failure(e: unknown): CreateResult {
  return {
    ok: false,
    message: 'ઇન્ટરનેટ કે server ની સમસ્યા. ફરી પ્રયાસ કરો.',
    technical: e instanceof Error ? e.message : String(e),
  }
}

function params(m: NewMedicine) {
  return {
    p_name: m.name,
    p_generic_name: m.genericName === '' ? null : m.genericName,
    p_manufacturer: m.manufacturer === '' ? null : m.manufacturer,
    p_hsn_code: m.hsnCode === '' ? null : m.hsnCode,
    p_gst_rate: m.gstRate,
    p_schedule: m.schedule,
    p_mrp: m.mrp,
    p_reorder_level: m.reorderLevel,
  }
}

export async function createMedicine(m: NewMedicine): Promise<CreateResult> {
  try {
    const { data, error } = await supabase.rpc('create_medicine', params(m))
    if (error) return { ok: false, message: translate(error), technical: `${error.code ?? ''} ${error.message}`.trim() }
    return { ok: true, id: typeof data === 'string' ? data : '' }
  } catch (e) {
    return failure(e)
  }
}

export async function updateMedicine(id: string, m: NewMedicine): Promise<CreateResult> {
  try {
    const { error } = await supabase.rpc('update_medicine', { p_id: id, ...params(m) })
    if (error) return { ok: false, message: translate(error), technical: `${error.code ?? ''} ${error.message}`.trim() }
    return { ok: true, id }
  } catch (e) {
    return failure(e)
  }
}

// Loads one medicine so the edit form can be filled in
export async function fetchMedicine(id: string): Promise<MedicineDraft | null> {
  const { data, error } = await supabase
    .from('medicines')
    .select('name, generic_name, manufacturer, hsn_code, gst_rate, schedule, mrp, reorder_level')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return null
  const r: unknown = data
  if (!isRecord(r) || typeof r.name !== 'string') return null
  const text = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    name: r.name,
    genericName: text(r.generic_name),
    manufacturer: text(r.manufacturer),
    hsnCode: text(r.hsn_code),
    gst: String(toNum(r.gst_rate) ?? 12),
    schedule: typeof r.schedule === 'string' ? r.schedule : 'OTC',
    mrp: String(toNum(r.mrp) ?? ''),
    reorder: String(toNum(r.reorder_level) ?? 0),
  }
}
