import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

export interface BillHit {
  id: string
  billNo: string
  billDate: string
  customerName: string
  total: number
}

export interface ReturnItem {
  id: string // bill_items.id
  name: string
  batchNo: string
  qty: number // sold
  returned: number // already returned
  taxable: number
  cgst: number
  sgst: number
  igst: number
  lineTotal: number
  retTaxable: number // amounts already refunded for this line
  retCgst: number
  retSgst: number
  retIgst: number
}

export interface BillForReturn {
  id: string
  billNo: string
  customerId: string | null
  customerName: string
  total: number
  hadCredit: boolean
  customerBalance: number | null
  items: ReturnItem[]
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; technical: string }

function fail<T>(message: string, technical: string): ApiResult<T> {
  return { ok: false, message, technical }
}

// Bills of this branch only, not deleted. Part of the bill number is enough.
export async function searchBills(branchId: string, term: string): Promise<ApiResult<BillHit[]>> {
  const clean = term.trim().replace(/[%_\\]/g, (c) => `\\${c}`)
  if (clean === '') return { ok: true, data: [] }
  const { data, error } = await supabase
    .from('bills')
    .select('id, bill_no, bill_date, customer_name, total_amount')
    .eq('branch_id', branchId)
    .is('deleted_at', null)
    .ilike('bill_no', `%${clean}%`)
    .order('bill_date', { ascending: false })
    .limit(10)
  if (error) return fail('Bill શોધી શકાયા નથી. ફરી પ્રયાસ કરો.', `${error.code ?? ''} ${error.message}`.trim())
  const out: BillHit[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.bill_no !== 'string') continue
    out.push({
      id: r.id,
      billNo: r.bill_no,
      billDate: typeof r.bill_date === 'string' ? r.bill_date : '',
      customerName: typeof r.customer_name === 'string' ? r.customer_name : '',
      total: toNum(r.total_amount) ?? 0,
    })
  }
  return { ok: true, data: out }
}

function batchNoOf(v: unknown): string {
  const one = Array.isArray(v) ? (v[0] as unknown) : v
  return isRecord(one) && typeof one.batch_no === 'string' ? one.batch_no : ''
}

