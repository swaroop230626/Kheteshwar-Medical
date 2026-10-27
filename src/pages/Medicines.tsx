import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { fetchMedicine, type MedicineDraft } from '../features/medicines/create'
import { MedicineForm } from '../features/medicines/MedicineForm'
import { STATUS_META, StatusBadges } from '../features/medicines/StatusBadge'
import { formatDate, type StatusKey, type StockRow } from '../features/medicines/stock'
import { useStockRows } from '../features/medicines/useStockRows'

type Filter = StatusKey | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'બધા સ્ટેટસ' },
  { value: 'expired', label: 'Expired' },
  { value: 'expiring', label: '90 દિવસમાં' },
  { value: 'low', label: 'Low stock' },
  { value: 'ok', label: 'OK' },
]

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function ExpiryText({ row }: { row: StockRow }) {
  if (!row.hasBatch) return <span>—</span>
  const note = row.daysLeft < 0 ? 'સમાપ્ત' : `${row.daysLeft} દિવસ બાકી`
  return (
    <>
      <span>{formatDate(row.expiryDate)}</span>
      <span className="block text-xs text-slate-600 dark:text-slate-400">{note}</span>
    </>
  )
}

function StockText({ row }: { row: StockRow }) {
  return (
    <>
      <span className="font-semibold">{row.stock}</span>
      {row.stock !== row.dbStock && (
        <span
          className="block text-xs text-amber-700 dark:text-amber-400"
          title="stock_batches માં નોંધાયેલા સ્ટોક સાથે મેળ ખાતો નથી"
        >
          ⚠ DB: {row.dbStock}
        </span>
      )}
    </>
  )
}

const CAN_ADD = ['owner', 'branch_manager', 'store_keeper']

function MedicinesInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { rows, state, reload } = useStockRows(branchId)
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'new'>(params.get('new') === '1' ? 'new' : 'list')
  const [notice, setNotice] = useState<string | null>(null)
  const canAdd = profile ? CAN_ADD.includes(profile.role) : false
  const [editing, setEditing] = useState<{ id: string; initial: MedicineDraft } | null>(null)
  const [editBusy, setEditBusy] = useState<string | null>(null)

  async function openEdit(medicineId: string) {
    if (editBusy) return
    setNotice(null)
    setEditBusy(medicineId)
    const initial = await fetchMedicine(medicineId)
    setEditBusy(null)
    if (initial) setEditing({ id: medicineId, initial })
    else setNotice('દવાની વિગતો લોડ થઈ શકી નથી. ફરી પ્રયાસ કરો.')
  }

  function closeForm() {
    setView('list')
    setParams({}, { replace: true })
  }

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && !r.statuses.includes(filter)) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q) || r.batchNo.toLowerCase().includes(q)
    })
  }, [rows, query, filter])

  if (editing && canAdd) {
    return (
      <MedicineForm
        medicineId={editing.id}
        initial={editing.initial}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setNotice('દવાની વિગતો સુધારાઈ.')
          setEditing(null)
          reload()
        }}
      />
    )
  }

  if (view === 'new') {
    if (!canAdd) {
      return (
        <div>
          <p className="text-slate-600 dark:text-slate-400">તમને નવી દવા ઉમેરવાની પરવાનગી નથી.</p>
          <button type="button" className="btn-ghost mt-3" onClick={closeForm}>પાછા</button>
        </div>
      )
    }
    return (
      <MedicineForm
        onCancel={closeForm}
        onSaved={() => {
          setNotice('નવી દવા ઉમેરાઈ. હવે Purchases માંથી તેનો batch અને stock ઉમેરો.')
          closeForm()
          reload()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Medicines</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>
        </div>
        {canAdd && (
          <button type="button" className="btn-primary" onClick={() => { setNotice(null); setView('new') }}>
            + નવી દવા
          </button>
        )}
      </div>

      {notice && (
        <div role="status" className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <p>{notice}</p>
          <button type="button" className="btn-ghost min-w-11 border-0 px-0" aria-label="સંદેશ બંધ કરો" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="med-search" className="sr-only">
            નામ અથવા batch શોધો
          </label>
          <input
            id="med-search"
            type="search"
            className="field"
            placeholder="નામ અથવા batch શોધો"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sm:w-52">
          <label htmlFor="med-filter" className="sr-only">
            સ્ટેટસ ફિલ્ટર
          </label>
          <select
            id="med-filter"
            className="field"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        {state === 'loading' && (
          <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">
            લોડ થઈ રહ્યું છે…
          </p>
        )}

        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">ડેટા લોડ થઈ શક્યો નથી.</p>
            <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
            <button type="button" className="btn-primary mt-3" onClick={reload}>
              ફરી પ્રયાસ
            </button>
          </div>
        )}

        {state === 'ready' && rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
            આ શાખામાં હજી કોઈ stock નથી.
          </p>
        )}

        {state === 'ready' && rows.length > 0 && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <p>શોધ મુજબ કંઈ મળ્યું નથી.</p>
            <button
              type="button"
              className="btn-ghost mt-3"
              onClick={() => {
                setQuery('')
                setFilter('all')
              }}
            >
              ફિલ્ટર સાફ કરો
            </button>
          </div>
        )}

        {state === 'ready' && visible.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{visible.length} દવા/batch</p>

            {/* Mobile: cards */}
            <ul className="space-y-3 md:hidden">
              {visible.map((r) => (
                <li
                  key={r.batchId}
                  className={`rounded-xl border border-l-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${STATUS_META[r.statuses[0]].border}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="min-w-0 break-words font-semibold">{r.name}</h2>
                    <StatusBadges statuses={r.statuses} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Batch</dt>
                      <dd className="break-all font-medium">{r.hasBatch ? r.batchNo : 'batch નથી'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Expiry</dt>
                      <dd className="font-medium"><ExpiryText row={r} /></dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">બાકી stock</dt>
                      <dd><StockText row={r} /></dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">MRP</dt>
                      <dd className="font-medium">{money.format(r.mrp)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Reorder level</dt>
                      <dd className="font-medium">{r.reorderLevel}</dd>
                    </div>
                  </dl>
                  {canAdd && (
                    <button type="button" className="btn-ghost mt-3 w-full" disabled={editBusy !== null} onClick={() => void openEdit(r.medicineId)}>
                      {editBusy === r.medicineId ? 'લોડ થઈ રહ્યું છે…' : 'સુધારો'}
                    </button>
                  )}
                
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th scope="col" className="px-3 py-3">દવા</th>
                    <th scope="col" className="px-3 py-3">Batch</th>
                    <th scope="col" className="px-3 py-3">Expiry</th>
                    <th scope="col" className="px-3 py-3 text-right">બાકી stock</th>
                    <th scope="col" className="px-3 py-3 text-right">MRP</th>
                    <th scope="col" className="px-3 py-3 text-right">Reorder</th>
                    <th scope="col" className="px-3 py-3">Status</th>
                    <th scope="col" className="px-3 py-3"><span className="sr-only">સુધારો</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visible.map((r) => (
                    <tr key={r.batchId} className="align-top">
                      <td className="px-3 py-3 font-semibold">{r.name}</td>
                      <td className="break-all px-3 py-3">{r.hasBatch ? r.batchNo : 'batch નથી'}</td>
                      <td className="px-3 py-3"><ExpiryText row={r} /></td>
                      <td className="px-3 py-3 text-right"><StockText row={r} /></td>
                      <td className="px-3 py-3 text-right">{money.format(r.mrp)}</td>
                      <td className="px-3 py-3 text-right">{r.reorderLevel}</td>
                      <td className="px-3 py-3"><StatusBadges statuses={r.statuses} /></td>
                      <td className="px-3 py-1">
                        {canAdd && (
                          <button type="button" className="btn-ghost" disabled={editBusy !== null} onClick={() => void openEdit(r.medicineId)}>
                            {editBusy === r.medicineId ? '…' : 'સુધારો'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Medicines() {
  const { selected } = useBranch()
  if (!selected) return null
  return <MedicinesInner branchId={selected.id} branchName={selected.name} />
}
