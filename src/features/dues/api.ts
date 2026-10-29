import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

export interface DueRow {
  customerId: string
  name: string
  phone: string
  balance: number
  oldestDue: string // YYYY-MM-DD
  days: number // days since the oldest unpaid credit
  lastReminded: string | null // ISO time
}

// Throws when the function is missing, so callers can show a clear message.
export async function fetchDues(branchId: string): Promise<DueRow[]> {
  const { data, error } = await supabase.rpc('report_dues', { p_branch: branchId })
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim())
  const out: DueRow[] = []
  for (const r of (data ?? []) as unknown[]) {
    if (!isRecord(r) || typeof r.customer_id !== 'string') continue
    out.push({
      customerId: r.customer_id,
      name: typeof r.customer_name === 'string' ? r.customer_name : '',
      phone: typeof r.phone === 'string' ? r.phone : '',
      balance: toNum(r.balance) ?? 0,
      oldestDue: typeof r.oldest_due === 'string' ? r.oldest_due : '',
      days: Math.max(toNum(r.days_overdue) ?? 0, 0),
      lastReminded: typeof r.last_reminded_at === 'string' ? r.last_reminded_at : null,
    })
  }
  return out
}

export async function logReminder(branchId: string, customerId: string, amount: number): Promise<string | null> {
  try {
    const { error } = await supabase.from('due_reminders').insert({
      branch_id: branchId,
      customer_id: customerId,
      channel: 'whatsapp',
      amount,
    })
    return error ? `${error.code ?? ''} ${error.message}`.trim() : null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}
