import { useMemo, useRef, useState } from 'react'
import { linkBarcode, type BarcodeKind, type MedicineName } from './api'
import { Tabs } from '../../components/ui'
import { Icon } from '../../components/Icon'

interface Props {
  code: string
  medicines: MedicineName[]
  onLinked: (medicineId: string, kind: BarcodeKind, units: number) => void
  onCancel: () => void
}

// Shown when a scanned barcode is not known yet: choose the medicine once, and it is remembered
export function LinkBarcode({ code, medicines, onLinked, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const [medicineId, setMedicineId] = useState('')
  const [kind, setKind] = useState<BarcodeKind>('single')
  const [units, setUnits] = useState('10')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<{ message: string; technical?: string } | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? medicines.filter((m) => m.name.toLowerCase().includes(q)) : medicines
    return list.slice(0, 50)
  }, [medicines, query])

  async function save() {
    if (busy.current) return
    setProblem(null)
    if (medicineId === '') return setProblem({ message: 'દવા પસંદ કરો.' })
    const n = Number(units)
    if (kind === 'box' && (!Number.isInteger(n) || n < 1)) return setProblem({ message: 'Box માં કેટલા નંગ છે તે 1 કે વધુ પૂર્ણાંક લખો.' })
    busy.current = true
    setSaving(true)
    const res = await linkBarcode(medicineId, code, kind, kind === 'box' ? n : 1)
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    onLinked(medicineId, kind, kind === 'box' ? n : 1)
  }

  return (
    <section className="rounded-xl border border-orange-300 bg-orange-50 p-4 dark:border-orange-900 dark:bg-slate-900" aria-label="નવો barcode">
      <h2 className="font-semibold">નવો barcode</h2>
      <p className="mt-1 break-all text-sm text-slate-700 dark:text-slate-300">
        <span className="font-mono font-bold">{code}</span> હજી કોઈ દવા સાથે જોડાયેલો નથી. એક વાર જોડો, પછી દરેક વખતે સીધું ઓળખાશે.
      </p>

      <div className="mt-3">
        <label htmlFor="lb-q" className="mb-1 block text-sm font-medium">દવા શોધો</label>
        <input id="lb-q" className="field" value={query} disabled={saving} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="mt-3">
        <label htmlFor="lb-med" className="mb-1 block text-sm font-medium">દવા પસંદ કરો</label>
        <select id="lb-med" className="field" value={medicineId} disabled={saving} onChange={(e) => setMedicineId(e.target.value)}>
          <option value="">— પસંદ કરો —</option>
          {shown.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {medicines.length === 0 && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">પહેલાં Medicines માં દવા ઉમેરો.</p>}
      </div>

      <Tabs<BarcodeKind>
        className="mt-3"
        label="Barcode પ્રકાર"
        value={kind}
        onChange={setKind}
        disabled={saving}
        items={[
          { value: 'single', label: 'એક નંગ / strip', icon: 'pill' },
          { value: 'box', label: 'આખું box', icon: 'box' },
        ]}
      />
      {kind === 'box' && (
        <div className="mt-3 max-w-xs">
          <label htmlFor="lb-units" className="mb-1 block text-sm font-medium">Box માં કેટલા નંગ (strip)?</label>
          <input id="lb-units" inputMode="numeric" className="field" value={units} disabled={saving} onChange={(e) => setUnits(e.target.value)} />
        </div>
      )}

      {problem && (
        <div role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">{problem.message}</p>
          {problem.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {problem.technical}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-primary gap-2" disabled={saving} onClick={() => void save()}><Icon name="plus" />{saving ? 'જોડી રહ્યા છીએ…' : 'જોડો'}</button>
        <button type="button" className="btn-ghost gap-2" disabled={saving} onClick={onCancel}><Icon name="close" />રદ કરો</button>
      </div>
    </section>
  )
}
