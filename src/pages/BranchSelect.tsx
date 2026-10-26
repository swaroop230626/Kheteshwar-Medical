import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { LoadingScreen } from '../components/Screen'
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
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-bold">શાખા પસંદ કરો</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Select branch{profile ? ` · ${ROLE_LABELS[profile.role]}` : ''}
        </p>

        <ul className="mt-4 space-y-2">
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => choose(b.id)}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="min-w-0 truncate font-semibold">{b.name}</span>
                <span className="shrink-0 rounded-md bg-brand-soft px-2 py-1 text-sm font-semibold text-brand-strong dark:bg-slate-800 dark:text-brand-bright">
                  {b.bill_prefix}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button type="button" className="btn-ghost mt-6" onClick={() => void signOut()}>
          લોગઆઉટ (Logout)
        </button>
      </div>
    </main>
  )
}
