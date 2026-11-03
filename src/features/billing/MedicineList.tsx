import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState, SearchField } from '../../components/ui'
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
      <SearchField id="bill-search" label="દવા અથવા batch શોધો" placeholder="દવા અથવા batch શોધો" value={query} onChange={setQuery} />
      {!query.trim() && groups.length > 12 && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">શરૂના 12 દેખાય છે. બાકી માટે શોધો.</p>
      )}

      {groups.length === 0 && (
        <div className="mt-4">
          <EmptyState icon="box" title="વેચી શકાય એવો કોઈ stock નથી" text="Purchases માંથી stock ઉમેરો." />
        </div>
      )}
      {groups.length > 0 && shown.length === 0 && (
        <div className="mt-4">
          <EmptyState icon="search" title="શોધ મુજબ કંઈ મળ્યું નથી" text="બીજું નામ કે batch લખી જુઓ." />
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {shown.map((g) => {
          const b = g.batches[0]
          const added = inCart.has(b.id)
          return (
            <li key={g.medicineId} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright">
                <Icon name="pill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-tight">{g.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Batch {b.batchNo} · Exp {formatDate(b.expiryDate)}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-bold">{money.format(b.mrp)}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">stock {b.qty}</span>
                  <span className="text-slate-600 dark:text-slate-400">GST {b.gstRate}%</span>
                  {b.schedule !== 'OTC' && (
                    <span className="rounded-md bg-orange-100 px-1.5 text-xs font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">Schedule {b.schedule}</span>
                  )}
                  {g.batches.length > 1 && <span className="text-xs text-slate-600 dark:text-slate-400">{g.batches.length} batch</span>}
                </p>
              </div>
              <button type="button" className={`${added ? 'btn-ghost' : 'btn-primary'} min-w-11 shrink-0 gap-1 px-3`} onClick={() => onAdd(b)} aria-label={`${g.name} cart માં ઉમેરો`}>
                <Icon name="plus" />
                {added ? '1' : ''}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
