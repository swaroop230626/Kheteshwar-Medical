import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Skeleton } from '../features/customers/BalanceBadge'
import { CustomerDetail } from '../features/customers/CustomerDetail'
import { CustomerForm } from '../features/customers/CustomerForm'
import { CustomerList } from '../features/customers/CustomerList'
import { useCustomers } from '../features/customers/hooks'

const CAN_ADD = ['owner', 'branch_manager', 'billing_staff']
const CAN_PAY = ['owner', 'branch_manager', 'billing_staff', 'accountant']

type View = { kind: 'none' } | { kind: 'detail'; id: string } | { kind: 'new' }

function CustomersInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { profile } = useAuth()
  const { customers, state, reload } = useCustomers(branchId)
  const [view, setView] = useState<View>({ kind: 'none' })
  const [query, setQuery] = useState('')
  const [onlyDue, setOnlyDue] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const role = profile?.role ?? ''
  const canAdd = CAN_ADD.includes(role)
  const canPay = CAN_PAY.includes(role)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customers.filter((c) => {
      if (onlyDue && c.balance <= 0) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    })
  }, [customers, query, onlyDue])

  const selected = view.kind === 'detail' ? customers.find((c) => c.id === view.id) : undefined
  const rightHasContent = view.kind !== 'none'

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>
        </div>
        {canAdd && state === 'ready' && (
          <button type="button" className="btn-primary" onClick={() => { setNotice(null); setView({ kind: 'new' }) }}>
            + નવો customer
          </button>
        )}
      </div>

      {notice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <p>{notice}</p>
          <button type="button" className="btn-ghost min-w-11 border-0 px-0" aria-label="સંદેશ બંધ કરો" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Left: list (hidden on mobile while a detail or form is open) */}
        <div className={rightHasContent ? 'hidden lg:block' : ''}>
          <label htmlFor="cust-search" className="sr-only">નામ અથવા phone શોધો</label>
          <input id="cust-search" type="search" className="field" placeholder="નામ અથવા phone શોધો"
            value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Balance ફિલ્ટર">
            {[
              { v: false, label: 'બધા' },
              { v: true, label: 'બાકી છે' },
            ].map((o) => (
              <button key={o.label} type="button" aria-pressed={onlyDue === o.v} onClick={() => setOnlyDue(o.v)}
                className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  onlyDue === o.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
                }`}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {state === 'loading' && <Skeleton />}

            {state === 'error' && (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p className="font-semibold">Customers લોડ થઈ શક્યા નથી.</p>
                <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
                <button type="button" className="btn-primary mt-3" onClick={reload}>ફરી પ્રયાસ</button>
              </div>
            )}

            {state === 'ready' && customers.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
                હજી કોઈ customer નથી.
              </p>
            )}

            {state === 'ready' && customers.length > 0 && visible.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <p>શોધ મુજબ કંઈ મળ્યું નથી.</p>
                <button type="button" className="btn-ghost mt-3" onClick={() => { setQuery(''); setOnlyDue(false) }}>ફિલ્ટર સાફ કરો</button>
              </div>
            )}

            {state === 'ready' && visible.length > 0 && (
              <CustomerList
                customers={visible}
                selectedId={view.kind === 'detail' ? view.id : null}
                onSelect={(id) => { setNotice(null); setView({ kind: 'detail', id }) }}
              />
            )}
          </div>
        </div>

        {/* Right: detail / form (on mobile only shown when opened) */}
        <div className={rightHasContent ? '' : 'hidden lg:block'}>
          {view.kind === 'new' && (
            <CustomerForm
              branchId={branchId}
              onCancel={() => setView({ kind: 'none' })}
              onSaved={() => {
                setNotice('Customer ઉમેરાયો.')
                setView({ kind: 'none' })
                reload()
              }}
            />
          )}

          {view.kind === 'detail' && selected && (
            <CustomerDetail key={selected.id} customer={selected} canPay={canPay} onChanged={reload} onClose={() => setView({ kind: 'none' })} />
          )}

          {view.kind === 'detail' && !selected && state === 'ready' && (
            <p className="text-slate-600 dark:text-slate-400">Customer મળ્યો નથી.</p>
          )}

          {view.kind === 'none' && (
            <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
              વિગત જોવા માટે customer પસંદ કરો.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function Customers() {
  const { selected } = useBranch()
  if (!selected) return null
  return <CustomersInner branchId={selected.id} branchName={selected.name} />
}
