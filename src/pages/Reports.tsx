import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { money } from '../features/billing/cart'
import { formatDate } from '../features/medicines/stock'
import { todayISO } from '../features/purchases/form'
import {
  fetchDailySales,
  fetchGstSummary,
  type DailyRow,
  type GstSummary,
} from '../features/reports/api'

const CAN_VIEW = ['owner', 'branch_manager', 'accountant']

type Tab = 'daily' | 'gst'
type Load = 'loading' | 'ready' | 'error'

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presets(): { label: string; from: string; to: string }[] {
  const n = new Date()
  return [
    { label: 'આજે', from: iso(n), to: iso(n) },
    { label: 'આ મહિનો', from: iso(new Date(n.getFullYear(), n.getMonth(), 1)), to: iso(n) },
    {
      label: 'ગયો મહિનો',
      from: iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
      to: iso(new Date(n.getFullYear(), n.getMonth(), 0)),
    },
  ]
}

function sum(rows: DailyRow[], k: keyof Omit<DailyRow, 'date'>): number {
  return Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100
}

function Problem({ message, technical, onRetry }: { message: string; technical: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{message}</p>
      <p className="mt-1 break-words font-mono text-xs">Technical: {technical}</p>
      <button type="button" className="btn-primary mt-3" onClick={onRetry}>ફરી પ્રયાસ</button>
    </div>
  )
}

function DailyView({ rows }: { rows: DailyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
        આ તારીખોમાં કોઈ વેચાણ નથી.
      </p>
    )
  }
  const totals = {
    bills: sum(rows, 'bills'), sales: sum(rows, 'sales'), returns: sum(rows, 'returns'), net: sum(rows, 'net'),
    cash: sum(rows, 'cash'), upi: sum(rows, 'upi'), card: sum(rows, 'card'), credit: sum(rows, 'credit'),
  }
  return (
    <>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="કુલ">
        {[
          { l: 'કુલ વેચાણ', v: money.format(totals.sales) },
          { l: 'Return', v: money.format(totals.returns) },
          { l: 'Net વેચાણ', v: money.format(totals.net) },
          { l: 'Bills', v: String(totals.bills) },
        ].map((c) => (
          <div key={c.l} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-400">{c.l}</p>
            <p className="text-lg font-bold">{c.v}</p>
          </div>
        ))}
      </section>

      {/* Phone / tablet: cards */}
      <ul className="mt-4 space-y-3 lg:hidden">
        {rows.map((r) => (
          <li key={r.date} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{formatDate(r.date)}</p>
              <p className="text-lg font-bold">{money.format(r.net)}</p>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div><dt className="text-slate-600 dark:text-slate-400">Bills</dt><dd>{r.bills}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">વેચાણ</dt><dd>{money.format(r.sales)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Return</dt><dd>{money.format(r.returns)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Cash</dt><dd>{money.format(r.cash)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">UPI</dt><dd>{money.format(r.upi)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Card</dt><dd>{money.format(r.card)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Credit</dt><dd>{money.format(r.credit)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-3 py-3">તારીખ</th>
              <th scope="col" className="px-3 py-3 text-right">Bills</th>
              <th scope="col" className="px-3 py-3 text-right">વેચાણ</th>
              <th scope="col" className="px-3 py-3 text-right">Return</th>
              <th scope="col" className="px-3 py-3 text-right">Net</th>
              <th scope="col" className="px-3 py-3 text-right">Cash</th>
              <th scope="col" className="px-3 py-3 text-right">UPI</th>
              <th scope="col" className="px-3 py-3 text-right">Card</th>
              <th scope="col" className="px-3 py-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.date}>
                <td className="px-3 py-3 font-medium">{formatDate(r.date)}</td>
                <td className="px-3 py-3 text-right">{r.bills}</td>
                <td className="px-3 py-3 text-right">{money.format(r.sales)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.returns)}</td>
                <td className="px-3 py-3 text-right font-semibold">{money.format(r.net)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.cash)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.upi)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.card)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold dark:bg-slate-800">
            <tr>
              <td className="px-3 py-3">કુલ</td>
              <td className="px-3 py-3 text-right">{totals.bills}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.sales)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.returns)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.net)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.cash)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.upi)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.card)}</td>
              <td className="px-3 py-3 text-right">{money.format(totals.credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Cash/UPI/Card/Credit એ bill બનાવતી વખતે લીધેલી ચૂકવણી છે (return બાદ કર્યા વગર). રદ થયેલા bill ગણાતા નથી.
      </p>
    </>
  )
}

