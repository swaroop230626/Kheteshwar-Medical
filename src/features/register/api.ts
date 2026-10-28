import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord, toNum } from '../../lib/parse'
import { countOf } from '../prescriptions/api'

export interface DoctorOption {
  id: string
  name: string
  regNo: string
  phone: string
}

export interface RegisterRow {
  id: string
  billId: string
  entryType: string // 'sale' | 'return'
  returnNo: string
  cancelled: boolean // the bill was cancelled
  photos: number // prescription photos on this bill
  date: string // ISO time
  billNo: string
  medicine: string
  schedule: string
  batchNo: string
  qty: number
  doctorName: string
  doctorRegNo: string
  patientName: string
  patientAddress: string
  patientAge: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

export async function fetchDoctors(): Promise<DoctorOption[]> {
  const rows = await fetchAll((a, b) =>
    supabase
      .from('doctors')
      .select('id, name, registration_no, phone')
      .is('deleted_at', null)
      .order('name')
      .order('id')
      .range(a, b),
  )
  const out: DoctorOption[] = []
  for (const r of rows) {
    if (isRecord(r) && typeof r.id === 'string' && typeof r.name === 'string') {
      out.push({ id: r.id, name: r.name, regNo: text(r.registration_no), phone: text(r.phone) })
    }
  }
  return out
}

function fail<T>(message: string, technical: string): Result<T> {
  return { ok: false, message, technical }
}

export async function createDoctor(name: string, regNo: string, phone: string): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('create_doctor', {
      p_name: name,
      p_registration_no: regNo === '' ? null : regNo,
      p_phone: phone === '' ? null : phone,
    })
    if (error) {
      const m = error.message
      const message =
        error.code === '23505' ? 'આ registration no વાળા doctor પહેલેથી છે.'
        : m.includes('INVALID_NAME') ? 'Doctor નું નામ લખવું જરૂરી છે.'
        : error.code === '42501' || m.toLowerCase().includes('row-level security') ? 'તમને doctor ઉમેરવાની પરવાનગી નથી.'
        : error.code === 'PGRST202' || m.includes('Could not find the function') ? 'create_doctor function બનાવ્યું નથી. supabase/schedule_register.sql ચલાવો.'
        : 'Doctor સેવ થઈ શક્યા નથી.'
      return fail(message, `${error.code ?? ''} ${m}`.trim())
    }
    return { ok: true, data: null }
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}

// from / to are India dates (YYYY-MM-DD)
export async function fetchRegister(branchId: string, from: string, to: string): Promise<Result<RegisterRow[]>> {
  try {
    const rows = await fetchAll((a, b) =>
      supabase
        .from('schedule_register')
        .select('id, bill_id, entry_type, return_no, sale_date, bill_no, medicine_name, schedule, batch_no, qty, doctor_name, doctor_reg_no, patient_name, patient_address, patient_age, bills(deleted_at, prescription_files(id))')
        .eq('branch_id', branchId)
        .gte('sale_date', `${from}T00:00:00+05:30`)
        .lte('sale_date', `${to}T23:59:59.999+05:30`)
        .order('sale_date', { ascending: false })
        .order('id')
        .range(a, b),
    )
    const out: RegisterRow[] = []
    for (const r of rows) {
      if (!isRecord(r) || typeof r.id !== 'string') continue
      const bill = Array.isArray(r.bills) ? (r.bills[0] as unknown) : r.bills
      out.push({
        id: r.id,
        billId: text(r.bill_id),
        entryType: text(r.entry_type) || 'sale',
        returnNo: text(r.return_no),
        cancelled: isRecord(bill) && typeof bill.deleted_at === 'string',
        photos: isRecord(bill) ? countOf(bill.prescription_files) : 0,
        date: text(r.sale_date),
        billNo: text(r.bill_no),
        medicine: text(r.medicine_name),
        schedule: text(r.schedule),
        batchNo: text(r.batch_no),
        qty: toNum(r.qty) ?? 0,
        doctorName: text(r.doctor_name),
        doctorRegNo: text(r.doctor_reg_no),
        patientName: text(r.patient_name),
        patientAddress: text(r.patient_address),
        patientAge: text(r.patient_age),
      })
    }
    return { ok: true, data: out }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    const missing = m.includes('schedule_register') && m.toLowerCase().includes('not')
    return fail(
      missing ? 'Register ટેબલ બનાવ્યું નથી. supabase/schedule_register.sql ચલાવો.' : 'Register લોડ થઈ શક્યું નથી. ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.',
      m,
    )
  }
}
