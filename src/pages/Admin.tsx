import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { fetchBranchInfo, type BranchInfo } from '../features/admin/api'
import { BranchesTab } from '../features/admin/BranchesTab'
import { StaffTab } from '../features/admin/StaffTab'

type Tab = 'branches' | 'staff'

function AdminInner({ selfId }: { selfId: string }) {
  const { reload: reloadBranchContext } = useBranch()
  const [tab, setTab] = useState<Tab>('branches')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [key, setKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    fetchBranchInfo()
      .then((d) => {
        if (cancelled) return
        setBranches(d)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [key])

  const tabs: { v: Tab; label: string }[] = [
    { v: 'branches', label: 'શાખાઓ' },
    { v: 'staff', label: 'Staff' },
  ]

  return (
    <div>
      <PageHeader icon="settings" title="Admin" subtitle="શાખાઓ અને staff (ફક્ત owner)" />

      <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="વિભાગ">
        {tabs.map((t) => (
          <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => { setTab(t.v); setNotice(null) }}
            className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && <p role="status" className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">{notice}</p>}

      <div className="mt-4">
        {state === 'loading' && <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}
        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">લોડ થઈ શક્યું નથી.</p>
            <button type="button" className="btn-primary mt-3" onClick={() => setKey((k) => k + 1)}>ફરી પ્રયાસ</button>
          </div>
        )}
        {state === 'ready' && tab === 'branches' && (
          <BranchesTab
            branches={branches}
            onChanged={(msg) => {
              setNotice(msg)
              setKey((k) => k + 1)
              reloadBranchContext() // so the branch list in the app updates too
            }}
          />
        )}
        {state === 'ready' && tab === 'staff' && <StaffTab branches={branches} selfId={selfId} />}
      </div>
    </div>
  )
}

export function Admin() {
  const { profile } = useAuth()
  if (!profile || profile.role !== 'owner') {
    return (
      <div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">આ પેજ ફક્ત owner માટે છે.</p>
      </div>
    )
  }
  return <AdminInner selfId={profile.id} />
}