function GstView({ data }: { data: GstSummary }) {
  if (data.net.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
        આ તારીખોમાં કોઈ વેચાણ નથી.
      </p>
    )
  }
  const net = data.net.reduce(
    (a, r) => ({ taxable: a.taxable + r.taxable, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst, total: a.total + r.total }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  )
  return (
    <>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Net = વેચાણ − Return, GST દર પ્રમાણે. Return નો GST અહીં બાદ થાય છે.
      </p>

      <ul className="space-y-3 md:hidden">
        {data.net.map((r) => (
          <li key={r.rate} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold">GST {r.rate}%</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div><dt className="text-slate-600 dark:text-slate-400">Taxable</dt><dd>{money.format(r.taxable)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">કુલ</dt><dd className="font-semibold">{money.format(r.total)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">CGST</dt><dd>{money.format(r.cgst)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">SGST</dt><dd>{money.format(r.sgst)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">IGST</dt><dd>{money.format(r.igst)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-3 py-3">GST દર</th>
              <th scope="col" className="px-3 py-3 text-right">Taxable</th>
              <th scope="col" className="px-3 py-3 text-right">CGST</th>
              <th scope="col" className="px-3 py-3 text-right">SGST</th>
              <th scope="col" className="px-3 py-3 text-right">IGST</th>
              <th scope="col" className="px-3 py-3 text-right">કુલ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.net.map((r) => (
              <tr key={r.rate}>
                <td className="px-3 py-3 font-medium">{r.rate}%</td>
                <td className="px-3 py-3 text-right">{money.format(r.taxable)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.cgst)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.sgst)}</td>
                <td className="px-3 py-3 text-right">{money.format(r.igst)}</td>
                <td className="px-3 py-3 text-right font-semibold">{money.format(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-bold dark:bg-slate-800">
            <tr>
              <td className="px-3 py-3">કુલ</td>
              <td className="px-3 py-3 text-right">{money.format(net.taxable)}</td>
              <td className="px-3 py-3 text-right">{money.format(net.cgst)}</td>
              <td className="px-3 py-3 text-right">{money.format(net.sgst)}</td>
              <td className="px-3 py-3 text-right">{money.format(net.igst)}</td>
              <td className="px-3 py-3 text-right">{money.format(net.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        વેચાણ: Taxable {money.format(data.sales.taxable)} + GST {money.format(data.sales.cgst + data.sales.sgst + data.sales.igst)} ·
        Return: Taxable {money.format(data.returns.taxable)} + GST {money.format(data.returns.cgst + data.returns.sgst + data.returns.igst)}
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        આ સારાંશ રેકોર્ડ માટે છે. GST return ભરતા પહેલાં CA સાથે ચકાસી લો.
      </p>
    </>
  )
}

function ReportsInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const first = presets()[1]
  const [from, setFrom] = useState(first.from)
  const [to, setTo] = useState(first.to)
  const [tab, setTab] = useState<Tab>('daily')
  const [state, setState] = useState<Load>('loading')
  const [problem, setProblem] = useState<{ message: string; technical: string } | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [gst, setGst] = useState<GstSummary | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const rangeError = from === '' || to === '' ? 'બંને તારીખ પસંદ કરો.' : from > to ? '"થી" તારીખ "સુધી" પછી ન હોઈ શકે.' : null

  useEffect(() => {
    if (rangeError) return
    let cancelled = false
    setState('loading')
    setProblem(null)
    Promise.all([fetchDailySales(branchId, from, to), fetchGstSummary(branchId, from, to)]).then(([d, g]) => {
      if (cancelled) return
      if (!d.ok) {
        setProblem({ message: d.message, technical: d.technical })
        setState('error')
        return
      }
      if (!g.ok) {
        setProblem({ message: g.message, technical: g.technical })
        setState('error')
        return
      }
      setDaily(d.data)
      setGst(g.data)
      setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [branchId, from, to, rangeError, reloadKey])

  const quick = useMemo(() => presets(), [])
  const tabs: { v: Tab; label: string }[] = [
    { v: 'daily', label: 'Daily sales' },
    { v: 'gst', label: 'GST summary' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="min-w-0">
          <label htmlFor="r-from" className="mb-1 block text-sm font-medium">થી</label>
          <input id="r-from" type="date" max={todayISO()} className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="r-to" className="mb-1 block text-sm font-medium">સુધી</label>
          <input id="r-to" type="date" max={todayISO()} className="field" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="ઝડપી તારીખ">
        {quick.map((p) => (
          <button key={p.label} type="button" className="btn-ghost" onClick={() => { setFrom(p.from); setTo(p.to) }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="Report પ્રકાર">
        {tabs.map((t) => (
          <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => setTab(t.v)}
            className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {rangeError && <p role="alert" className="text-red-700 dark:text-red-300">{rangeError}</p>}
        {!rangeError && state === 'loading' && (
          <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>
        )}
        {!rangeError && state === 'error' && problem && (
          <Problem message={problem.message} technical={problem.technical} onRetry={() => setReloadKey((k) => k + 1)} />
        )}
        {!rangeError && state === 'ready' && tab === 'daily' && <DailyView rows={daily} />}
        {!rangeError && state === 'ready' && tab === 'gst' && gst && <GstView data={gst} />}
      </div>
    </div>
  )
}

export function Reports() {
  const { selected } = useBranch()
  const { profile } = useAuth()
  if (!selected) return null
  if (!profile || !CAN_VIEW.includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">તમારી role થી reports જોઈ શકાતા નથી.</p>
      </div>
    )
  }
  return <ReportsInner branchId={selected.id} branchName={selected.name} />
}
