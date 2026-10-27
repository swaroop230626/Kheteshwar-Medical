import { useRef, useState, type FormEvent } from 'react'
import { money } from '../billing/cart'
import { formatDate } from '../medicines/stock'
import {
  createSalesReturn,
  fetchBillForReturn,
  searchBills,
  type BillForReturn,
  type BillHit,
} from './api'
import { parseReturnQty, refundFor, remainingQty, round2 } from './calc'

type Method = 'cash' | 'credit'

interface Problem {
  message: string
  technical?: string
}

interface Done {
  returnNo: string
  total: number
  method: string
}

function ProblemBox({ p }: { p: Problem }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{p.message}</p>
      {p.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {p.technical}</p>}
    </div>
  )
}

export function ReturnPanel({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<BillHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [bill, setBill] = useState<BillForReturn | null>(null)
  const [loadingBill, setLoadingBill] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [method, setMethod] = useState<Method>('cash')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (searching) return
    setProblem(null)
    setBill(null)
    setSearching(true)
    const res = await searchBills(branchId, term)
    setSearching(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    setHits(res.data)
    if (res.data.length === 1) void open(res.data[0].id)
  }

  async function open(billId: string) {
    setProblem(null)
    setLoadingBill(true)
    const res = await fetchBillForReturn(branchId, billId)
    setLoadingBill(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    const b = res.data
    setBill(b)
    setQty({})
    setReason('')
    // default refund type: credit sale + customer still owes money -> reduce balance, else cash
    const canCredit = b.customerId !== null && (b.customerBalance ?? 0) > 0
    setMethod(b.hadCredit && canCredit ? 'credit' : 'cash')
  }

  function reset() {
    setBill(null)
    setHits(null)
    setTerm('')
    setQty({})
    setProblem(null)
    setDone(null)
  }

  // ---- derived ----
  const lines = (bill?.items ?? []).map((it) => {
    const q = parseReturnQty(qty[it.id] ?? '')
    const left = remainingQty(it)
    const error = q === null ? 'પૂર્ણાંક લખો (0 કે વધુ).' : q > left ? `બાકી qty: ${left}` : null
    const refund = q !== null && q > 0 && q <= left ? refundFor(it, q) : 0
    return { it, q: q ?? 0, left, error, refund }
  })
  const total = round2(lines.reduce((s, l) => s + l.refund, 0))
  const anyQty = lines.some((l) => l.q > 0)
  const balance = bill?.customerBalance ?? null
  const canCredit = bill !== null && bill.customerId !== null && balance !== null && balance > 0

  async function save() {
    if (busy.current || !bill) return
    setProblem(null)
    if (lines.some((l) => l.error !== null)) return setProblem({ message: 'લાલ વિગતો સુધારો.' })
    if (!anyQty) return setProblem({ message: 'ઓછામાં ઓછી એક item ની પરત qty 0 થી વધુ રાખો.' })
    if (method === 'credit') {
      if (!canCredit) return setProblem({ message: 'Balance માંથી ઘટાડવા customer અને બાકી balance જોઈએ. Cash પસંદ કરો.' })
      if (balance !== null && total > balance) {
        return setProblem({ message: `Refund (${money.format(total)}) customer ના બાકી balance (${money.format(balance)}) કરતાં વધુ છે. Cash પસંદ કરો.` })
      }
    }

    busy.current = true
    setSaving(true)
    const res = await createSalesReturn(
      bill.id,
      lines.filter((l) => l.q > 0).map((l) => ({ bill_item_id: l.it.id, qty: l.q })),
      method,
      reason.trim(),
    )
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    setDone(res.data)
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <div role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <p className="font-semibold">Return સેવ થયું. સ્ટોક પાછો વધી ગયો છે.</p>
          <p className="text-2xl font-bold">{done.returnNo}</p>
          <p className="mt-1">
            Refund: <span className="font-bold">{money.format(done.total)}</span> ·{' '}
            {done.method === 'credit' ? 'Customer ના balance માંથી ઘટાડ્યા' : 'Cash refund'}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={reset}>+ બીજું return</button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Bill શોધો અને પરત કરો</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>

      <form onSubmit={(e) => void search(e)} className="mt-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label htmlFor="ret-search" className="sr-only">Bill no</label>
        <input id="ret-search" className="field sm:max-w-sm" placeholder="Bill no (કે તેનો ભાગ)" value={term}
          onChange={(e) => setTerm(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={searching || term.trim() === ''}>
          {searching ? 'શોધી રહ્યા છીએ…' : 'શોધો'}
        </button>
      </form>

      {problem && !bill && <div className="mt-4"><ProblemBox p={problem} /></div>}

      {hits && hits.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
          આ branch માં આ નંબરનું કોઈ bill મળ્યું નથી.
        </p>
      )}

      {hits && hits.length > 1 && !bill && (
        <ul className="mt-4 space-y-2">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => void open(h.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:border-slate-800 dark:bg-slate-900">
                <span className="min-w-0">
                  <span className="block font-semibold">{h.billNo}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400">
                    {h.billDate ? formatDate(h.billDate) : ''} · {h.customerName || 'Walk-in'}
                  </span>
                </span>
                <span className="shrink-0 font-semibold">{money.format(h.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loadingBill && <p role="status" className="py-8 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}

      {bill && (
        <div className="mt-6 space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-bold">{bill.billNo}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {bill.customerName || 'Walk-in'} · કુલ {money.format(bill.total)}
              {bill.hadCredit && ' · ઉધાર સાથે'}
            </p>
          </section>

          <ul className="space-y-3">
            {lines.map(({ it, left, error, refund }) => (
              <li key={it.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="break-words font-semibold">{it.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Batch {it.batchNo || '—'} · વેચ્યું {it.qty} · પરત થયું {it.returned} · બાકી {left}
                </p>
                <div className="mt-2 grid grid-cols-[7rem_1fr] items-end gap-3">
                  <div>
                    <label htmlFor={`rq-${it.id}`} className="mb-1 block text-sm font-medium">પરત qty</label>
                    <input id={`rq-${it.id}`} inputMode="numeric" className="field" value={qty[it.id] ?? ''}
                      placeholder="0" disabled={left === 0 || saving} aria-invalid={error !== null}
                      onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })} />
                  </div>
                  <p className="pb-2 text-sm">
                    {left === 0 ? 'પૂરું પરત થઈ ગયું' : <>Refund: <span className="font-bold">{money.format(refund)}</span></>}
                  </p>
                </div>
                {error && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>}
              </li>
            ))}
          </ul>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold">Refund પ્રકાર</h2>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Refund પ્રકાર">
              {([
                { v: 'cash', label: 'Cash refund' },
                { v: 'credit', label: 'Balance માંથી ઘટાડો' },
              ] as const).map((o) => (
                <button key={o.v} type="button" disabled={saving || (o.v === 'credit' && !canCredit)}
                  aria-pressed={method === o.v} onClick={() => setMethod(o.v)}
                  className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 ${
                    method === o.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {method === 'credit'
                ? `Customer ના બાકી balance (${money.format(balance ?? 0)}) માંથી refund ઘટશે. કોઈ રોકડ આપવાની નથી.`
                : 'Customer ને રકમ પાછી આપો. તેનું balance બદલાશે નહીં.'}
              {!canCredit && ' (Balance માંથી ઘટાડવા customer અને બાકી balance જોઈએ.)'}
            </p>

            <div>
              <label htmlFor="ret-reason" className="mb-1 block text-sm font-medium">કારણ (વૈકલ્પિક)</label>
              <input id="ret-reason" className="field" value={reason} disabled={saving} onChange={(e) => setReason(e.target.value)} />
            </div>

            <p className="text-xl font-bold">કુલ refund: {money.format(total)}</p>

            {problem && <ProblemBox p={problem} />}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={saving || !anyQty} onClick={() => void save()}>
                {saving ? 'સેવ થઈ રહ્યું છે…' : 'પરત સેવ કરો'}
              </button>
              <button type="button" className="btn-ghost" disabled={saving} onClick={reset}>રદ કરો</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
