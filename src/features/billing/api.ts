import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/fetchAll'
import { isRecord, toNum } from '../../lib/parse'
import type { RxPayload } from './rx'

export interface SellableBatch {
  id: string
  medicineId: string
  name: string
  gstRate: number
  schedule: string // OTC / H / H1 / X
  batchNo: string
  expiryDate: string
  mrp: number
  qty: number // stock_batches.qty_on_hand
}

export interface CustomerOption {
  id: string
  name: string
  phone: string
  creditLimit: number
  balance: number
}

export interface CreateBillInput {
  branchId: string
  customerId: string | null
  newCustomerName: string | null
  newCustomerPhone: string | null
  items: { batch_id: string; qty: number }[]
  payments: { method: string; amount: number }[]
  rx: RxPayload | null // doctor + patient, needed for Schedule H / H1 / X
}

export type CreateBillResult =
  | { ok: true; billId: string; billNo: string; total: number }
  | { ok: false; message: string; technical: string }

function todayISO(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

// Non-expired batches with stock, earliest expiry first (FEFO order)
export async function fetchSellableBatches(branchId: string): Promise<SellableBatch[]> {
  const [batches, medicines] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from('stock_batches')
        .select('id, medicine_id, batch_no, expiry_date, mrp, qty_on_hand')
        .eq('branch_id', branchId)
        .gt('qty_on_hand', 0)
        .gte('expiry_date', todayISO())
        .order('expiry_date')
        .order('id')
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase.from('medicines').select('id, name, gst_rate, schedule').is('deleted_at', null).order('id').range(a, b),
    ),
  ])

  const meds = new Map<string, { name: string; gstRate: number; schedule: string }>()
  for (const m of medicines) {
    if (isRecord(m) && typeof m.id === 'string' && typeof m.name === 'string') {
      meds.set(m.id, { name: m.name, gstRate: toNum(m.gst_rate) ?? 0, schedule: typeof m.schedule === 'string' ? m.schedule : 'OTC' })
    }
  }

  const out: SellableBatch[] = []
  for (const b of batches) {
    if (!isRecord(b)) continue
    const { id, medicine_id, batch_no, expiry_date } = b
    if (typeof id !== 'string' || typeof medicine_id !== 'string' || typeof batch_no !== 'string' || typeof expiry_date !== 'string') continue
    const med = meds.get(medicine_id)
    if (!med) continue
    out.push({
      id,
      medicineId: medicine_id,
      name: med.name,
      gstRate: med.gstRate,
      schedule: med.schedule,
      batchNo: batch_no,
      expiryDate: expiry_date,
      mrp: toNum(b.mrp) ?? 0,
      qty: toNum(b.qty_on_hand) ?? 0,
    })
  }
  return out
}

