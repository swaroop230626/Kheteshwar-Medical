import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { normalizeCode } from '../barcode/api'
import { LinkBarcode } from '../barcode/LinkBarcode'
import { ScanBar } from '../barcode/ScanBar'
import { useBarcodes } from '../barcode/useBarcodes'
import { batchKey, findExistingBatches, saveGrn, type MedicineOption } from './api'
import {
  GST_OPTIONS,
  emptyErrors,
  emptyItem,
  hasErrors,
  lineAmounts,
  parseNum,
  sumTotals,
  todayISO,
  validate,
  type FormDraft,
  type FormErrors,
  type ItemDraft,
  type ItemField,
} from './form'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

interface Props {
  branchId: string
  medicines: MedicineOption[]
  onCancel: () => void
  onSaved: (message: string) => void
  onRefreshMedicines: () => void
}

export function PurchaseForm({ branchId, medicines, onCancel, onSaved, onRefreshMedicines }: Props) {
  const [draft, setDraft] = useState<FormDraft>(() => ({
    supplier: '',
    invoiceNo: '',
    invoiceDate: todayISO(),
    items: [emptyItem()],
  }))
  const [errors, setErrors] = useState<FormErrors>(emptyErrors())
  const [saving, setSaving] = useState(false)

  const options = useMemo(() => medicines.filter((m) => !m.deleted), [medicines])
  const byId = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines])
  const totals = useMemo(() => sumTotals(draft.items), [draft.items])
  const today = todayISO()
  const { byCode, state: barcodeState, reload: reloadBarcodes } = useBarcodes()
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [unknownCode, setUnknownCode] = useState<string | null>(null)

  // A scan puts the medicine in the list with its quantity; batch and expiry are filled in by hand
  function addScanned(medicineId: string, units: number) {
    const med = byId.get(medicineId)
    setDraft((d) => {
      const same = d.items.find((i) => i.medicineId === medicineId)
      if (same) {
        return { ...d, items: d.items.map((i) => (i.key === same.key ? { ...i, qty: String((parseNum(i.qty) ?? 0) + units) } : i)) }
      }
      const blank = d.items.find((i) => i.medicineId === '' && i.batchNo === '' && i.expiry === '' && i.qty === '' && i.rate === '' && i.mrp === '')
      const base = blank ?? emptyItem()
      const gstOk = med && med.gstRate !== null && (GST_OPTIONS as readonly number[]).includes(med.gstRate)
      const filled: ItemDraft = {
        ...base,
        medicineId,
        qty: String(units),
        mrp: med && med.mrp !== null ? String(med.mrp) : '',
        gst: gstOk && med && med.gstRate !== null ? String(med.gstRate) : base.gst,
      }
      return { ...d, items: blank ? d.items.map((i) => (i.key === blank.key ? filled : i)) : [...d.items, filled] }
    })
  }

  function handleScan(code: string): 'continue' | 'stop' {
    if (barcodeState !== 'ready') {
      setScanMsg('Barcode ની યાદી લોડ થઈ નથી. supabase/barcodes.sql ચલાવ્યું છે?')
      return 'stop'
    }
    const info = byCode.get(normalizeCode(code))
    if (!info) {
      setUnknownCode(code)
      setScanMsg(`નવો barcode: ${code}`)
      return 'stop'
    }
    addScanned(info.medicineId, info.units)
    setScanMsg(`${byId.get(info.medicineId)?.name ?? 'દવા'} ઉમેર્યું (${info.units} નંગ). Batch અને expiry ભરો.`)
    return 'continue'
  }

  function patchItem(key: string, patch: Partial<ItemDraft>) {
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }))
  }

  function chooseMedicine(item: ItemDraft, medicineId: string) {
    const med = byId.get(medicineId)
    const patch: Partial<ItemDraft> = { medicineId }
    if (med && item.mrp === '' && med.mrp !== null) patch.mrp = String(med.mrp)
    if (med && med.gstRate !== null && (GST_OPTIONS as readonly number[]).includes(med.gstRate)) {
      patch.gst = String(med.gstRate)
    }
    patchItem(item.key, patch)
  }

  function removeItem(key: string) {
    setDraft((d) => (d.items.length > 1 ? { ...d, items: d.items.filter((i) => i.key !== key) } : d))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return

    const found = validate(draft, todayISO())
    if (hasErrors(found)) {
      found.general = found.general ?? 'લાલ લખાણવાળી વિગતો સુધારીને ફરી Save કરો.'
      setErrors(found)
      return
    }

    setSaving(true)
    setErrors(emptyErrors())

    // Friendly pre-check against stock_batches (the database re-checks inside the transaction)
    try {
      const existing = await findExistingBatches(branchId, draft.items.map((i) => i.medicineId))
      const clashes: FormErrors = { items: {} }
      for (const i of draft.items) {
        if (existing.has(batchKey(i.medicineId, i.batchNo))) {
          clashes.items[i.key] = { batchNo: 'આ batch પહેલેથી છે.' }
        }
      }
      if (Object.keys(clashes.items).length > 0) {
        clashes.general = 'આ batch પહેલેથી છે. બીજો batch no વાપરો.'
        setErrors(clashes)
        setSaving(false)
        return
      }
    } catch {
      setErrors({ items: {}, general: 'Batch તપાસી શકાયા નથી. ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.' })
      setSaving(false)
      return
    }

    const result = await saveGrn({
      branchId,
      supplier: draft.supplier.trim(),
      invoiceNo: draft.invoiceNo.trim(),
      invoiceDate: draft.invoiceDate,
      items: draft.items.map((i) => ({
        medicine_id: i.medicineId,
        batch_no: i.batchNo.trim(),
        expiry_date: i.expiry,
        qty: parseNum(i.qty) ?? 0,
        purchase_rate: parseNum(i.rate) ?? 0,
        mrp: parseNum(i.mrp) ?? 0,
        gst_rate: parseNum(i.gst) ?? 0,
      })),
    })
    setSaving(false)

    if (!result.ok) {
      setErrors({ items: {}, general: result.message })
      return
    }
    onSaved('Purchase સફળતાથી સેવ થઈ. સ્ટોક વધી ગયો છે.')
  }

  function ie(key: string, f: ItemField): string | undefined {
    return errors.items[key]?.[f]
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">નવી Purchase</h1>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>
          રદ કરો
        </button>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <Field id="supplier" label="Supplier નામ" error={errors.supplier}>
          <input id="supplier" className="field" value={draft.supplier} aria-invalid={Boolean(errors.supplier)}
            onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
        </Field>
        <Field id="invoiceNo" label="Invoice no" error={errors.invoiceNo}>
          <input id="invoiceNo" className="field" value={draft.invoiceNo} aria-invalid={Boolean(errors.invoiceNo)}
            onChange={(e) => setDraft({ ...draft, invoiceNo: e.target.value })} />
        </Field>
        <Field id="invoiceDate" label="Invoice date" error={errors.invoiceDate}>
          <input id="invoiceDate" type="date" className="field" value={draft.invoiceDate} aria-invalid={Boolean(errors.invoiceDate)}
            onChange={(e) => setDraft({ ...draft, invoiceDate: e.target.value })} />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Barcode scan">
        <ScanBar onScan={handleScan} status={scanMsg} disabled={saving} />
        {unknownCode && (
          <LinkBarcode
            code={unknownCode}
            medicines={options}
            onCancel={() => setUnknownCode(null)}
            onLinked={(medicineId, _kind, units) => {
              setUnknownCode(null)
              reloadBarcodes()
              addScanned(medicineId, units)
              setScanMsg('Barcode જોડાયો અને દવા ઉમેરી. Batch અને expiry ભરો.')
            }}
          />
        )}
      </section>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        દવા યાદીમાં નથી?{' '}
        <Link to="/medicines?new=1" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand underline dark:text-brand-bright">
          નવી દવા ઉમેરો ↗
        </Link>{' '}
        (નવા tab માં ખુલશે, આ ફોર્મનો ડેટા સચવાશે.) ઉમેર્યા પછી{' '}
        <button type="button" className="btn-ghost inline-flex" onClick={onRefreshMedicines} disabled={saving}>
          દવા યાદી તાજી કરો
        </button>
      </p>

      <section className="space-y-3" aria-label="Items">
        {draft.items.map((item, idx) => {
          const amt = lineAmounts(item)
          const id = (f: string) => `${item.key}-${f}`
          return (
            <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold">Item {idx + 1}</h2>
                {draft.items.length > 1 && (
                  <button type="button" className="btn-ghost" onClick={() => removeItem(item.key)} disabled={saving}>
                    દૂર કરો
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-4">
                  <Field id={id('med')} label="દવા" error={ie(item.key, 'medicineId')}>
                    <select id={id('med')} className="field" value={item.medicineId} aria-invalid={Boolean(ie(item.key, 'medicineId'))}
                      onChange={(e) => chooseMedicine(item, e.target.value)}>
                      <option value="">દવા પસંદ કરો</option>
                      {options.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field id={id('batch')} label="Batch no" error={ie(item.key, 'batchNo')}>
                  <input id={id('batch')} className="field" value={item.batchNo} aria-invalid={Boolean(ie(item.key, 'batchNo'))}
                    onChange={(e) => patchItem(item.key, { batchNo: e.target.value })} />
                </Field>
                <Field id={id('exp')} label="Expiry date" error={ie(item.key, 'expiry')}>
                  <input id={id('exp')} type="date" min={today} className="field" value={item.expiry} aria-invalid={Boolean(ie(item.key, 'expiry'))}
                    onChange={(e) => patchItem(item.key, { expiry: e.target.value })} />
                </Field>
                <Field id={id('qty')} label="Qty" error={ie(item.key, 'qty')}>
                  <input id={id('qty')} inputMode="numeric" className="field" value={item.qty} aria-invalid={Boolean(ie(item.key, 'qty'))}
                    onChange={(e) => patchItem(item.key, { qty: e.target.value })} />
                </Field>
                <Field id={id('rate')} label="Purchase rate (₹)" error={ie(item.key, 'rate')}>
                  <input id={id('rate')} inputMode="decimal" className="field" value={item.rate} aria-invalid={Boolean(ie(item.key, 'rate'))}
                    onChange={(e) => patchItem(item.key, { rate: e.target.value })} />
                </Field>
                <Field id={id('mrp')} label="MRP (₹)" error={ie(item.key, 'mrp')}>
                  <input id={id('mrp')} inputMode="decimal" className="field" value={item.mrp} aria-invalid={Boolean(ie(item.key, 'mrp'))}
                    onChange={(e) => patchItem(item.key, { mrp: e.target.value })} />
                </Field>
                <Field id={id('gst')} label="GST %" error={ie(item.key, 'gst')}>
                  <select id={id('gst')} className="field" value={item.gst} aria-invalid={Boolean(ie(item.key, 'gst'))}
                    onChange={(e) => patchItem(item.key, { gst: e.target.value })}>
                    {GST_OPTIONS.map((g) => (
                      <option key={g} value={String(g)}>{g}%</option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-col justify-end text-sm">
                  <p className="text-slate-600 dark:text-slate-400">Line total</p>
                  <p className="text-lg font-bold">{amt ? money.format(amt.total) : '—'}</p>
                </div>
              </div>
            </div>
          )
        })}

        <button type="button" className="btn-ghost w-full sm:w-auto" onClick={() => setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))} disabled={saving}>
          + Item ઉમેરો
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-slate-600 dark:text-slate-400">Taxable</dt><dd className="font-semibold">{money.format(totals.taxable)}</dd></div>
          <div><dt className="text-slate-600 dark:text-slate-400">GST</dt><dd className="font-semibold">{money.format(totals.gst)}</dd></div>
          <div><dt className="text-slate-600 dark:text-slate-400">કુલ</dt><dd className="text-lg font-bold">{money.format(totals.total)}</dd></div>
        </dl>

        {errors.general && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {errors.general}
          </p>
        )}

        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
          {saving ? 'સેવ થઈ રહ્યું છે…' : 'Purchase સેવ કરો'}
        </button>
      </section>
    </form>
  )
}
