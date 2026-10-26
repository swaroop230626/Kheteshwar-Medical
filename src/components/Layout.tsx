import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { ROLE_LABELS } from '../types'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/medicines', label: 'Medicines', end: false },
  { to: '/purchases', label: 'Purchases', end: false },
  { to: '/billing', label: 'Billing', end: false },
  { to: '/customers', label: 'Customers', end: false },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const { selected, canSwitch, clearBranch } = useBranch()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function switchBranch() {
    clearBranch()
    navigate('/select-branch')
  }

  return (
    <div className="flex min-h-dvh">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar"
        aria-label="મુખ્ય મેનુ"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:visible dark:border-slate-800 dark:bg-slate-900 ${
          open ? 'translate-x-0' : '-translate-x-full invisible'
        }`}
      >
        <div className="flex h-14 items-center border-b border-slate-200 px-4 font-bold dark:border-slate-800">
          Kheteshwar Medical
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center rounded-lg px-3 font-medium focus-visible:outline-2 focus-visible:outline-brand ${
                  isActive
                    ? 'bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {canSwitch && (
          <div className="border-t border-slate-200 p-3 dark:border-slate-800">
            <button type="button" className="btn-ghost w-full" onClick={switchBranch}>
              શાખા બદલો
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <button
            type="button"
            className="btn-ghost min-w-11 border-0 px-0 lg:hidden"
            aria-label="મેનુ ખોલો"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-bold">Kheteshwar Medical</p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">
              {selected?.name}
              {profile ? ` · ${ROLE_LABELS[profile.role]}` : ''}
            </p>
          </div>

          <button
            type="button"
            className="btn-ghost shrink-0"
            onClick={() => void signOut()}
            aria-label="લોગઆઉટ"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span className="hidden sm:inline">લોગઆઉટ</span>
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
