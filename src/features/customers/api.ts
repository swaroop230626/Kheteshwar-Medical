import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord, toNum } from '../../lib/parse'

export interface Customer {
  id: string
  name: string
  phone: string
  address: string
  creditLimit: number
  balance: number
}

export interface LedgerEntry {
  id: string
  date: string
  type: string
  debit: number
  credit: number
  note: string
  receiptNo: string
  method: string
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

export async function fetchCustomerList(branchId: string): Promise<Customer[]> {
  const rows = await fetchAll((a, b) =>
    supabase
      .from('customers')
      .select('id, name, phone, address, credit_limit, balance')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('name')
      .order('id')
      .range(a, b),
  )
  const out: Customer[] = []
  for (const r of rows) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string') continue
    out.push({
      id: r.id,
      name: r.name,
      phone: typeof r.phone === 'string' ? r.phone : '',
      address: typeof r.address === 'string' ? r.address : '',
      creditLimit: toNum(r.credit_limit) ?? 0,
      balance: toNum(r.balance) ?? 0,
    })
  }
  return out
}

export async function fetchLedger(customerId: string): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('id, entry_date, entry_type, debit, credit, note, receipt_no, payment_method')
    .eq('customer_id', customerId)
    .order('entry_date', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)
  const out: LedgerEntry[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.entry_date !== 'string') continue
    out.push({
      id: r.id,
      date: r.entry_date,
      type: typeof r.entry_type === 'string' ? r.entry_type : '',
      debit: toNum(r.debit) ?? 0,
      credit: toNum(r.credit) ?? 0,
      note: typeof r.note === 'string' ? r.note : '',
      receiptNo: typeof r.receipt_no === 'string' ? r.receipt_no : '',
      method: typeof r.payment_method === 'string' ? r.payment_method : '',
    })
  }
  return out
}

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  if (m.includes('OVERPAYMENT')) {
    const bal = m.split('OVERPAYMENT:')[1]?.split(/\s/)[0]?.trim()
    return bal ? `રકમ બાકી balance (₹${bal}) કરતાં વધુ છે.` : 'રકમ બાકી balance કરતાં વધુ છે.'
  }
  if (m.includes('INVALID_AMOUNT')) return 'રકમ 0 થી વધુ હોવી જોઈએ.'
  if (m.includes('INVALID_MODE')) return 'Payment mode ખોટો છે.'
  if (m.includes('CUSTOMER_NOT_FOUND')) return 'Customer મળ્યો નથી અથવા તમને તેની પરવાનગી નથી.'
  if (err.code === '23505') return 'આ phone નો customer પહેલેથી છે.'
  if (err.code === '23514') return 'Credit limit 0 કે વધુ હોવી જોઈએ.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને આ કામની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'record_payment function Supabase માં બનાવ્યું નથી. supabase/record_payment.sql ચલાવો.'
  }
  return 'સેવ થઈ શક્યું નહીં. કંઈ પણ સેવ થયું નથી.'
}

function fail<T>(err: { message: string; code?: string }): ActionResult<T> {
  return { ok: false, message: translate(err), technical: `${err.code ?? ''} ${err.message}`.trim() }
}

export interface NewCustomer {
  branchId: string
  name: string
  phone: string
  address: string
  creditLimit: number
}

// A single-row insert is already one transaction; RLS decides who may do it.
export async function addCustomer(c: NewCustomer): Promise<ActionResult<null>> {
  try {
    const { error } = await supabase.from('customers').insert({
      branch_id: c.branchId,
      name: c.name,
      phone: c.phone === '' ? null : c.phone,
      address: c.address === '' ? null : c.address,
      credit_limit: c.creditLimit,
    })
    if (error) return fail(error)
    return { ok: true, data: null }
  } catch (e) {
    return { ok: false, message: 'ઇન્ટરનેટ કે server ની સમસ્યા.', technical: e instanceof Error ? e.message : String(e) }
  }
}

export async function recordPayment(
  customerId: string,
  amount: number,
  mode: string,
  note: string,
): Promise<ActionResult<{ receiptNo: string; balance: number }>> {
  try {
    const { data, error } = await supabase.rpc('record_payment', {
      p_customer_id: customerId,
      p_amount: amount,
      p_mode: mode,
      p_note: note,
    })
    if (error) return fail(error)
    const res: unknown = data
    if (isRecord(res)) {
      return { ok: true, data: { receiptNo: typeof res.receipt_no === 'string' ? res.receipt_no : '', balance: toNum(res.balance) ?? 0 } }
    }
    return { ok: false, message: 'Payment સેવ થઈ, પણ જવાબ સમજાયો નહીં. યાદી ફરી લોડ કરો.', technical: JSON.stringify(res) }
  } catch (e) {
    return { ok: false, message: 'ઇન્ટરનેટ કે server ની સમસ્યા. ફરી તપાસો.', technical: e instanceof Error ? e.message : String(e) }
  }
}
