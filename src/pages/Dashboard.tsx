import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useBranch } from '../branch/BranchContext'
import { formatDate } from '../features/medicines/stock'
import {
  useDashboard,
  type ExpiryItem,
  type LowItem,
  type Section,
} from '../features/dashboard/useDashboard'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const MAX_ROWS = 10

function CardShell({
  title,
  hint,
  accent,
  section,
  children,
}: {
  title: string
  hint: string
  accent: string
  section: Section<unknown>
  children: ReactNode
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-l-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${accent}`}
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">{hint}</p>
      {section.state === 'loading' && (
        <div role="status" aria-label="લોડ થઈ રહ્યું છે" className="mt-4 space-y-2">
          <div className="h-9 w-2/3 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
        </div>
      )}
      {section.state === 'error' && (
        <div role="alert" className="mt-4 text-sm text-red-800 dark:text-red-300">
          <p className="font-semibold">આ આંકડો લોડ થઈ શક્યો નથી.</p>
          <p className="mt-1 break-words font-mono text-xs">Technical: {section.technical}</p>
        </div>
      )}
      {section.state === 'ready' && children}
    </section>
  )
}

function Big({ children }: { children: ReactNode }) {
  return <p className="mt-4 break-words text-3xl font-bold">{children}</p>
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</p>
}

function AlertPanel({
  title,
  section,
  children,
}: {
  title: string
  section: Section<unknown>
  children: ReactNode
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Link
          to="/medicines"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:text-brand-bright"
        >
          બધું જુઓ
        </Link>
      </div>
      {section.state === 'loading' && (
        <div role="status" aria-label="લોડ થઈ રહ્યું છે" className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
          ))}
        </div>
      )}
      {section.state === 'error' && (
        <p role="alert" className="mt-3 text-sm text-red-800 dark:text-red-300">
          યાદી લોડ થઈ શકી નથી. ઇન્ટરનેટ તપાસી Refresh કરો.
        </p>
      )}
      {section.state === 'ready' && children}
    </section>
  )
}

function NoAlert() {
  return (
    <p role="status" className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
      કોઈ alert નથી
    </p>
  )
}

function ExpiryRows({ items, tone }: { items: ExpiryItem[]; tone: 'red' | 'amber' }) {
  const color =
    tone === 'red'
      ? 'text-red-700 dark:text-red-300'
      : 'text-orange-700 dark:text-orange-300'
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.slice(0, MAX_ROWS).map((i) => (
        <li key={i.batchId} className="flex items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="break-words font-medium">{i.name}</p>
            <p className="text-slate-600 dark:text-slate-400">
              Batch {i.batchNo} · બાકી stock {i.stock}
            </p>
          </div>
          <p className={`shrink-0 text-right font-semibold ${color}`}>
            {formatDate(i.expiryDate)}
            <span className="block text-xs font-medium">
              {i.daysLeft < 0 ? `${-i.daysLeft} દિવસ પહેલાં` : i.daysLeft === 0 ? 'આજે' : `${i.daysLeft} દિવસ બાકી`}
            </span>
          </p>
        </li>
      ))}
    </ul>
  )
}

function LowRows({ items }: { items: LowItem[] }) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.slice(0, MAX_ROWS).map((i) => (
        <li key={i.medicineId} className="flex items-start justify-between gap-3 py-3 text-sm">
          <p className="min-w-0 break-words font-medium">{i.name}</p>
          <p className="shrink-0 text-right">
            <span className="font-semibold text-orange-700 dark:text-orange-300">બાકી {i.stock}</span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">Reorder level {i.reorderLevel}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

function more(total: number) {
  return total > MAX_ROWS ? (
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
      પહેલી {MAX_ROWS} દેખાય છે, કુલ {total}.
    </p>
  ) : null
}

function DashboardInner({ branchName, branchId }: { branchName: string; branchId: string }) {
  const { sales, stock, credit, loading, reload } = useDashboard(branchId)
  const redNow = stock.state === 'ready' && (stock.data.red > 0 || stock.data.expired.length > 0)

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ડેશબોર્ડ</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={reload} disabled={loading}>
          {loading ? 'લોડ થઈ રહ્યું છે…' : '↻ Refresh'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CardShell title="Today sales" hint="આજનું વેચાણ" accent="border-l-brand" section={sales}>
          {sales.state === 'ready' && (
            <>
              <Big>{money.format(sales.data.total)}</Big>
              <Sub>{sales.data.count} bills</Sub>
            </>
          )}
        </CardShell>

        <CardShell
          title="Expiring stock"
          hint="90 દિવસમાં એક્સપાયર થનાર batches"
          accent={redNow ? 'border-l-red-600' : 'border-l-amber-500'}
          section={stock}
        >
          {stock.state === 'ready' && (
            <>
              <Big>{stock.data.red + stock.data.yellow}</Big>
              <Sub>
                <span className="font-semibold text-red-700 dark:text-red-300">30 દિવસમાં: {stock.data.red}</span>
                {' · '}
                <span className="font-semibold text-orange-700 dark:text-orange-300">90 દિવસમાં: {stock.data.yellow}</span>
              </Sub>
              {stock.data.expired.length > 0 && (
                <Sub>
                  <span className="font-semibold text-red-700 dark:text-red-300">Expired (stock સાથે): {stock.data.expired.length}</span>
                </Sub>
              )}
            </>
          )}
        </CardShell>

        <CardShell title="Low stock" hint="ઓછો સ્ટોક (દવાઓ)" accent="border-l-orange-500" section={stock}>
          {stock.state === 'ready' && (
            <>
              <Big>{stock.data.low.length}</Big>
              <Sub>Reorder level થી ઓછા કે બરાબર</Sub>
            </>
          )}
        </CardShell>

        <CardShell title="Credit balance" hint="ઉધાર બાકી" accent="border-l-sky-500" section={credit}>
          {credit.state === 'ready' && (
            <>
              <Big>{money.format(credit.data.total)}</Big>
              <Sub>{credit.data.customersDue} customers ને બાકી</Sub>
            </>
          )}
        </CardShell>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AlertPanel title="30 દિવસમાં expire" section={stock}>
          {stock.state === 'ready' && (
            <>
              {stock.data.expired.length > 0 && (
                <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <h3 className="font-semibold text-red-900 dark:text-red-200">Expired ({stock.data.expired.length})</h3>
                  <ExpiryRows items={stock.data.expired} tone="red" />
                  {more(stock.data.expired.length)}
                </div>
              )}
              {stock.data.soon.length > 0 ? (
                <div className="mt-3">
                  <ExpiryRows items={stock.data.soon} tone="amber" />
                  {more(stock.data.soon.length)}
                </div>
              ) : (
                <NoAlert />
              )}
            </>
          )}
        </AlertPanel>

        <AlertPanel title="ઓછો stock" section={stock}>
          {stock.state === 'ready' &&
            (stock.data.low.length > 0 ? (
              <div className="mt-3">
                <LowRows items={stock.data.low} />
                {more(stock.data.low.length)}
              </div>
            ) : (
              <NoAlert />
            ))}
        </AlertPanel>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { selected } = useBranch()
  if (!selected) return null
  return <DashboardInner key={selected.id} branchId={selected.id} branchName={selected.name} />
}
