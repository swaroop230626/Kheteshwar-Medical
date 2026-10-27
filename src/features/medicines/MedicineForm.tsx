import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createMedicine } from './create'

const GST = [0, 5, 12, 18] as const
const SCHEDULES = ['OTC', 'H', 'H1', 'X'] as const

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  )
}

interface Errors {
  name?: string
  mrp?: string
  reorder?: string
}

export function MedicineForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [generic, setGeneric] = useState('')
  const [maker, setMaker] = useState('')
  const [hsn, setHsn] = useState('')
  const [gst, setGst] = useState('12')
  const [schedule, setSchedule] = useState('OTC')
  const [mrp, setMrp] = useState('')
  const [reorder, setReorder] = useState('0')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<{ message: string; technical?: string } | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setProblem(null)

    const found: Errors = {}
    if (name.trim() === '') found.name = 'દવાનું નામ લખો.'
    const mrpNum = Number(mrp)
    if (mrp.trim() === '' || !Number.isFinite(mrpNum) || mrpNum <= 0) found.mrp = 'MRP 0 થી વધુ હોવો જોઈએ.'
    const reorderNum = Number(reorder)
    if (reorder.trim() === '' || !Number.isInteger(reorderNum) || reorderNum < 0) found.reorder = 'Reorder level 0 કે વધુ પૂર્ણાંક હોવો જોઈએ.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    busy.current = true
    setSaving(true)
    const res = await createMedicine({
      name: name.trim(),
      genericName: generic.trim(),
      manufacturer: maker.trim(),
      hsnCode: hsn.trim(),
      gstRate: Number(gst),
      schedule,
      mrp: mrpNum,
      reorderLevel: reorderNum,
    })
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    onSaved()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">નવી દવા</h1>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>રદ કરો</button>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="sm:col-span-2">
          <Field id="m-name" label="નામ *" error={errors.name}>
            <input id="m-name" className="field" value={name} disabled={saving} aria-invalid={Boolean(errors.name)}
              onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field id="m-generic" label="Generic name">
          <input id="m-generic" className="field" value={generic} disabled={saving} onChange={(e) => setGeneric(e.target.value)} />
        </Field>
        <Field id="m-maker" label="Manufacturer">
          <input id="m-maker" className="field" value={maker} disabled={saving} onChange={(e) => setMaker(e.target.value)} />
        </Field>
        <Field id="m-hsn" label="HSN code">
          <input id="m-hsn" inputMode="numeric" className="field" value={hsn} disabled={saving} onChange={(e) => setHsn(e.target.value)} />
        </Field>
        <Field id="m-gst" label="GST %">
          <select id="m-gst" className="field" value={gst} disabled={saving} onChange={(e) => setGst(e.target.value)}>
            {GST.map((g) => (
              <option key={g} value={String(g)}>{g}%</option>
            ))}
          </select>
        </Field>
        <Field id="m-schedule" label="Schedule">
          <select id="m-schedule" className="field" value={schedule} disabled={saving} onChange={(e) => setSchedule(e.target.value)}>
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field id="m-mrp" label="MRP (₹) *" error={errors.mrp}>
          <input id="m-mrp" inputMode="decimal" className="field" value={mrp} disabled={saving} aria-invalid={Boolean(errors.mrp)}
            onChange={(e) => setMrp(e.target.value)} />
        </Field>
        <Field id="m-reorder" label="Reorder level" error={errors.reorder}>
          <input id="m-reorder" inputMode="numeric" className="field" value={reorder} disabled={saving} aria-invalid={Boolean(errors.reorder)}
            onChange={(e) => setReorder(e.target.value)} />
        </Field>
        <p className="text-sm text-slate-600 dark:text-slate-400 sm:col-span-2">
          અહીં batch ઉમેરાતો નથી. Batch અને stock Purchases માંથી આવે છે.
        </p>
      </section>

      {problem && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">{problem.message}</p>
          {problem.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {problem.technical}</p>}
        </div>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? 'સેવ થઈ રહ્યું છે…' : 'દવા સેવ કરો'}
      </button>
    </form>
  )
}
