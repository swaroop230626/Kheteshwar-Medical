import { useRef, useState, type FormEvent } from 'react'
import { addCustomer } from './api'

interface Props {
  branchId: string
  onCancel: () => void
  onSaved: () => void
}

export function CustomerForm({ branchId, onCancel, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [limit, setLimit] = useState('0')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [problem, setProblem] = useState<{ message: string; technical?: string } | null>(null)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setProblem(null)

    const cleanPhone = phone.trim()
    const lim = limit.trim() === '' ? 0 : Number(limit)
    if (name.trim() === '') return setProblem({ message: 'નામ લખવું જરૂરી છે.' })
    if (cleanPhone !== '' && !/^[0-9+\-\s]{7,15}$/.test(cleanPhone)) return setProblem({ message: 'Phone નંબર ખોટો છે.' })
    if (!Number.isFinite(lim) || lim < 0) return setProblem({ message: 'Credit limit 0 કે વધુ હોવી જોઈએ.' })

    busy.current = true
    setSaving(true)
    const res = await addCustomer({ branchId, name: name.trim(), phone: cleanPhone, address: address.trim(), creditLimit: lim })
    busy.current = false
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    onSaved()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">નવો customer</h2>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={saving}>રદ કરો</button>
      </div>

      <div>
        <label htmlFor="c-name" className="mb-1 block text-sm font-medium">નામ *</label>
        <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-phone" className="mb-1 block text-sm font-medium">Phone</label>
          <input id="c-phone" inputMode="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
        </div>
        <div>
          <label htmlFor="c-limit" className="mb-1 block text-sm font-medium">Credit limit (₹)</label>
          <input id="c-limit" inputMode="decimal" className="field" value={limit} onChange={(e) => setLimit(e.target.value)} disabled={saving} />
        </div>
      </div>
      <div>
        <label htmlFor="c-addr" className="mb-1 block text-sm font-medium">સરનામું</label>
        <input id="c-addr" className="field" value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">Credit limit 0 હોય તો આ customer ને ઉધાર વેચાણ થઈ શકે નહીં.</p>

      {problem && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">{problem.message}</p>
          {problem.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {problem.technical}</p>}
        </div>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving ? 'સેવ થઈ રહ્યું છે…' : 'Customer સેવ કરો'}
      </button>
    </form>
  )
}
