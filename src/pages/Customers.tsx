import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, Notice, SearchField, Tabs } from '../components/ui'
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
      <PageHeader
        icon="users"
        title="Customers"
        subtitle={branchName}
        actions={
          canAdd && state === 'ready' && (
          <button type="button" className="btn-primary gap-2" onClick={() => { setNotice(null); setView({ kind: 'new' }) }}>
            <Icon name="plus" /> નવો customer
          </button>
        )
        }
      />

      {notice && <Notice kind="success" className="mt-4" onClose={() => setNotice(null)}>{notice}</Notice>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* Left: list (hidden on mobile while a detail or form is open) */}
        <div className={rightHasContent ? 'hidden lg:block' : ''}>
          <SearchField id="cust-search" label="નામ અથવા phone શોધો" placeholder="નામ અથવા phone શોધો" value={query} onChange={setQuery} />

          <Tabs<'all' | 'due'>
            className="mt-3"
            label="Balance ફિલ્ટર"
            value={onlyDue ? 'due' : 'all'}
            onChange={(v) => setOnlyDue(v === 'due')}
            items={[
              { value: 'all', label: 'બધા', icon: 'users' },
              { value: 'due', label: 'બાકી છે', icon: 'wallet' },
            ]}
          />

          <div className="mt-4">
            {state === 'loading' && <Skeleton />}

            {state === 'error' && (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p className="font-semibold">Customers લોડ થઈ શક્યા નથી.</p>
                <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
                <button type="button" className="btn-primary gap-2 mt-3" onClick={reload}><Icon name="refresh" />ફરી પ્રયાસ</button>
              </div>
            )}

            {state === 'ready' && customers.length === 0 && (
              <EmptyState icon="users" title="હજી કોઈ customer નથી." />
            )}

            {state === 'ready' && customers.length > 0 && visible.length === 0 && (
              <EmptyState icon="search" title="શોધ મુજબ કંઈ મળ્યું નથી." action={<button type="button" className="btn-ghost gap-2" onClick={() => { setQuery(''); setOnlyDue(false) }}><Icon name="close" />ફિલ્ટર સાફ કરો</button>} />
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
            <EmptyState icon="users" title="વિગત જોવા માટે customer પસંદ કરો." />
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
