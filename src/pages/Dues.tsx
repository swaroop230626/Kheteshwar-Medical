import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { normalizePhone } from '../features/billing/WhatsAppShare'
import { useShop } from '../features/billing/PrintBill'
import { money } from '../features/billing/cart'
import { fetchDues, logReminder, type DueRow } from '../features/dues/api'
import { formatDate } from '../features/medicines/stock'

const CAN_VIEW = ['owner', 'branch_manager', 'billing_staff', 'accountant']

type Load = 'loading' | 'ready' | 'error'
type Min = 0 | 1 | 7 | 30

const FILTERS: { min: Min; label: string }[] = [
  { min: 0, label: 'બધા' },
  { min: 1, label: '1+ દિવસ' },
  { min: 7, label: '7+ દિવસ' },
  { min: 30, label: '30+ દિવસ' },
]

function tone(days: number): { label: string; cls: string } {
  if (days >= 30) return { label: '30+ દિવસ', cls: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' }
  if (days >= 7) return { label: '7+ દિવસ', cls: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' }
  if (days >= 1) return { label: '1+ દિવસ', cls: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200' }
  return { label: 'આજનું', cls: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' }
}

function when(iso: string | null): string {
  if (!iso) return 'હજી યાદ નથી અપાવ્યું'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `છેલ્લી યાદ: ${d.toLocaleDateString('en-IN')}`
}

function remindedToday(iso: string | null): boolean {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000
}

function reminderText(shop: string, r: DueRow): string {
  const since = r.oldestDue ? ` (${formatDate(r.oldestDue)} થી${r.days > 0 ? `, ${r.days} દિવસ` : ''})` : ''
  return `નમસ્કાર ${r.name},\n${shop} તરફથી યાદી: તમારું ${money.format(r.balance)} બાકી છે${since}.\nસગવડે ચૂકવણી કરશો. આભાર.`
}

function DuesInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const shop = useShop(branchId)
  const [rows, setRows] = useState<DueRow[]>([])
  const [state, setState] = useState<Load>('loading')
  const [technical, setTechnical] = useState('')
  const [key, setKey] = useState(0)
  const [min, setMin] = useState<Min>(0)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchDues(branchId)
      .then((d) => {
        if (cancelled) return
        setRows(d)
        setState('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setTechnical(e instanceof Error ? e.message : String(e))
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [branchId, key])

  const counts = useMemo(() => FILTERS.map((f) => rows.filter((r) => r.days >= f.min).length), [rows])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => r.days >= min && (!q || r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q)))
  }, [rows, min, query])
  const total = Math.round(visible.reduce((s, r) => s + r.balance * 100, 0)) / 100

  function remind(r: DueRow) {
    setNotice(null)
    setRowError(null)
    const num = normalizePhone(r.phone)
    if (num === null) {
      setRowError({ id: r.customerId, message: r.phone === '' ? 'આ customer નો phone નંબર નથી. Customers માં ઉમેરો.' : 'Phone નંબર ખોટો છે (10 અંક જોઈએ).' })
      return
    }
    const text = encodeURIComponent(reminderText(shop?.name || branchName, r))
    window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener,noreferrer')
    // note it down (a failure here never blocks the message)
    void logReminder(branchId, r.customerId, r.balance).then((err) => {
      if (err) setRowError({ id: r.customerId, message: `યાદ અપાવ્યાની નોંધ સેવ થઈ નથી: ${err}` })
      else {
        setNotice(`${r.name} ને યાદ અપાવ્યું તેની નોંધ થઈ.`)
        setKey((k) => k + 1)
      }
    })
  }

  const action = (r: DueRow) => (
    <button type="button" className={remindedToday(r.lastReminded) ? 'btn-ghost' : 'btn-primary'} onClick={() => remind(r)}>
      {remindedToday(r.lastReminded) ? 'ફરી યાદ' : 'WhatsApp યાદ'}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">બાકી યાદી</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setKey((k) => k + 1)} disabled={state === 'loading'}>
          {state === 'loading' ? 'લોડ થઈ રહ્યું છે…' : '↻ Refresh'}
        </button>
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:max-w-3xl" role="group" aria-label="કેટલા દિવસથી બાકી">
        {FILTERS.map((f, i) => (
          <button key={f.min} type="button" aria-pressed={min === f.min} onClick={() => setMin(f.min)}
            className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              min === f.min ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
            }`}>
            {f.label} ({counts[i]})
          </button>
        ))}
      </div>

      <div className="mt-3 sm:max-w-md">
        <label htmlFor="due-q" className="sr-only">નામ અથવા phone શોધો</label>
        <input id="due-q" type="search" className="field" placeholder="નામ અથવા phone શોધો" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="mt-4">
        {state === 'loading' && <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}

        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">બાકી યાદી લોડ થઈ શકી નથી. supabase/dues.sql ચલાવ્યું છે?</p>
            <p className="mt-1 break-words font-mono text-xs">Technical: {technical}</p>
            <button type="button" className="btn-primary mt-3" onClick={() => setKey((k) => k + 1)}>ફરી પ્રયાસ</button>
          </div>
        )}

        {state === 'ready' && rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">કોઈનું બાકી નથી.</p>
        )}

        {state === 'ready' && rows.length > 0 && visible.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">આ પસંદગીમાં કોઈ નથી.</p>
        )}

        {state === 'ready' && visible.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{visible.length} customers · કુલ બાકી <span className="font-bold text-slate-900 dark:text-slate-100">{money.format(total)}</span></p>

            <ul className="space-y-3 md:hidden">
              {visible.map((r) => {
                const t = tone(r.days)
                return (
                  <li key={r.customerId} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 break-words font-semibold">{r.name}</p>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${t.cls}`}>{r.days > 0 ? `${r.days} દિવસ` : t.label}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{r.phone || 'Phone નથી'}{r.oldestDue && ` · ${formatDate(r.oldestDue)} થી`}</p>
                    <p className="mt-1 text-xl font-bold text-orange-700 dark:text-orange-300">{money.format(r.balance)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{when(r.lastReminded)}</p>
                    <div className="mt-3">{action(r)}</div>
                    {rowError?.id === r.customerId && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{rowError.message}</p>}
                  </li>
                )
              })}
            </ul>

            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th scope="col" className="px-3 py-3">Customer</th>
                    <th scope="col" className="px-3 py-3">Phone</th>
                    <th scope="col" className="px-3 py-3 text-right">બાકી</th>
                    <th scope="col" className="px-3 py-3">કેટલા દિવસથી</th>
                    <th scope="col" className="px-3 py-3">છેલ્લી યાદ</th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">યાદ અપાવો</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 align-top dark:divide-slate-800">
                  {visible.map((r) => {
                    const t = tone(r.days)
                    return (
                      <tr key={r.customerId}>
                        <td className="px-3 py-3 font-semibold">{r.name}</td>
                        <td className="px-3 py-3">{r.phone || '—'}</td>
                        <td className="px-3 py-3 text-right font-bold text-orange-700 dark:text-orange-300">{money.format(r.balance)}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${t.cls}`}>{r.days > 0 ? `${r.days} દિવસ` : t.label}</span>
                          {r.oldestDue && <span className="mt-1 block text-slate-600 dark:text-slate-400">{formatDate(r.oldestDue)} થી</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-400">{when(r.lastReminded).replace('છેલ્લી યાદ: ', '')}</td>
                        <td className="px-3 py-1">
                          {action(r)}
                          {rowError?.id === r.customerId && <p role="alert" className="mt-1 max-w-56 text-sm text-red-700 dark:text-red-300">{rowError.message}</p>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        દિવસો સૌથી જૂના બાકી ઉધારથી ગણાય છે (ચૂકવણી જૂના ઉધારમાં પહેલા ગણાય છે). WhatsApp બટન દબાવતાં સંદેશ લખાયેલો ખૂલે છે, તમારે Send દબાવવાનું.
      </p>
    </div>
  )
}

export function Dues() {
  const { selected } = useBranch()
  const { profile } = useAuth()
  if (!selected) return null
  if (!profile || !CAN_VIEW.includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold">બાકી યાદી</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">તમારી role થી આ પેજ જોઈ શકાતું નથી.</p>
      </div>
    )
  }
  return <DuesInner key={selected.id} branchId={selected.id} branchName={selected.name} />
}
