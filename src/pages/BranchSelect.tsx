import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { Icon } from '../components/Icon'
import { LoadingScreen } from '../components/Screen'
import { ThemeToggle } from '../components/ThemeToggle'
import { EmptyState } from '../components/ui'
import { ROLE_LABELS } from '../types'

export function BranchSelect() {
  const { profile, signOut } = useAuth()
  const { branches, selectBranch, state } = useBranch()
  const navigate = useNavigate()

  function choose(id: string) {
    selectBranch(id)
    navigate('/', { replace: true })
  }

  if (state === 'loading') return <LoadingScreen />

  return (
    <main className="relative grid min-h-dvh place-items-center bg-gradient-to-b from-brand-soft to-slate-50 p-4 dark:from-slate-900 dark:to-slate-950">
      <div className="absolute right-3 top-3 flex gap-2">
        <ThemeToggle />
        <button type="button" className="btn-ghost gap-2" onClick={() => void signOut()}>
          <Icon name="logout" />
          <span className="hidden sm:inline">લોગઆઉટ</span>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-sm">
            <Icon name="store" className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">શાખા પસંદ કરો</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select branch{profile ? ` · ${ROLE_LABELS[profile.role]}` : ''}
            </p>
          </div>
        </div>

        {branches.length === 0 && <EmptyState icon="store" title="કોઈ શાખા મળી નથી" text="Owner નો સંપર્ક કરો." />}

        <ul className="space-y-3">
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => choose(b.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left shadow-sm hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright">
                  <Icon name="store" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{b.name}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">Bill prefix: {b.bill_prefix}</span>
                </span>
                <Icon name="chevronRight" className="size-5 shrink-0 text-slate-500 dark:text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
