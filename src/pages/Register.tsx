import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { formatDate } from '../features/medicines/stock'
import { todayISO } from '../features/purchases/form'
import {
  createDoctor,
  fetchDoctors,
  fetchRegister,
  type DoctorOption,
  type RegisterRow,
} from '../features/register/api'
import { RxPhotos } from '../features/prescriptions/RxPhotos'
import { downloadCsv, safeName } from '../lib/csv'

const CAN_VIEW = ['owner', 'branch_manager', 'billing_staff', 'accountant']
const CAN_ADD_DOCTOR = ['owner', 'branch_manager', 'billing_staff']

type Tab = 'register' | 'doctors'
type Load = 'loading' | 'ready' | 'error'
type Problem = { message: string; technical: string }

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function when(isoTime: string): string {
  const d = new Date(isoTime)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

function ProblemBox({ p, onRetry }: { p: Problem; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">{p.message}</p>
      <p className="mt-1 break-words font-mono text-xs">Technical: {p.technical}</p>
      {onRetry && <button type="button" className="btn-primary mt-3" onClick={onRetry}>ફરી પ્રયાસ</button>}
    </div>
  )
}

function Badges({ r }: { r: RegisterRow }) {
  return (
    <span className="flex flex-wrap gap-1">
      {r.entryType === 'return' && (
        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-200">Return {r.returnNo}</span>
      )}
      {r.cancelled && (
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900 dark:bg-red-950 dark:text-red-200">Bill રદ</span>
      )}
    </span>
  )
}

function RegisterView({ rows, branchId, canAdd, onChanged }: { rows: RegisterRow[]; branchId: string; canAdd: boolean; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
        આ તારીખોમાં Schedule H/H1/X નું કોઈ વેચાણ નથી.
      </p>
    )
  }

  const photoLabel = (r: RegisterRow) => (r.photos > 0 ? `ફોટા (${r.photos})` : canAdd ? 'ફોટો ઉમેરો' : 'ફોટો નથી')
  const photoButton = (r: RegisterRow) => (
    <button type="button" className="btn-ghost print:hidden" aria-expanded={openId === r.id}
      onClick={() => setOpenId(openId === r.id ? null : r.id)}>
      {photoLabel(r)}
    </button>
  )
  const panel = (r: RegisterRow) => (
    <RxPhotos branchId={branchId} billId={r.billId} canAdd={canAdd} onChanged={onChanged} />
  )
  const qty = (r: RegisterRow) => (r.entryType === 'return' ? `−${r.qty}` : String(r.qty))

  return (
    <>
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">{rows.length} નોંધ</p>

      <ul className="space-y-3 lg:hidden print:hidden">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-xl border p-4 ${r.entryType === 'return' ? 'border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-slate-900' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold">{r.medicine}</p>
              <span className="shrink-0 rounded-md bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">{r.schedule}</span>
            </div>
            <Badges r={r} />
            <p className="text-sm text-slate-600 dark:text-slate-400">{when(r.date)} · Bill {r.billNo} · Batch {r.batchNo || '—'} · Qty {qty(r)}</p>
            <dl className="mt-2 grid grid-cols-1 gap-1 text-sm">
              <div><dt className="inline text-slate-600 dark:text-slate-400">Patient: </dt><dd className="inline break-words">{r.patientName}{r.patientAge && `, ${r.patientAge}`}{r.patientAddress && ` · ${r.patientAddress}`}</dd></div>
              <div><dt className="inline text-slate-600 dark:text-slate-400">Doctor: </dt><dd className="inline break-words">{r.doctorName}{r.doctorRegNo && ` (Reg ${r.doctorRegNo})`}</dd></div>
            </dl>
            <div className="mt-3">{photoButton(r)}</div>
            {openId === r.id && <div className="mt-3">{panel(r)}</div>}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block print:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="px-3 py-3">તારીખ</th>
              <th scope="col" className="px-3 py-3">Bill</th>
              <th scope="col" className="px-3 py-3">દવા</th>
              <th scope="col" className="px-3 py-3 text-right">Qty</th>
              <th scope="col" className="px-3 py-3">Patient</th>
              <th scope="col" className="px-3 py-3">Doctor</th>
              <th scope="col" className="px-3 py-3">Rx ફોટો</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 align-top dark:divide-slate-800">
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={r.entryType === 'return' ? 'bg-sky-50 dark:bg-slate-800' : ''}>
                  <td className="px-3 py-3">{when(r.date)}</td>
                  <td className="px-3 py-3"><span className="block break-all">{r.billNo}</span><Badges r={r} /></td>
                  <td className="px-3 py-3"><span className="font-medium">{r.medicine}</span> <b>({r.schedule})</b><span className="block break-all text-slate-600 dark:text-slate-400">Batch {r.batchNo || '—'}</span></td>
                  <td className="px-3 py-3 text-right">{qty(r)}</td>
                  <td className="px-3 py-3">{r.patientName}{r.patientAge && `, ${r.patientAge}`}{r.patientAddress && <span className="block text-slate-600 dark:text-slate-400">{r.patientAddress}</span>}</td>
                  <td className="px-3 py-3">{r.doctorName}{r.doctorRegNo && <span className="block text-slate-600 dark:text-slate-400">Reg {r.doctorRegNo}</span>}</td>
                  <td className="px-3 py-1">
                    <span className="hidden print:inline">{r.photos > 0 ? `${r.photos} ફોટા` : '—'}</span>
                    {photoButton(r)}
                  </td>
                </tr>
                {openId === r.id && (
                  <tr className="print:hidden">
                    <td colSpan={7} className="px-3 py-3">{panel(r)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function RegisterTab({ branchId, branchName, canAdd }: { branchId: string; branchName: string; canAdd: boolean }) {
  const n = new Date()
  const [from, setFrom] = useState(iso(new Date(n.getFullYear(), n.getMonth(), 1)))
  const [to, setTo] = useState(iso(n))
  const [sch, setSch] = useState('all')
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<RegisterRow[]>([])
  const [state, setState] = useState<Load>('loading')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const rangeError = from === '' || to === '' ? 'બંને તારીખ પસંદ કરો.' : from > to ? '"થી" તારીખ "સુધી" પછી ન હોઈ શકે.' : null

  useEffect(() => {
    if (rangeError) return
    let cancelled = false
    setState('loading')
    setProblem(null)
    void fetchRegister(branchId, from, to).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setProblem({ message: res.message, technical: res.technical })
        setState('error')
        return
      }
      setRows(res.data)
      setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [branchId, from, to, rangeError, reloadKey])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (sch !== 'all' && r.schedule !== sch) return false
      if (!q) return true
      return [r.medicine, r.patientName, r.doctorName, r.billNo, r.batchNo].some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, sch, query])

  function exportCsv() {
    downloadCsv(`schedule-register_${safeName(branchName)}_${from}_${to}.csv`, [
      ['Date', 'Type', 'Return no', 'Bill no', 'Bill cancelled', 'Medicine', 'Schedule', 'Batch', 'Qty', 'Patient name', 'Patient age', 'Patient address', 'Doctor', 'Doctor reg no', 'Rx photos'],
      ...visible.map((r) => [when(r.date), r.entryType === 'return' ? 'Return' : 'Sale', r.returnNo, r.billNo, r.cancelled ? 'Yes' : '', r.medicine, r.schedule, r.batchNo, r.entryType === 'return' ? -r.qty : r.qty, r.patientName, r.patientAge, r.patientAddress, r.doctorName, r.doctorRegNo, r.photos]),
    ])
  }

  return (
    <div>
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>
      <div className="hidden print:block">
        <p className="text-xl font-bold">Kheteshwar Medical · Schedule H/H1/X Register</p>
        <p>{branchName} · {formatDate(from)} – {formatDate(to)}{sch !== 'all' ? ` · Schedule ${sch}` : ''}</p>
        <p className="mb-3">છાપ્યું: {new Date().toLocaleString('en-IN')}</p>
      </div>

      <div className="print:hidden">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div className="min-w-0">
            <label htmlFor="g-from" className="mb-1 block text-sm font-medium">થી</label>
            <input id="g-from" type="date" max={todayISO()} className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label htmlFor="g-to" className="mb-1 block text-sm font-medium">સુધી</label>
            <input id="g-to" type="date" max={todayISO()} className="field" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:max-w-2xl sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor="g-sch" className="mb-1 block text-sm font-medium">Schedule</label>
            <select id="g-sch" className="field" value={sch} onChange={(e) => setSch(e.target.value)}>
              <option value="all">બધા</option>
              <option value="H">H</option>
              <option value="H1">H1</option>
              <option value="X">X</option>
            </select>
          </div>
          <div>
            <label htmlFor="g-q" className="mb-1 block text-sm font-medium">શોધો</label>
            <input id="g-q" type="search" className="field" placeholder="દવા, patient, doctor, bill" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {state === 'ready' && !rangeError && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-ghost gap-2" onClick={exportCsv}><Icon name="download" />Excel (CSV) ડાઉનલોડ</button>
            <button type="button" className="btn-ghost gap-2" onClick={() => window.print()}><Icon name="printer" />PDF / Print</button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {rangeError && <p role="alert" className="text-red-700 dark:text-red-300">{rangeError}</p>}
        {!rangeError && state === 'loading' && <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}
        {!rangeError && state === 'error' && problem && <ProblemBox p={problem} onRetry={() => setReloadKey((k) => k + 1)} />}
        {!rangeError && state === 'ready' && <RegisterView rows={visible} branchId={branchId} canAdd={canAdd} onChanged={() => setReloadKey((k) => k + 1)} />}
      </div>
    </div>
  )
}

function DoctorsTab({ canAdd }: { canAdd: boolean }) {
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [state, setState] = useState<Load>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [name, setName] = useState('')
  const [reg, setReg] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchDoctors()
      .then((d) => {
        if (cancelled) return
        setDoctors(d)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    setProblem(null)
    setNotice(null)
    if (name.trim() === '') return setProblem({ message: 'Doctor નું નામ લખો.', technical: '' })
    setSaving(true)
    const res = await createDoctor(name.trim(), reg.trim(), phone.trim())
    setSaving(false)
    if (!res.ok) return setProblem({ message: res.message, technical: res.technical })
    setNotice('Doctor ઉમેરાયા.')
    setName('')
    setReg('')
    setPhone('')
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      {canAdd && (
        <form onSubmit={(e) => void add(e)} noValidate className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-semibold">નવા doctor</h2>
          <div>
            <label htmlFor="d-name" className="mb-1 block text-sm font-medium">નામ *</label>
            <input id="d-name" className="field" value={name} disabled={saving} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-reg" className="mb-1 block text-sm font-medium">Registration no</label>
            <input id="d-reg" className="field" value={reg} disabled={saving} onChange={(e) => setReg(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-phone" className="mb-1 block text-sm font-medium">Phone</label>
            <input id="d-phone" inputMode="tel" className="field" value={phone} disabled={saving} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {problem && <ProblemBox p={problem} />}
          {notice && <p role="status" className="text-sm text-green-800 dark:text-green-300">{notice}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'સેવ થઈ રહ્યું છે…' : 'Doctor સેવ કરો'}</button>
        </form>
      )}

      <div>
        {state === 'loading' && <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}
        {state === 'error' && (
          <ProblemBox p={{ message: 'Doctors લોડ થયા નથી. supabase/schedule_register.sql ચલાવ્યું છે?', technical: 'fetchDoctors failed' }} onRetry={() => setReloadKey((k) => k + 1)} />
        )}
        {state === 'ready' && doctors.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">હજી કોઈ doctor નથી.</p>
        )}
        {state === 'ready' && doctors.length > 0 && (
          <ul className="space-y-2">
            {doctors.map((d) => (
              <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <p className="break-words font-semibold">{d.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {d.regNo ? `Reg ${d.regNo}` : 'Registration no નથી'}
                  {d.phone && ` · ${d.phone}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function Register() {
  const { selected } = useBranch()
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('register')
  if (!selected) return null
  if (!profile || !CAN_VIEW.includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Schedule Register</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">તમારી role થી આ પેજ જોઈ શકાતું નથી.</p>
      </div>
    )
  }
  const tabs: { v: Tab; label: string }[] = [
    { v: 'register', label: 'Schedule register' },
    { v: 'doctors', label: 'Doctors' },
  ]
  return (
    <div className="print-plain">
      <div className="print:hidden">
        <PageHeader icon="clipboard" title="Schedule Register" subtitle={selected.name} />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="વિભાગ">
          {tabs.map((t) => (
            <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => setTab(t.v)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                tab === t.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {tab === 'register' ? (
          <RegisterTab branchId={selected.id} branchName={selected.name} canAdd={CAN_ADD_DOCTOR.includes(profile.role)} />
        ) : (
          <DoctorsTab canAdd={CAN_ADD_DOCTOR.includes(profile.role)} />
        )}
      </div>
    </div>
  )
}
