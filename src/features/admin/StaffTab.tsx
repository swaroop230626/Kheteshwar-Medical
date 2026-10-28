import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ROLE_LABELS, type Role } from '../../types'
import { createStaff, fetchStaff, setStaffActive, type BranchInfo, type StaffRow } from './api'

type Load = 'loading' | 'ready' | 'error'

interface Problem {
  message: string
  technical?: string
}

const STAFF_ROLES: Role[] = ['branch_manager', 'billing_staff', 'store_keeper', 'accountant']

function ProblemBox({ p }: { p: Problem }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{p.message}</p>
      {p.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {p.technical}</p>}
    </div>
  )
}

function StaffForm({ branches, onCancel, onSaved }: { branches: BranchInfo[]; onCancel: () => void; onSaved: (msg: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('billing_staff')
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setProblem(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setProblem({ message: 'ઇમેઇલ બરાબર લખો.' })
    if (fullName.trim() === '') return setProblem({ message: 'નામ લખો.' })
    if (password.length < 8) return setProblem({ message: 'પાસવર્ડ ઓછામાં ઓછો 8 અક્ષરનો રાખો.' })
    if (branchId === '') return setProblem({ message: 'શાખા પસંદ કરો.' })

    busy.current = true
    setSaving(true)
    const res = await createStaff({ email: email.trim(), password, fullName: fullName.trim(), role, branchId, phone: phone.trim() })
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    onSaved(`Staff બનાવ્યો. ઇમેઇલ ${email.trim()} અને તમે રાખેલો પાસવર્ડ તેમને આપો.`)
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">નવો staff</h2>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>રદ કરો</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="s-name" className="mb-1 block text-sm font-medium">નામ *</label>
          <input id="s-name" className="field" value={fullName} disabled={saving} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="s-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <input id="s-phone" inputMode="tel" className="field" value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="s-email" className="mb-1 block text-sm font-medium">ઇમેઇલ (login) *</label>
          <input id="s-email" type="email" autoComplete="off" className="field" value={email} disabled={saving} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="s-pass" className="mb-1 block text-sm font-medium">પાસવર્ડ * (8+ અક્ષર)</label>
          <input id="s-pass" type="text" autoComplete="off" className="field" value={password} disabled={saving} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="s-role" className="mb-1 block text-sm font-medium">Role</label>
          <select id="s-role" className="field" value={role} disabled={saving} onChange={(e) => setRole(e.target.value as Role)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor="s-branch" className="mb-1 block text-sm font-medium">શાખા</label>
          <select id="s-branch" className="field" value={branchId} disabled={saving} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        તે પોતાની શાખાનો જ data જોઈ શકશે. પાસવર્ડ ફક્ત હમણાં દેખાય છે, પછી જોઈ શકાશે નહીં.
      </p>
      {problem && <ProblemBox p={problem} />}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>{saving ? 'બનાવી રહ્યા છીએ…' : 'Staff બનાવો'}</button>
    </form>
  )
}

export function StaffTab({ branches, selfId }: { branches: BranchInfo[]; selfId: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [state, setState] = useState<Load>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchStaff()
      .then((d) => {
        if (cancelled) return
        setStaff(d)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function toggle(row: StaffRow) {
    if (busyId) return
    setProblem(null)
    setNotice(null)
    setBusyId(row.id)
    const res = await setStaffActive(row.id, !row.active)
    setBusyId(null)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    setReloadKey((k) => k + 1)
  }

  if (adding) {
    return (
      <StaffForm
        branches={branches}
        onCancel={() => setAdding(false)}
        onSaved={(msg) => {
          setAdding(false)
          setNotice(msg)
          setReloadKey((k) => k + 1)
        }}
      />
    )
  }

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => { setNotice(null); setAdding(true) }} disabled={branches.length === 0}>
        + નવો staff
      </button>

      {notice && <p role="status" className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">{notice}</p>}
      {problem && <div className="mt-4"><ProblemBox p={problem} /></div>}

      <div className="mt-4">
        {state === 'loading' && <p role="status" className="py-8 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}
        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">Staff ની યાદી લોડ થઈ નથી.</p>
            <button type="button" className="btn-primary mt-3" onClick={() => setReloadKey((k) => k + 1)}>ફરી પ્રયાસ</button>
          </div>
        )}
        {state === 'ready' && (
          <ul className="space-y-3">
            {staff.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold">{s.fullName}{s.id === selfId && ' (તમે)'}</p>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${s.active ? 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200' : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}`}>
                    {s.active ? 'ચાલુ' : 'બંધ'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {ROLE_LABELS[s.role as Role] ?? s.role}
                  {s.branchName && ` · ${s.branchName}`}
                  {s.phone && ` · ${s.phone}`}
                </p>
                {s.id !== selfId && (
                  <button type="button" className="btn-ghost mt-3" disabled={busyId !== null} onClick={() => void toggle(s)}>
                    {busyId === s.id ? '…' : s.active ? 'બંધ કરો' : 'ફરી ચાલુ કરો'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
