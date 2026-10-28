import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord } from '../../lib/parse'

export interface BranchInfo {
  id: string
  name: string
  billPrefix: string
  gstNo: string
  licenceNo: string
  address: string
  phone: string
}

export interface StaffRow {
  id: string
  fullName: string
  role: string
  phone: string
  active: boolean
  branchName: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

export async function fetchBranchInfo(): Promise<BranchInfo[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, bill_prefix, gst_no, drug_licence_no, address, phone')
    .order('name')
  if (error) throw new Error(error.message)
  const out: BranchInfo[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string') continue
    out.push({
      id: r.id,
      name: r.name,
      billPrefix: text(r.bill_prefix),
      gstNo: text(r.gst_no),
      licenceNo: text(r.drug_licence_no),
      address: text(r.address),
      phone: text(r.phone),
    })
  }
  return out
}

export async function fetchStaff(): Promise<StaffRow[]> {
  const rows = await fetchAll((a, b) =>
    supabase
      .from('profiles')
      .select('id, full_name, role, phone, is_active, branches(name)')
      .order('full_name')
      .order('id')
      .range(a, b),
  )
  const out: StaffRow[] = []
  for (const r of rows) {
    if (!isRecord(r) || typeof r.id !== 'string') continue
    const br = Array.isArray(r.branches) ? (r.branches[0] as unknown) : r.branches
    out.push({
      id: r.id,
      fullName: text(r.full_name),
      role: text(r.role),
      phone: text(r.phone),
      active: r.is_active !== false,
      branchName: isRecord(br) ? text(br.name) : '',
    })
  }
  return out
}

function fail<T>(message: string, technical: string): Result<T> {
  return { ok: false, message, technical }
}

function rpcMessage(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('PREFIX_EXISTS') || err.code === '23505') return 'આ bill prefix પહેલેથી વપરાય છે. બીજો પસંદ કરો.'
  if (m.includes('INVALID_PREFIX')) return 'Bill prefix માં ફક્ત A-Z અને 0-9, વધુમાં વધુ 8 અક્ષર.'
  if (m.includes('INVALID_NAME')) return 'નામ લખવું જરૂરી છે.'
  if (m.includes('CANNOT_SELF')) return 'તમે તમારા પોતાના account ને બંધ કરી શકતા નથી.'
  if (m.includes('NOT_ALLOWED') || err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'ફક્ત owner આ કામ કરી શકે.'
  if (m.includes('NO_COMPANY')) return 'Account set up નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) return 'Function બનાવ્યું નથી. supabase/admin.sql ચલાવો.'
  return 'સેવ થઈ શક્યું નથી. કંઈ પણ સેવ થયું નથી.'
}

export interface BranchInput {
  name: string
  billPrefix: string
  gstNo: string
  licenceNo: string
  address: string
  phone: string
}

export async function createBranch(b: BranchInput): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('create_branch', {
      p_name: b.name,
      p_bill_prefix: b.billPrefix,
      p_gst_no: b.gstNo,
      p_drug_licence_no: b.licenceNo,
      p_address: b.address,
      p_phone: b.phone,
    })
    if (error) return fail(rpcMessage(error), `${error.code ?? ''} ${error.message}`.trim())
    return { ok: true, data: null }
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}

export async function updateBranch(id: string, b: Omit<BranchInput, 'billPrefix'>): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('update_branch', {
      p_id: id,
      p_name: b.name,
      p_gst_no: b.gstNo,
      p_drug_licence_no: b.licenceNo,
      p_address: b.address,
      p_phone: b.phone,
    })
    if (error) return fail(rpcMessage(error), `${error.code ?? ''} ${error.message}`.trim())
    return { ok: true, data: null }
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}

export async function setStaffActive(id: string, active: boolean): Promise<Result<null>> {
  try {
    const { error } = await supabase.rpc('set_staff_active', { p_id: id, p_active: active })
    if (error) return fail(rpcMessage(error), `${error.code ?? ''} ${error.message}`.trim())
    return { ok: true, data: null }
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}

export interface StaffInput {
  email: string
  password: string
  fullName: string
  role: string
  branchId: string
  phone: string
}

const FUNCTION_ERRORS: Record<string, string> = {
  NOT_OWNER: 'ફક્ત owner staff બનાવી શકે.',
  NOT_SIGNED_IN: 'ફરી લોગિન કરો.',
  INVALID_INPUT: 'ઇમેઇલ, નામ, role અને શાખા બરાબર ભરો.',
  WEAK_PASSWORD: 'પાસવર્ડ ઓછામાં ઓછો 8 અક્ષરનો હોવો જોઈએ.',
  BRANCH_NOT_FOUND: 'શાખા મળી નથી.',
  EMAIL_EXISTS: 'આ ઇમેઇલથી account પહેલેથી છે.',
  AUTH_FAILED: 'Login બનાવી શકાયો નથી.',
  PROFILE_FAILED: 'Staff ની profile બનાવી શકાઈ નથી. કંઈ પણ બન્યું નથી.',
  SERVER_CONFIG: 'Function ની ગોઠવણ અધૂરી છે.',
}

// Login creation needs the service key, so it runs in the Edge Function supabase/functions/create-staff
export async function createStaff(s: StaffInput): Promise<Result<null>> {
  try {
    const { error } = await supabase.functions.invoke('create-staff', {
      body: {
        email: s.email,
        password: s.password,
        full_name: s.fullName,
        role: s.role,
        branch_id: s.branchId,
        phone: s.phone,
      },
    })
    if (!error) return { ok: true, data: null }

    if (error instanceof FunctionsHttpError) {
      const status: unknown = error.context?.status
      const body: unknown = await error.context.json().catch(() => null)
      const code = isRecord(body) && typeof body.error === 'string' ? body.error : ''
      const detail = isRecord(body) && typeof body.detail === 'string' ? body.detail : ''
      if (status === 404) {
        return fail('create-staff function Supabase માં deploy કરેલું નથી.', 'HTTP 404')
      }
      return fail(FUNCTION_ERRORS[code] ?? 'Staff બનાવી શકાયો નથી.', `${code} ${detail}`.trim() || `HTTP ${String(status)}`)
    }
    return fail('Function સુધી પહોંચી શકાયું નથી. ઇન્ટરનેટ તપાસો કે function deploy કરો.', error.message)
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}