export async function fetchCustomers(branchId: string): Promise<CustomerOption[]> {
  const rows = await fetchAll((a, b) =>
    supabase
      .from('customers')
      .select('id, name, phone, credit_limit, balance')
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('name')
      .range(a, b),
  )
  const out: CustomerOption[] = []
  for (const r of rows) {
    if (isRecord(r) && typeof r.id === 'string' && typeof r.name === 'string') {
      out.push({
        id: r.id,
        name: r.name,
        phone: typeof r.phone === 'string' ? r.phone : '',
        creditLimit: toNum(r.credit_limit) ?? 0,
        balance: toNum(r.balance) ?? 0,
      })
    }
  }
  return out
}

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  const part = (tag: string) => m.split(`${tag}:`)[1]?.split(/[\n]/)[0]?.trim() ?? ''

  if (m.includes('INSUFFICIENT_STOCK')) {
    const [name, avail] = part('INSUFFICIENT_STOCK').split(':')
    return `${name ?? 'દવા'}: સ્ટોક પૂરતો નથી. બાકી stock: ${avail ?? '?'}`
  }
  if (m.includes('EXPIRED_BATCH')) {
    const [name, batch] = part('EXPIRED_BATCH').split(':')
    return `${name ?? 'દવા'} નો batch ${batch ?? ''} expired છે, વેચી શકાય નહીં.`
  }
  if (m.includes('PAYMENT_MISMATCH')) {
    const [paid, total] = part('PAYMENT_MISMATCH').split(':')
    return `ચૂકવણીનો સરવાળો (₹${paid}) bill ની રકમ (₹${total}) સાથે મેળ ખાતો નથી.`
  }
  if (m.includes('RX_REQUIRED')) return 'Schedule H/H1/X દવા માટે doctor અને patient ની વિગતો જરૂરી છે.'
  if (m.includes('RX_DOCTOR')) return 'Doctor ની વિગતો ખૂટે છે કે doctor મળ્યા નથી.'
  if (m.includes('RX_PATIENT')) return 'Patient નું નામ લખો.'
  if (m.includes('RX_REG_REQUIRED')) return 'Schedule H1/X માટે doctor ની registration no જરૂરી છે.'
  if (m.includes('RX_ADDRESS_REQUIRED')) return 'Schedule H1/X માટે patient નું સરનામું જરૂરી છે.'
  if (m.includes('NO_COMPANY')) return 'Account set up નથી, owner નો સંપર્ક કરો.'
  if (m.includes('CREDIT_NEEDS_CUSTOMER')) return 'Credit માટે customer પસંદ કરવો જરૂરી છે.'
  if (m.includes('CUSTOMER_NOT_FOUND')) return 'Customer મળ્યો નથી. યાદી ફરી લોડ કરો.'
  if (m.includes('EMPTY_CART')) return 'Cart ખાલી છે.'
  if (m.includes('BATCH_NOT_FOUND')) return 'કોઈ batch મળ્યો નથી. પેજ ફરી લોડ કરો.'
  if (m.includes('INVALID_ITEM') || m.includes('INVALID_PAYMENT')) return 'Item કે ચૂકવણીની વિગતો ખોટી છે.'
  if (m.toLowerCase().includes('credit limit exceeded')) return 'Customer ની credit limit પૂરતી નથી.'
  if (err.code === '23505') return 'આ phone નો customer પહેલેથી છે. યાદીમાંથી પસંદ કરો.'
  if (err.code === '23514') return 'સ્ટોક બીજા bill માં વપરાઈ ગયો છે. યાદી ફરી લોડ કરી ચકાસો.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને bill બનાવવાની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'create_bill function અપડેટ નથી. supabase/schedule_register.sql પછી create_bill_v2.sql ચલાવો.'
  }
  return 'Bill સેવ થઈ શક્યું નહીં. કંઈ પણ સેવ થયું નથી.'
}

export async function createBill(input: CreateBillInput): Promise<CreateBillResult> {
  try {
    const { data, error } = await supabase.rpc('create_bill', {
      p_branch: input.branchId,
      p_customer_id: input.customerId,
      p_new_customer_name: input.newCustomerName,
      p_new_customer_phone: input.newCustomerPhone,
      p_items: input.items,
      p_payments: input.payments,
      p_rx: input.rx,
    })
    if (error) return { ok: false, message: translate(error), technical: `${error.code ?? ''} ${error.message}`.trim() }
    const res: unknown = data
    if (isRecord(res) && typeof res.bill_no === 'string') {
      return { ok: true, billId: typeof res.bill_id === 'string' ? res.bill_id : '', billNo: res.bill_no, total: toNum(res.total) ?? 0 }
    }
    return { ok: false, message: 'Bill સેવ થયું, પણ જવાબ સમજાયો નહીં. Medicines માં stock તપાસો.', technical: JSON.stringify(res) }
  } catch (e) {
    return {
      ok: false,
      message: 'ઇન્ટરનેટ કે server ની સમસ્યા. કંઈ પણ સેવ થયું નથી હોય શકે; ફરી તપાસો.',
      technical: e instanceof Error ? e.message : String(e),
    }
  }
}
