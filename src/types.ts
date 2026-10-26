export const ROLES = [
  'owner',
  'branch_manager',
  'billing_staff',
  'store_keeper',
  'accountant',
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'માલિક',
  branch_manager: 'બ્રાન્ચ મેનેજર',
  billing_staff: 'બિલિંગ સ્ટાફ',
  store_keeper: 'સ્ટોર કીપર',
  accountant: 'એકાઉન્ટન્ટ',
}

export interface Profile {
  id: string
  role: Role
  branch_id: string | null
}

export interface Branch {
  id: string
  company_id: string
  name: string
  bill_prefix: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

export function parseProfile(row: unknown): Profile | null {
  if (!isRecord(row)) return null
  const { id, role, branch_id } = row
  if (typeof id !== 'string' || !isRole(role)) return null
  return { id, role, branch_id: typeof branch_id === 'string' ? branch_id : null }
}

export function parseBranches(rows: unknown): Branch[] {
  if (!Array.isArray(rows)) return []
  const out: Branch[] = []
  for (const r of rows as unknown[]) {
    if (!isRecord(r)) continue
    const { id, company_id, name, bill_prefix } = r
    if (
      typeof id === 'string' &&
      typeof company_id === 'string' &&
      typeof name === 'string' &&
      typeof bill_prefix === 'string'
    ) {
      out.push({ id, company_id, name, bill_prefix })
    }
  }
  return out
}
