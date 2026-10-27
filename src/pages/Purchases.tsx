import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Purchases</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>
        </div>
        {canCreate && state === 'ready' && (
          <button type="button" className="btn-primary" onClick={() => { setNotice(null); setView('new') }}>
            + નવી Purchase
          </button>
        )}
      </div>

      {notice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <p>{notice}</p>
          <button type="button" className="btn-ghost min-w-11 border-0 px-0" aria-label="સંદેશ બંધ કરો" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="pur-search" className="sr-only">Supplier અથવા invoice no શોધો</label>
        <input id="pur-search" type="search" className="field" placeholder="Supplier અથવા invoice no શોધો"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="mt-4">
        {state === 'loading' && (
          <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>
        )}

        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">Purchases લોડ થઈ શક્યા નથી.</p>
            <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
            <button type="button" className="btn-primary mt-3" onClick={reload}>ફરી પ્રયાસ</button>
          </div>
        )}

        {state === 'ready' && grns.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
            આ શાખામાં હજી કોઈ purchase નથી.
          </p>
        )}

        {state === 'ready' && grns.length > 0 && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <p>શોધ મુજબ કંઈ મળ્યું નથી.</p>
            <button type="button" className="btn-ghost mt-3" onClick={() => setQuery('')}>શોધ સાફ કરો</button>
          </div>
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
