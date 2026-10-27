import { supabase } from '../../lib/supabase'

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

export type CreateResult = { ok: true } | { ok: false; message: string; technical: string }

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('DUPLICATE_NAME') || err.code === '23505') return 'આ નામની દવા પહેલેથી છે.'
  if (m.includes('INVALID_NAME')) return 'દવાનું નામ લખવું જરૂરી છે.'
  if (m.includes('INVALID_GST')) return 'GST માત્ર 0, 5, 12 કે 18 હોઈ શકે.'
  if (m.includes('INVALID_SCHEDULE')) return 'Schedule માત્ર OTC, H, H1 કે X હોઈ શકે.'
  if (m.includes('INVALID_MRP')) return 'MRP 0 થી વધુ હોવો જોઈએ.'
  if (m.includes('INVALID_REORDER')) return 'Reorder level 0 કે વધુ હોવો જોઈએ.'
  if (m.includes('NO_COMPANY')) return 'Account set up નથી, owner નો સંપર્ક કરો.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને નવી દવા ઉમેરવાની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'create_medicine function Supabase માં બનાવ્યું નથી. supabase/create_medicine.sql ચલાવો.'
  }
  return 'દવા સેવ થઈ શકી નહીં. કંઈ પણ સેવ થયું નથી.'
}

export async function createMedicine(m: NewMedicine): Promise<CreateResult> {
  try {
    const { error } = await supabase.rpc('create_medicine', {
      p_name: m.name,
      p_generic_name: m.genericName === '' ? null : m.genericName,
      p_manufacturer: m.manufacturer === '' ? null : m.manufacturer,
      p_hsn_code: m.hsnCode === '' ? null : m.hsnCode,
      p_gst_rate: m.gstRate,
      p_schedule: m.schedule,
      p_mrp: m.mrp,
      p_reorder_level: m.reorderLevel,
    })
    if (error) return { ok: false, message: translate(error), technical: `${error.code ?? ''} ${error.message}`.trim() }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      message: 'ઇન્ટરનેટ કે server ની સમસ્યા. ફરી પ્રયાસ કરો.',
      technical: e instanceof Error ? e.message : String(e),
    }
  }
}
