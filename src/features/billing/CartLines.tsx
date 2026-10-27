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
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
        Cart ખાલી છે. દવા ઉમેરો.
      </p>
    )
  }

  const usedBatchIds = new Set(lines.map((l) => l.batchId))

  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const batch = batchById.get(l.batchId)
        const err = lineError(l, batch)
        const q = parseQty(l.qty)
        const amt = batch && q !== null ? lineAmounts(batch.mrp, q, l.gstRate) : null
        const options = (batchesByMedicine.get(l.medicineId) ?? []).filter(
          (b) => b.id === l.batchId || !usedBatchIds.has(b.id),
        )
        return (
          <li key={l.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold">{l.name}</p>
              <button type="button" className="btn-ghost min-w-11 px-0" disabled={disabled}
                aria-label={`${l.name} દૂર કરો`} onClick={() => onRemove(l.key)}>✕</button>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_6rem] gap-3">
              <div className="min-w-0">
                <label htmlFor={`${l.key}-b`} className="mb-1 block text-sm font-medium">Batch</label>
                <select id={`${l.key}-b`} className="field" value={l.batchId} disabled={disabled}
                  onChange={(e) => onBatch(l.key, e.target.value)}>
                  {options.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNo} · {formatDate(b.expiryDate)} · stock {b.qty}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor={`${l.key}-q`} className="mb-1 block text-sm font-medium">Qty</label>
                <input id={`${l.key}-q`} inputMode="numeric" className="field" value={l.qty} disabled={disabled}
                  aria-invalid={err !== null} onChange={(e) => onQty(l.key, e.target.value)} />
              </div>
            </div>

            {err && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{err}</p>}

            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-slate-600 dark:text-slate-400">MRP</dt><dd className="font-medium">{batch ? money.format(batch.mrp) : '—'}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">GST</dt><dd className="font-medium">{l.gstRate}%</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Line total</dt><dd className="font-bold">{amt ? money.format(amt.total) : '—'}</dd></div>
            </dl>
          </li>
        )
      })}
    </ul>
  )
}
