import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { PageHeader } from '../components/PageHeader'
import { LoadingBlock, Notice, Tabs, type TabItem } from '../components/ui'
import { fetchBranchInfo, type BranchInfo } from '../features/admin/api'
import { BranchesTab } from '../features/admin/BranchesTab'
import { StaffTab } from '../features/admin/StaffTab'
import { Icon } from '../components/Icon'

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

      <Tabs<Tab>
        className="mt-4 sm:max-w-md"
        label="વિભાગ"
        value={tab}
        onChange={(v) => {
          setTab(v)
          setNotice(null)
        }}
        items={tabs.map((t): TabItem<Tab> => ({ value: t.v, label: t.label, icon: t.v === 'branches' ? 'building' : 'users' }))}
      />

      {notice && <Notice kind="success" className="mt-4">{notice}</Notice>}

      <div className="mt-4">
        {state === 'loading' && <LoadingBlock />}
        {state === 'error' && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">લોડ થઈ શક્યું નથી.</p>
            <button type="button" className="btn-primary gap-2 mt-3" onClick={() => setKey((k) => k + 1)}><Icon name="refresh" />ફરી પ્રયાસ</button>
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
