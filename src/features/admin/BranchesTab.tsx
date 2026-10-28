import { useRef, useState, type FormEvent } from 'react'
import { createBranch, updateBranch, type BranchInfo } from './api'

interface Problem {
  message: string
  technical?: string
}

function ProblemBox({ p }: { p: Problem }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{p.message}</p>
      {p.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {p.technical}</p>}
    </div>
  )
}

function BranchForm({ initial, onCancel, onSaved }: { initial: BranchInfo | null; onCancel: () => void; onSaved: (msg: string) => void }) {
  const editing = initial !== null
  const [name, setName] = useState(initial?.name ?? '')
  const [prefix, setPrefix] = useState(initial?.billPrefix ?? '')
  const [gst, setGst] = useState(initial?.gstNo ?? '')
  const [licence, setLicence] = useState(initial?.licenceNo ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setProblem(null)
    const cleanPrefix = prefix.trim().toUpperCase()
    if (name.trim() === '') return setProblem({ message: 'શાખાનું નામ લખો.' })
    if (!editing && !/^[A-Z0-9]{1,8}$/.test(cleanPrefix)) return setProblem({ message: 'Bill prefix માં ફક્ત A-Z અને 0-9, વધુમાં વધુ 8 અક્ષર.' })
    if (gst.trim() !== '' && !/^[0-9A-Za-z]{15}$/.test(gst.trim())) return setProblem({ message: 'GSTIN 15 અક્ષરનો હોવો જોઈએ.' })

    busy.current = true
    setSaving(true)
    const fields = { name: name.trim(), gstNo: gst.trim().toUpperCase(), licenceNo: licence.trim(), address: address.trim(), phone: phone.trim() }
    const res = initial ? await updateBranch(initial.id, fields) : await createBranch({ ...fields, billPrefix: cleanPrefix })
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    onSaved(editing ? 'શાખાની વિગતો સુધારાઈ.' : 'નવી શાખા ઉમેરાઈ.')
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{editing ? 'શાખા સુધારો' : 'નવી શાખા'}</h2>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>રદ કરો</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="b-name" className="mb-1 block text-sm font-medium">શાખાનું નામ *</label>
          <input id="b-name" className="field" value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="b-prefix" className="mb-1 block text-sm font-medium">Bill prefix *</label>
          <input id="b-prefix" className="field uppercase" value={prefix} disabled={saving || editing} maxLength={8}
            onChange={(e) => setPrefix(e.target.value)} />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {editing ? 'Bill નંબરનો ભાગ છે, એટલે બદલી શકાતો નથી.' : 'દા.ત. KM02. દરેક bill નંબર આનાથી શરૂ થશે, પછી બદલાશે નહીં.'}
          </p>
        </div>
        <div className="min-w-0">
          <label htmlFor="b-gst" className="mb-1 block text-sm font-medium">GSTIN</label>
          <input id="b-gst" className="field uppercase" value={gst} disabled={saving} maxLength={15} onChange={(e) => setGst(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="b-lic" className="mb-1 block text-sm font-medium">Drug licence no</label>
          <input id="b-lic" className="field" value={licence} disabled={saving} onChange={(e) => setLicence(e.target.value)} />
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor="b-addr" className="mb-1 block text-sm font-medium">સરનામું</label>
          <input id="b-addr" className="field" value={address} disabled={saving} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="b-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <input id="b-phone" inputMode="tel" className="field" value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">આ વિગતો bill ની પાવતી પર છપાય છે.</p>
      {problem && <ProblemBox p={problem} />}
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? 'સેવ થઈ રહ્યું છે…' : editing ? 'ફેરફાર સેવ કરો' : 'શાખા સેવ કરો'}
      </button>
    </form>
  )
}

export function BranchesTab({ branches, onChanged }: { branches: BranchInfo[]; onChanged: (msg: string) => void }) {
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'edit'; branch: BranchInfo }>({ kind: 'list' })

  if (mode.kind !== 'list') {
    return (
      <BranchForm
        initial={mode.kind === 'edit' ? mode.branch : null}
        onCancel={() => setMode({ kind: 'list' })}
        onSaved={(msg) => {
          setMode({ kind: 'list' })
          onChanged(msg)
        }}
      />
    )
  }

  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => setMode({ kind: 'new' })}>+ નવી શાખા</button>
      <ul className="mt-4 space-y-3">
        {branches.map((b) => (
          <li key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-lg font-semibold">{b.name}</p>
              <span className="shrink-0 rounded-md bg-brand-soft px-2 py-0.5 text-sm font-semibold text-brand-strong dark:bg-slate-800 dark:text-brand-bright">{b.billPrefix}</span>
            </div>
            <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <div><dt className="inline text-slate-600 dark:text-slate-400">GSTIN: </dt><dd className="inline break-all">{b.gstNo || '—'}</dd></div>
              <div><dt className="inline text-slate-600 dark:text-slate-400">Drug licence: </dt><dd className="inline break-all">{b.licenceNo || '—'}</dd></div>
              <div><dt className="inline text-slate-600 dark:text-slate-400">Phone: </dt><dd className="inline">{b.phone || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="inline text-slate-600 dark:text-slate-400">સરનામું: </dt><dd className="inline break-words">{b.address || '—'}</dd></div>
            </dl>
            <button type="button" className="btn-ghost mt-3" onClick={() => setMode({ kind: 'edit', branch: b })}>સુધારો</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
