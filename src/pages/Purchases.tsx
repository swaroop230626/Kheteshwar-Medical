import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, LoadingBlock, Notice, SearchField } from '../components/ui'
import { PurchaseForm } from '../features/purchases/PurchaseForm'
import { PurchaseList } from '../features/purchases/PurchaseList'
import { usePurchases } from '../features/purchases/usePurchases'

const CAN_CREATE = ['owner', 'branch_manager', 'store_keeper']

function PurchasesInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { profile } = useAuth()
  const { grns, medicines, state, reload } = usePurchases(branchId)
  const [view, setView] = useState<'list' | 'new'>('list')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const names = useMemo(() => new Map(medicines.map((m) => [m.id, m.name])), [medicines])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return grns
    return grns.filter((g) => g.supplier.toLowerCase().includes(q) || g.invoiceNo.toLowerCase().includes(q))
  }, [grns, query])

  const canCreate = profile ? CAN_CREATE.includes(profile.role) : false

  if (view === 'new') {
    return (
      <PurchaseForm
        branchId={branchId}
        medicines={medicines}
        onCancel={() => setView('list')}
        onRefreshMedicines={reload}
        onSaved={(message) => {
          setNotice(message)
          setView('list')
          reload()
        }}
      />
    )
  }

  return (
    <div>
      <PageHeader
        icon="truck"
        title="Purchases"
        subtitle={branchName}
        actions={
          canCreate && state === 'ready' && (
          <button type="button" className="btn-primary gap-2" onClick={() => { setNotice(null); setView('new') }}>
            <Icon name="plus" /> નવી Purchase
          </button>
        )
        }
      />

      {notice && <Notice kind="success" className="mt-4" onClose={() => setNotice(null)}>{notice}</Notice>}

      <div className="mt-4">
        <SearchField id="pur-search" label="Supplier અથવા invoice no શોધો" placeholder="Supplier અથવા invoice no શોધો" value={query} onChange={setQuery} />
      </div>

      <div className="mt-4">
        {state === 'loading' && (
          <LoadingBlock />
        )}

        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">Purchases લોડ થઈ શક્યા નથી.</p>
            <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
            <button type="button" className="btn-primary gap-2 mt-3" onClick={reload}><Icon name="refresh" />ફરી પ્રયાસ</button>
          </div>
        )}

        {state === 'ready' && grns.length === 0 && (
          <EmptyState icon="truck" title="આ શાખામાં હજી કોઈ purchase નથી." />
        )}

        {state === 'ready' && grns.length > 0 && visible.length === 0 && (
          <EmptyState icon="search" title="શોધ મુજબ કંઈ મળ્યું નથી." action={<button type="button" className="btn-ghost gap-2" onClick={() => setQuery('')}><Icon name="close" />શોધ સાફ કરો</button>} />
        )}

        {state === 'ready' && visible.length > 0 && <PurchaseList grns={visible} names={names} />}
      </div>
    </div>
  )
}

export function Purchases() {
  const { selected } = useBranch()
  if (!selected) return null
  return <PurchasesInner branchId={selected.id} branchName={selected.name} />
}
