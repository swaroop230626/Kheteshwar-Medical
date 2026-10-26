import { useMemo, useState } from 'react'
import { useBranch } from '../branch/BranchContext'
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

function MedicinesInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { rows, state, reload } = useStockRows(branchId)
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

  return (
    <div>
      <h1 className="text-2xl font-bold">Medicines</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>

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
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{visible.length} batch</p>

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
                      <dd className="break-all font-medium">{r.batchNo}</dd>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visible.map((r) => (
                    <tr key={r.batchId} className="align-top">
                      <td className="px-3 py-3 font-semibold">{r.name}</td>
                      <td className="break-all px-3 py-3">{r.batchNo}</td>
                      <td className="px-3 py-3"><ExpiryText row={r} /></td>
                      <td className="px-3 py-3 text-right"><StockText row={r} /></td>
                      <td className="px-3 py-3 text-right">{money.format(r.mrp)}</td>
                      <td className="px-3 py-3 text-right">{r.reorderLevel}</td>
                      <td className="px-3 py-3"><StatusBadges statuses={r.statuses} /></td>
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
