import { useRef, useState, type FormEvent } from 'react'
import { recordPayment, type Customer, type LedgerEntry } from './api'
import { BalanceBadge, Skeleton, money } from './BalanceBadge'
import { useLedger } from './hooks'

const TYPE_LABELS: Record<string, string> = {
  credit_sale: 'ઉધાર વેચાણ',
  receipt: 'Payment',
  return_adjustment: 'Sales return',
  bill_reversal: 'Bill રદ',
  opening_balance: 'શરૂઆતનું બાકી',
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function LedgerRow({ e }: { e: LedgerEntry }) {
  const isDebit = e.debit > 0
  return (
    <li className="flex items-start justify-between gap-3 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">
          {TYPE_LABELS[e.type] ?? e.type}
          {e.method && <span className="text-slate-600 dark:text-slate-400"> · {e.method.toUpperCase()}</span>}
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          {formatWhen(e.date)}
          {e.receiptNo && ` · ${e.receiptNo}`}
        </p>
        {e.note && <p className="break-words text-slate-600 dark:text-slate-400">{e.note}</p>}
      </div>
      <p className={`shrink-0 text-right font-semibold ${isDebit ? 'text-orange-700 dark:text-orange-300' : 'text-green-700 dark:text-green-400'}`}>
        <span className="block text-xs font-medium">{isDebit ? 'ઉધાર' : 'જમા'}</span>
        {money.format(isDebit ? e.debit : e.credit)}
      </p>
    </li>
  )
}

interface Props {
  customer: Customer
  canPay: boolean
  onChanged: () => void
  onClose: () => void
}

export function CustomerDetail({ customer, canPay, onChanged, onClose }: Props) {
  const { entries, state, reload } = useLedger(customer.id)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('cash')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<{ message: string; technical?: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setProblem(null)
    setNotice(null)

    const n = Number(amount)
    if (amount.trim() === '' || !Number.isFinite(n) || n <= 0) return setProblem({ message: 'રકમ 0 થી વધુ હોવી જોઈએ.' })
    if (n > customer.balance) return setProblem({ message: `રકમ બાકી balance (${money.format(customer.balance)}) કરતાં વધુ ન હોઈ શકે.` })

    busy.current = true
    setSaving(true)
    const res = await recordPayment(customer.id, n, mode, note.trim())
    busy.current = false
    setSaving(false)

    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    setNotice(`Payment નોંધાઈ ${res.data.receiptNo ? `(${res.data.receiptNo})` : ''}. નવું બાકી: ${money.format(res.data.balance)}`)
    setAmount('')
    setNote('')
    reload()
    onChanged()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold">{customer.name}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {customer.phone || 'Phone નથી'}
              {customer.address && ` · ${customer.address}`}
            </p>
          </div>
          <button type="button" className="btn-ghost lg:hidden" onClick={onClose}>← પાછા</button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-600 dark:text-slate-400">બાકી balance</dt>
            <dd className="mt-1"><BalanceBadge balance={customer.balance} /></dd>
          </div>
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Credit limit</dt>
            <dd className="mt-1 font-semibold">{money.format(customer.creditLimit)}</dd>
          </div>
        </dl>
      </section>

      {canPay && customer.balance > 0 && (
        <form onSubmit={submit} noValidate className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold">નવી payment</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="p-amt" className="mb-1 block text-sm font-medium">રકમ (₹)</label>
              <input id="p-amt" inputMode="decimal" className="field" value={amount} disabled={saving}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p-mode" className="mb-1 block text-sm font-medium">Mode</label>
              <select id="p-mode" className="field" value={mode} disabled={saving} onChange={(e) => setMode(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <button type="button" className="btn-ghost" disabled={saving} onClick={() => setAmount(String(customer.balance))}>
            આખું બાકી ભરો ({money.format(customer.balance)})
          </button>
          <div>
            <label htmlFor="p-note" className="mb-1 block text-sm font-medium">નોંધ (વૈકલ્પિક)</label>
            <input id="p-note" className="field" value={note} disabled={saving} onChange={(e) => setNote(e.target.value)} />
          </div>

          {problem && (
            <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <p className="font-semibold">{problem.message}</p>
              {problem.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {problem.technical}</p>}
            </div>
          )}

          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
            {saving ? 'સેવ થઈ રહ્યું છે…' : 'Payment સેવ કરો'}
          </button>
        </form>
      )}

      {notice && (
        <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {notice}
        </p>
      )}

      {canPay && customer.balance <= 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">કોઈ બાકી રકમ નથી, એટલે payment લેવાની જરૂર નથી.</p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold">Ledger</h3>
        {state === 'loading' && <div className="mt-3"><Skeleton rows={3} /></div>}
        {state === 'error' && (
          <div role="alert" className="mt-3 text-sm text-red-800 dark:text-red-300">
            <p>Ledger લોડ થઈ શક્યું નથી.</p>
            <button type="button" className="btn-primary mt-2" onClick={reload}>ફરી પ્રયાસ</button>
          </div>
        )}
        {state === 'ready' && entries.length === 0 && (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">હજી કોઈ ledger entry નથી.</p>
        )}
        {state === 'ready' && entries.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {entries.map((e) => (
              <LedgerRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
