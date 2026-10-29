import { useState } from 'react'
import { removeBarcode, type BarcodeInfo, type BarcodeKind } from './api'
import { ScanBar } from './ScanBar'

export interface PendingBarcode {
  code: string
  kind: BarcodeKind
  units: number
}

interface Props {
  existing: BarcodeInfo[] // already saved for this medicine
  pending: PendingBarcode[] // will be saved together with the medicine
  onPending: (p: PendingBarcode[]) => void
  onExistingChanged: () => void
  disabled: boolean
}

const kindLabel = (k: BarcodeKind, units: number): string => (k === 'box' ? `Box (${units} નંગ)` : 'એક નંગ / strip')

// Medicine form part: scan or type the barcode of the box and/or the single strip
export function BarcodeSection({ existing, pending, onPending, onExistingChanged, disabled }: Props) {
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<BarcodeKind>('single')
  const [units, setUnits] = useState('10')
  const [msg, setMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function add() {
    setMsg(null)
    const c = code.trim()
    const n = kind === 'box' ? Number(units) : 1
    if (c === '') return setMsg('Barcode scan કરો કે લખો.')
    if (kind === 'box' && (!Number.isInteger(n) || n < 1)) return setMsg('Box માં કેટલા નંગ છે તે 1 કે વધુ પૂર્ણાંક લખો.')
    if (pending.some((p) => p.code === c) || existing.some((e) => e.code === c)) return setMsg('આ barcode પહેલેથી યાદીમાં છે.')
    onPending([...pending, { code: c, kind, units: n }])
    setCode('')
  }

  async function remove(id: string) {
    if (busyId) return
    setBusyId(id)
    const res = await removeBarcode(id)
    setBusyId(null)
    if (!res.ok) return setMsg(res.message)
    onExistingChanged()
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Barcode">
      <h2 className="font-semibold">Barcode</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Box અને એક નંગ (strip) ના barcode અલગ હોઈ શકે. બંને જોડી શકાય. Billing/Purchase માં scan કરતાં દવા આપમેળે આવશે.
      </p>

      {(existing.length > 0 || pending.length > 0) && (
        <ul className="space-y-2">
          {existing.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
              <span className="min-w-0"><span className="break-all font-mono font-semibold">{b.code}</span><span className="block text-slate-600 dark:text-slate-400">{kindLabel(b.kind, b.units)}</span></span>
              <button type="button" className="btn-ghost shrink-0" disabled={disabled || busyId !== null} onClick={() => void remove(b.id)}>
                {busyId === b.id ? '…' : 'કાઢો'}
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.code} className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-brand px-3 py-2 text-sm">
              <span className="min-w-0"><span className="break-all font-mono font-semibold">{p.code}</span><span className="block text-slate-600 dark:text-slate-400">{kindLabel(p.kind, p.units)} · સેવ કરતાં જોડાશે</span></span>
              <button type="button" className="btn-ghost shrink-0" disabled={disabled} onClick={() => onPending(pending.filter((x) => x.code !== p.code))}>દૂર કરો</button>
            </li>
          ))}
        </ul>
      )}

      <ScanBar
        label="Barcode"
        disabled={disabled}
        status={code === '' ? null : `પસંદ કરેલો: ${code}`}
        onScan={(c) => {
          setCode(c)
          return 'stop'
        }}
      />

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Barcode પ્રકાર">
        {([
          { v: 'single', label: 'એક નંગ / strip' },
          { v: 'box', label: 'આખું box' },
        ] as const).map((o) => (
          <button key={o.v} type="button" disabled={disabled} aria-pressed={kind === o.v} onClick={() => setKind(o.v)}
            className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              kind === o.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
      {kind === 'box' && (
        <div className="max-w-xs">
          <label htmlFor="bs-units" className="mb-1 block text-sm font-medium">Box માં કેટલા નંગ (strip)?</label>
          <input id="bs-units" inputMode="numeric" className="field" value={units} disabled={disabled} onChange={(e) => setUnits(e.target.value)} />
        </div>
      )}
      <button type="button" className="btn-ghost" disabled={disabled || code === ''} onClick={add}>+ આ barcode ઉમેરો</button>
      {msg && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{msg}</p>}
    </section>
  )
}
