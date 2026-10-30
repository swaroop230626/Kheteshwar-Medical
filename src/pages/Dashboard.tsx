import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import {
  useDashboard,
  type ExpiryItem,
  type LowItem,
  type Section,
} from '../features/dashboard/useDashboard'
import { useExtras, type WeekDay } from '../features/dashboard/useExtras'
import type { DueRow } from '../features/dues/api'
import { formatDate } from '../features/medicines/stock'
import { ROLE_LABELS } from '../types'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
const MAX_ROWS = 5

// ---------- small building blocks ----------

const ICONS = {
  receipt: 'M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z M8 7h8 M8 11h8 M8 15h5',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8z M3 8l9 5 9-5 M12 13v8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  trend: 'M3 17l6-6 4 4 8-8 M14 7h7v7',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  wallet: 'M3 7a2 2 0 0 1 2-2h14v4 M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H5a2 2 0 0 1-2-2z M16 14h2',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l10-10a5 5 0 0 1 7 7l-10 10z M8.5 8.5l7 7',
  chart: 'M3 3v18h18 M7 14v4 M12 9v9 M17 5v13',
  truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7V8z M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const

type IconName = keyof typeof ICONS

function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

const TINTS = {
  brand: 'bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
} as const

type Tint = keyof typeof TINTS

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'

function Skeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div role="status" aria-label="લોડ થઈ રહ્યું છે" className="mt-3 space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`h-6 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-800 ${i === 0 ? 'w-2/3' : 'w-1/2'}`} />
      ))}
    </div>
  )
}

function Failed({ technical, hint }: { technical: string; hint: string }) {
  return (
    <div role="alert" className="mt-3 text-sm text-red-800 dark:text-red-300">
      <p className="font-semibold">{hint}</p>
      <p className="mt-1 break-words font-mono text-xs">Technical: {technical}</p>
    </div>
  )
}

function Kpi({
  title,
  hint,
  icon,
  tint,
  section,
  children,
}: {
  title: string
  hint: string
  icon: IconName
  tint: Tint
  section: Section<unknown>
  children: ReactNode
}) {
  return (
    <section className={`${CARD} min-w-0 p-4`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TINTS[tint]}`}>
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{title}</h2>
          <p className="truncate text-sm text-slate-600 dark:text-slate-400">{hint}</p>
        </div>
      </div>
      {section.state === 'loading' && <Skeleton />}
      {section.state === 'error' && <Failed technical={section.technical} hint="આ આંકડો લોડ થઈ શક્યો નથી." />}
      {section.state === 'ready' && children}
    </section>
  )
}

const Big = ({ children }: { children: ReactNode }) => <p className="mt-3 break-words text-3xl font-bold tracking-tight">{children}</p>
const Sub = ({ children }: { children: ReactNode }) => <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{children}</p>

function Panel({
  title,
  count,
  to,
  section,
  children,
}: {
  title: string
  count?: number
  to?: string
  section: Section<unknown>
  children: ReactNode
}) {
  return (
    <section className={`${CARD} min-w-0 p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          {title}
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{count}</span>
          )}
        </h2>
        {to && (
          <Link to={to} className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-brand-strong underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:text-brand-bright">
            બધું જુઓ
          </Link>
        )}
      </div>
      {section.state === 'loading' && <Skeleton lines={3} />}
      {section.state === 'error' && <Failed technical={section.technical} hint="યાદી લોડ થઈ શકી નથી." />}
      {section.state === 'ready' && children}
    </section>
  )
}

function AllClear({ text = 'કોઈ alert નથી' }: { text?: string }) {
  return (
    <p role="status" className="mt-3 rounded-xl border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
      ✓ {text}
    </p>
  )
}

function MoreNote({ total }: { total: number }) {
  return total > MAX_ROWS ? (
    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">પહેલી {MAX_ROWS} દેખાય છે, કુલ {total}.</p>
  ) : null
}

// ---------- panels' rows ----------

function ExpiryRows({ items, tone }: { items: ExpiryItem[]; tone: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.slice(0, MAX_ROWS).map((i) => (
        <li key={i.batchId} className="flex items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="break-words font-medium">{i.name}</p>
            <p className="text-slate-600 dark:text-slate-400">Batch {i.batchNo} · stock {i.stock}</p>
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
            <span className="block text-xs text-slate-600 dark:text-slate-400">Reorder {i.reorderLevel}</span>
          </p>
        </li>
      ))}
    </ul>
  )
}