export async function fetchBillForReturn(branchId: string, billId: string): Promise<ApiResult<BillForReturn>> {
  try {
    const billRes = await supabase
      .from('bills')
      .select('id, bill_no, customer_id, customer_name, total_amount')
      .eq('id', billId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle()
    if (billRes.error) return fail('Bill લોડ થયું નથી.', `${billRes.error.code ?? ''} ${billRes.error.message}`.trim())
    const bill: unknown = billRes.data
    if (!isRecord(bill) || typeof bill.id !== 'string' || typeof bill.bill_no !== 'string') {
      return fail('આ bill મળ્યું નથી, કે રદ થયું છે.', 'bill not found')
    }
    const customerId = typeof bill.customer_id === 'string' ? bill.customer_id : null

    const [itemsRes, payRes, custRes] = await Promise.all([
      supabase
        .from('bill_items')
        .select('id, medicine_name, qty, taxable_amount, cgst_amount, sgst_amount, igst_amount, line_total, stock_batches(batch_no)')
        .eq('bill_id', billId)
        .order('id'),
      supabase.from('bill_payments').select('method').eq('bill_id', billId),
      customerId
        ? supabase.from('customers').select('balance').eq('id', customerId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (itemsRes.error) return fail('Bill ની items લોડ થઈ નથી.', `${itemsRes.error.code ?? ''} ${itemsRes.error.message}`.trim())
    if (payRes.error) return fail('Payment લોડ થયું નથી.', `${payRes.error.code ?? ''} ${payRes.error.message}`.trim())

    const rawItems = (itemsRes.data ?? []) as unknown[]
    const ids = rawItems.flatMap((r) => (isRecord(r) && typeof r.id === 'string' ? [r.id] : []))

    const retRes = ids.length
      ? await supabase
          .from('sales_return_items')
          .select('bill_item_id, qty, taxable_amount, cgst_amount, sgst_amount, igst_amount')
          .eq('branch_id', branchId)
          .in('bill_item_id', ids)
      : { data: [] as unknown[], error: null }
    if (retRes.error) return fail('અગાઉના returns લોડ થયા નથી.', `${retRes.error.code ?? ''} ${retRes.error.message}`.trim())

    const sums = new Map<string, { qty: number; t: number; c: number; s: number; i: number }>()
    for (const r of (retRes.data ?? []) as unknown[]) {
      if (!isRecord(r) || typeof r.bill_item_id !== 'string') continue
      const cur = sums.get(r.bill_item_id) ?? { qty: 0, t: 0, c: 0, s: 0, i: 0 }
      cur.qty += toNum(r.qty) ?? 0
      cur.t += toNum(r.taxable_amount) ?? 0
      cur.c += toNum(r.cgst_amount) ?? 0
      cur.s += toNum(r.sgst_amount) ?? 0
      cur.i += toNum(r.igst_amount) ?? 0
      sums.set(r.bill_item_id, cur)
    }

    const items: ReturnItem[] = []
    for (const r of rawItems) {
      if (!isRecord(r) || typeof r.id !== 'string') continue
      const s = sums.get(r.id)
      items.push({
        id: r.id,
        name: typeof r.medicine_name === 'string' ? r.medicine_name : '',
        batchNo: batchNoOf(r.stock_batches),
        qty: toNum(r.qty) ?? 0,
        returned: s?.qty ?? 0,
        taxable: toNum(r.taxable_amount) ?? 0,
        cgst: toNum(r.cgst_amount) ?? 0,
        sgst: toNum(r.sgst_amount) ?? 0,
        igst: toNum(r.igst_amount) ?? 0,
        lineTotal: toNum(r.line_total) ?? 0,
        retTaxable: s?.t ?? 0,
        retCgst: s?.c ?? 0,
        retSgst: s?.s ?? 0,
        retIgst: s?.i ?? 0,
      })
    }

    const hadCredit = ((payRes.data ?? []) as unknown[]).some((p) => isRecord(p) && p.method === 'credit')
    const cust: unknown = custRes.data
    return {
      ok: true,
      data: {
        id: bill.id,
        billNo: bill.bill_no,
        customerId,
        customerName: typeof bill.customer_name === 'string' ? bill.customer_name : '',
        total: toNum(bill.total_amount) ?? 0,
        hadCredit,
        customerBalance: isRecord(cust) ? toNum(cust.balance) : null,
        items,
      },
    }
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા.', e instanceof Error ? e.message : String(e))
  }
}

function translate(err: { message: string; code?: string }): string {
  const m = err.message
  const part = (tag: string) => m.split(`${tag}:`)[1]?.split('\n')[0]?.trim() ?? ''

  if (m.includes('RETURN_EXCEEDS')) {
    const [name, left] = part('RETURN_EXCEEDS').split(':')
    return `${name ?? 'દવા'}: પરત qty વધુ છે. હજી પરત થઈ શકે: ${left ?? '?'}`
  }
  if (m.includes('REFUND_EXCEEDS_BALANCE')) {
    return `Refund customer ના બાકી balance (₹${part('REFUND_EXCEEDS_BALANCE')}) કરતાં વધુ છે. Cash refund પસંદ કરો.`
  }
  if (m.includes('CREDIT_NEEDS_CUSTOMER')) return 'Balance માંથી ઘટાડવા bill માં customer હોવો જોઈએ. Cash refund પસંદ કરો.'
  if (m.includes('BILL_NOT_FOUND')) return 'Bill મળ્યું નથી, કે આ branch નું નથી.'
  if (m.includes('BILL_DELETED')) return 'આ bill રદ થયું છે, return થઈ શકે નહીં.'
  if (m.includes('ITEM_NOT_IN_BILL')) return 'કોઈ item આ bill ની નથી.'
  if (m.includes('INVALID_QTY') || m.includes('EMPTY_RETURN')) return 'ઓછામાં ઓછી એક item ની પરત qty 0 થી વધુ હોવી જોઈએ.'
  if (m.includes('INVALID_METHOD')) return 'Refund પ્રકાર ખોટો છે.'
  if (m.includes('CUSTOMER_NOT_FOUND')) return 'Customer મળ્યો નથી.'
  if (err.code === '42501' || m.toLowerCase().includes('row-level security')) return 'તમને return કરવાની પરવાનગી નથી.'
  if (err.code === 'PGRST202' || m.includes('Could not find the function')) {
    return 'create_sales_return function Supabase માં બનાવ્યું નથી. supabase/create_sales_return.sql ચલાવો.'
  }
  return 'Return સેવ થઈ શક્યું નહીં. કંઈ પણ સેવ થયું નથી.'
}

export async function createSalesReturn(
  billId: string,
  items: { bill_item_id: string; qty: number }[],
  method: 'cash' | 'credit',
  reason: string,
): Promise<ApiResult<{ returnNo: string; total: number; method: string }>> {
  try {
    const { data, error } = await supabase.rpc('create_sales_return', {
      p_bill_id: billId,
      p_items: items,
      p_refund_method: method,
      p_reason: reason,
    })
    if (error) return fail(translate(error), `${error.code ?? ''} ${error.message}`.trim())
    const res: unknown = data
    if (isRecord(res) && typeof res.return_no === 'string') {
      return { ok: true, data: { returnNo: res.return_no, total: toNum(res.total) ?? 0, method: typeof res.refund_method === 'string' ? res.refund_method : method } }
    }
    return fail('Return સેવ થયું, પણ જવાબ સમજાયો નહીં. Medicines માં stock તપાસો.', JSON.stringify(res))
  } catch (e) {
    return fail('ઇન્ટરનેટ કે server ની સમસ્યા. ફરી તપાસો.', e instanceof Error ? e.message : String(e))
  }
}
