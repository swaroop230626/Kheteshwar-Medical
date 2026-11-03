import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui'
import { formatDate } from '../medicines/stock'
import type { SellableBatch } from './api'
import { lineAmounts, money, parseQty, type CartLine } from './cart'

interface Props {
  lines: CartLine[]
  batchById: Map<string, SellableBatch>
  batchesByMedicine: Map<string, SellableBatch[]>
  onQty: (key: string, qty: string) => void
  onBatch: (key: string, batchId: string) => void
  onRemove: (key: string) => void
  disabled: boolean
}

export function lineError(line: CartLine, batch: SellableBatch | undefined): string | null {
  if (!batch) return 'Batch હવે ઉપલબ્ધ નથી.'
  const q = parseQty(line.qty)
  if (q === null) return 'Qty 1 કે વધુ પૂર્ણાંક હોવી જોઈએ.'
  if (q > batch.qty) return `બાકી stock: ${batch.qty}`
  return null
}

export function CartLines({ lines, batchById, batchesByMedicine, onQty, onBatch, onRemove, disabled }: Props) {
  if (lines.length === 0) {
    return <EmptyState icon="receipt" title="Cart ખાલી છે" text="દવા શોધીને ઉમેરો, કે barcode scan કરો." />
  }

  const usedBatchIds = new Set(lines.map((l) => l.batchId))

  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const batch = batchById.get(l.batchId)
        const err = lineError(l, batch)
        const q = parseQty(l.qty)
        const amt = batch && q !== null ? lineAmounts(batch.mrp, q, l.gstRate) : null
        const options = (batchesByMedicine.get(l.medicineId) ?? []).filter((b) => b.id === l.batchId || !usedBatchIds.has(b.id))
        const set = (n: number) => onQty(l.key, String(Math.max(1, n)))

        return (
          <li
            key={l.key}
            className={`rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${err ? 'border-red-300 dark:border-red-900' : 'border-slate-200 dark:border-slate-800'}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright">
                <Icon name="pill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold leading-tight">{l.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {batch ? `${money.format(batch.mrp)} · GST ${l.gstRate}%` : '—'}
                  {batch && batch.schedule !== 'OTC' && <span className="font-semibold text-orange-700 dark:text-orange-300"> · Schedule {batch.schedule}</span>}
                </p>
              </div>
              <button type="button" className="btn-ghost min-w-11 shrink-0 px-0 text-red-700 dark:text-red-300" disabled={disabled}
                aria-label={`${l.name} દૂર કરો`} onClick={() => onRemove(l.key)}>
                <Icon name="trash" />
              </button>
            </div>

            <div className="mt-3">
              <label htmlFor={`${l.key}-b`} className="mb-1 block text-sm font-medium">Batch</label>
              <select id={`${l.key}-b`} className="field" value={l.batchId} disabled={disabled} onChange={(e) => onBatch(l.key, e.target.value)}>
                {options.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNo} · {formatDate(b.expiryDate)} · stock {b.qty}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <label htmlFor={`${l.key}-q`} className="mb-1 block text-sm font-medium">Qty</label>
                <div className="flex items-center gap-1">
                  <button type="button" className="btn-ghost min-w-11 px-0" disabled={disabled || (q ?? 1) <= 1} aria-label="Qty ઓછી કરો" onClick={() => set((q ?? 1) - 1)}>
                    <Icon name="minus" />
                  </button>
                  <input id={`${l.key}-q`} inputMode="numeric" className="field w-16 text-center" value={l.qty} disabled={disabled}
                    aria-invalid={err !== null} onChange={(e) => onQty(l.key, e.target.value)} />
                  <button type="button" className="btn-ghost min-w-11 px-0" disabled={disabled} aria-label="Qty વધારો" onClick={() => set((q ?? 0) + 1)}>
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600 dark:text-slate-400">Line total</p>
                <p className="text-xl font-bold">{amt ? money.format(amt.total) : '—'}</p>
              </div>
            </div>

            {err && (
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                <Icon name="alert" className="size-4 shrink-0" />
                {err}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