function DueRows({ items }: { items: DueRow[] }) {
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {items.slice(0, MAX_ROWS).map((d) => (
        <li key={d.customerId} className="flex items-start justify-between gap-3 py-3 text-sm">
          <div className="min-w-0">
            <p className="break-words font-medium">{d.name}</p>
            <p className="text-slate-600 dark:text-slate-400">{d.days > 0 ? `${d.days} દિવસથી બાકી` : 'આજનું ઉધાર'}</p>
          </div>
          <p className={`shrink-0 text-right font-semibold ${d.days >= 30 ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {money.format(d.balance)}
          </p>
        </li>
      ))}
    </ul>
  )
}

// ---------- last 7 days chart (plain CSS bars, no library) ----------

function compact(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}

function dayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('gu-IN', { weekday: 'short' })
}

function WeekChart({ days }: { days: WeekDay[] }) {
  const max = Math.max(...days.map((d) => d.sales), 1)
  const total = Math.round(days.reduce((s, d) => s + d.sales * 100, 0)) / 100
  const empty = days.every((d) => d.sales === 0)
  return (
    <>
      <div className="mt-4 grid grid-cols-7 gap-2" role="img" aria-label={`છેલ્લા 7 દિવસનું વેચાણ, કુલ ${money.format(total)}`}>
        {days.map((d, i) => {
          const last = i === days.length - 1
          const pct = d.sales > 0 ? Math.max((d.sales / max) * 100, 4) : 2
          return (
            <div key={d.date} className="flex min-w-0 flex-col items-center gap-1">
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{d.sales > 0 ? compact(d.sales) : ''}</span>
              <div className="flex h-32 w-full items-end">
                <div
                  className={`w-full rounded-t-lg ${last ? 'bg-brand' : 'bg-brand/45 dark:bg-brand/60'} ${d.sales === 0 ? 'opacity-30' : ''}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className={`text-xs ${last ? 'font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{last ? 'આજે' : dayLabel(d.date)}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        {empty ? 'આ 7 દિવસમાં કોઈ વેચાણ નથી.' : <>7 દિવસનું કુલ: <span className="font-bold text-slate-900 dark:text-slate-100">{money.format(total)}</span></>}
      </p>
      <ul className="sr-only">
        {days.map((d) => (
          <li key={d.date}>{formatDate(d.date)}: {money.format(d.sales)}, {d.bills} bills</li>
        ))}
      </ul>
    </>
  )
}

function changeText(week: Section<WeekDay[]>, today: number): ReactNode {
  if (week.state !== 'ready') return null
  const yesterday = week.data[week.data.length - 2]?.sales ?? 0
  if (yesterday <= 0) return <Sub>ગઈકાલે વેચાણ નહોતું</Sub>
  const pct = Math.round(((today - yesterday) / yesterday) * 100)
  return (
    <Sub>
      <span className={`font-semibold ${pct >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-300'}`}>
        {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}%
      </span>{' '}
      ગઈકાલ કરતાં
    </Sub>
  )
}

// ---------- quick actions ----------

const ACTIONS: { to: string; label: string; sub: string; icon: IconName; tint: Tint; roles?: string[] }[] = [
  { to: '/billing', label: 'નવું Bill', sub: 'વેચાણ કરો', icon: 'receipt', tint: 'brand', roles: ['owner', 'branch_manager', 'billing_staff'] },
  { to: '/purchases', label: 'Purchase', sub: 'સ્ટોક ઉમેરો', icon: 'truck', tint: 'sky', roles: ['owner', 'branch_manager', 'store_keeper'] },
  { to: '/dues', label: 'બાકી યાદી', sub: 'WhatsApp યાદ', icon: 'wallet', tint: 'orange', roles: ['owner', 'branch_manager', 'billing_staff', 'accountant'] },
  { to: '/medicines', label: 'Medicines', sub: 'સ્ટોક જુઓ', icon: 'pill', tint: 'amber' },
  { to: '/customers', label: 'Customers', sub: 'ગ્રાહકો', icon: 'users', tint: 'sky' },
  { to: '/reports', label: 'Reports', sub: 'વેચાણ અને GST', icon: 'chart', tint: 'brand', roles: ['owner', 'branch_manager', 'accountant'] },
]

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'સુપ્રભાત' : h < 17 ? 'નમસ્કાર' : 'શુભ સાંજ'
}

function today(): string {
  try {
    return new Date().toLocaleDateString('gu-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

// ---------- page ----------

function DashboardInner({ branchName, branchId }: { branchName: string; branchId: string }) {
  const { profile } = useAuth()
  const role = profile?.role ?? ''
  const canDues = ['owner', 'branch_manager', 'billing_staff', 'accountant'].includes(role)
  const base = useDashboard(branchId)
  const { sales, stock, credit } = base
  const extras = useExtras(branchId, canDues)
  const loading = base.loading || extras.week.state === 'loading'

  const redNow = stock.state === 'ready' && (stock.data.red > 0 || stock.data.expired.length > 0)
  const actions = ACTIONS.filter((a) => !a.roles || a.roles.includes(role))

  function refresh() {
    base.reload()
    extras.reload()
  }

  return (
    <div className="space-y-6">
      {/* Top banner */}
      <section className="rounded-2xl bg-gradient-to-br from-brand-strong to-brand p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-white/85">{today()}</p>
            <h1 className="mt-1 text-2xl font-bold">{greeting()}</h1>
            <p className="mt-1 text-white/90">
              {branchName}
              {profile && ` · ${ROLE_LABELS[profile.role]}`}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white/15 px-4 font-medium text-white hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          >
            {loading ? 'લોડ થઈ રહ્યું છે…' : '↻ Refresh'}
          </button>
        </div>
      </section>

      {/* Quick actions */}
      <nav aria-label="ઝડપી કામ" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`${CARD} flex min-h-16 items-center gap-3 p-3 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TINTS[a.tint]}`}>
              <Icon name={a.icon} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight">{a.label}</span>
              <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{a.sub}</span>
            </span>
          </Link>
        ))}
      </nav>

      {/* Numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Today sales" hint="આજનું વેચાણ" icon="trend" tint="brand" section={sales}>
          {sales.state === 'ready' && (
            <>
              <Big>{money.format(sales.data.total)}</Big>
              <Sub>{sales.data.count} bills</Sub>
              {changeText(extras.week, sales.data.total)}
            </>
          )}
        </Kpi>

        <Kpi title="Expiring stock" hint="90 દિવસમાં expire" icon="clock" tint={redNow ? 'red' : 'amber'} section={stock}>
          {stock.state === 'ready' && (
            <>
              <Big>{stock.data.red + stock.data.yellow}</Big>
              <Sub>
                <span className="font-semibold text-red-700 dark:text-red-300">30 દિવસમાં: {stock.data.red}</span>
                {' · '}
                <span className="font-semibold text-orange-700 dark:text-orange-300">90 દિવસમાં: {stock.data.yellow}</span>
              </Sub>
              {stock.data.expired.length > 0 && (
                <Sub><span className="font-semibold text-red-700 dark:text-red-300">Expired (stock સાથે): {stock.data.expired.length}</span></Sub>
              )}
            </>
          )}
        </Kpi>

        <Kpi title="Low stock" hint="ઓછો સ્ટોક (દવાઓ)" icon="box" tint="orange" section={stock}>
          {stock.state === 'ready' && (
            <>
              <Big>{stock.data.low.length}</Big>
              <Sub>Reorder level થી ઓછા કે બરાબર</Sub>
            </>
          )}
        </Kpi>

        <Kpi title="Credit balance" hint="ઉધાર બાકી" icon="wallet" tint="sky" section={credit}>
          {credit.state === 'ready' && (
            <>
              <Big>{money.format(credit.data.total)}</Big>
              <Sub>{credit.data.customersDue} customers ને બાકી</Sub>
              {credit.data.over30 !== null && (
                <Sub>
                  <span className={`font-semibold ${credit.data.over30 > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>30+ દિવસ: {credit.data.over30}</span>
                </Sub>
              )}
            </>
          )}
        </Kpi>
      </div>

      {/* Chart + dues */}
      <div className={`grid gap-4 ${canDues ? 'lg:grid-cols-3' : ''}`}>
        <section className={`${CARD} min-w-0 p-4 ${canDues ? 'lg:col-span-2' : ''}`}>
          <h2 className="font-semibold">છેલ્લા 7 દિવસનું વેચાણ</h2>
          {extras.week.state === 'loading' && <Skeleton lines={3} />}
          {extras.week.state === 'error' && (
            <Failed technical={extras.week.technical} hint="ચાર્ટ લોડ થયો નથી. supabase/reports.sql ચલાવ્યું છે?" />
          )}
          {extras.week.state === 'ready' && <WeekChart days={extras.week.data} />}
        </section>

        {canDues && (
          <Panel title="લાંબા સમયથી બાકી" to="/dues" section={extras.dues}>
            {extras.dues.state === 'ready' &&
              (extras.dues.data.length > 0 ? (
                <div className="mt-2">
                  <DueRows items={extras.dues.data} />
                  <MoreNote total={extras.dues.data.length} />
                </div>
              ) : (
                <AllClear text="કોઈનું બાકી નથી" />
              ))}
          </Panel>
        )}
      </div>

      {/* Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Expire થનાર" count={stock.state === 'ready' ? stock.data.expired.length + stock.data.soon.length : undefined} to="/medicines" section={stock}>
          {stock.state === 'ready' && (
            <>
              {stock.data.expired.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                  <h3 className="font-semibold text-red-900 dark:text-red-200">Expired ({stock.data.expired.length})</h3>
                  <ExpiryRows items={stock.data.expired} tone="red" />
                  <MoreNote total={stock.data.expired.length} />
                </div>
              )}
              {stock.data.soon.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">30 દિવસમાં</h3>
                  <ExpiryRows items={stock.data.soon} tone="amber" />
                  <MoreNote total={stock.data.soon.length} />
                </div>
              ) : (
                stock.data.expired.length === 0 && <AllClear />
              )}
            </>
          )}
        </Panel>

        <Panel title="ઓછો stock" count={stock.state === 'ready' ? stock.data.low.length : undefined} to="/medicines" section={stock}>
          {stock.state === 'ready' &&
            (stock.data.low.length > 0 ? (
              <div className="mt-2">
                <LowRows items={stock.data.low} />
                <MoreNote total={stock.data.low.length} />
              </div>
            ) : (
              <AllClear />
            ))}
        </Panel>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { selected } = useBranch()
  if (!selected) return null
  return <DashboardInner key={selected.id} branchId={selected.id} branchName={selected.name} />
}
