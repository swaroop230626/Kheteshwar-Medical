import { useMemo, useState } from 'react'
import { formatDate } from '../medicines/stock'
import type { SellableBatch } from './api'
import { money } from './cart'

interface Group {
  medicineId: string
  name: string
  batches: SellableBatch[] // FEFO order (earliest expiry first)
}

interface Props {
  groups: Group[]
  inCart: Set<string> // batch ids already in cart
  onAdd: (batch: SellableBatch) => void
}

export type { Group }

export function MedicineList({ groups, inCart, onAdd }: Props) {
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? groups.filter((g) => g.name.toLowerCase().includes(q) || g.batches.some((b) => b.batchNo.toLowerCase().includes(q)))
      : groups
    return list.slice(0, q ? 30 : 12)
  }, [groups, query])

  return (
    <section aria-label="દવાઓ">
      <label htmlFor="bill-search" className="sr-only">દવા અથવા batch શોધો</label>
      <input
        id="bill-search"
        type="search"
        className="field"
        placeholder="દવા અથવા batch શોધો"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!query.trim() && groups.length > 12 && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">શરૂના 12 દેખાય છે. બાકી માટે શોધો.</p>
      )}

      {groups.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
          વેચી શકાય એવો કોઈ stock નથી.
        </p>
      )}
      {groups.length > 0 && shown.length === 0 && (
        <p className="mt-4 text-center text-slate-600 dark:text-slate-400">શોધ મુજબ કંઈ મળ્યું નથી.</p>
      )}

      <ul className="mt-3 space-y-2">
        {shown.map((g) => {
          const b = g.batches[0]
          const added = inCart.has(b.id)
          return (
            <li key={g.medicineId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="break-words font-semibold">{g.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Batch {b.batchNo} · Exp {formatDate(b.expiryDate)} · stock {b.qty}
                </p>
                <p className="text-sm font-medium">
                  {money.format(b.mrp)} <span className="text-slate-600 dark:text-slate-400">· GST {b.gstRate}%</span>
                  {g.batches.length > 1 && (
                    <span className="text-slate-600 dark:text-slate-400"> · {g.batches.length} batch</span>
                  )}
                </p>
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={() => onAdd(b)} aria-label={`${g.name} cart માં ઉમેરો`}>
                {added ? '+1' : 'ઉમેરો'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
