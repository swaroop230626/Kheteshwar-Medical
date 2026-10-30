import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { ROLE_LABELS } from '../types'
import { Icon, type IconName } from './Icon'
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: IconName
  end?: boolean
  roles?: string[] // who sees it in the menu (none = everyone)
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'મુખ્ય',
    items: [
      { to: '/', label: 'Dashboard', icon: 'grid', end: true },
      { to: '/billing', label: 'Billing', icon: 'receipt', roles: ['owner', 'branch_manager', 'billing_staff'] },
      { to: '/medicines', label: 'Medicines', icon: 'pill' },
      { to: '/purchases', label: 'Purchases', icon: 'truck' },
      { to: '/customers', label: 'Customers', icon: 'users' },
    ],
  },
  {
    title: 'હિસાબ અને રેકોર્ડ',
    items: [
      { to: '/dues', label: 'બાકી યાદી', icon: 'wallet', roles: ['owner', 'branch_manager', 'billing_staff', 'accountant'] },
      { to: '/reports', label: 'Reports', icon: 'chart', roles: ['owner', 'branch_manager', 'accountant'] },
      { to: '/register', label: 'Schedule Register', icon: 'clipboard', roles: ['owner', 'branch_manager', 'billing_staff', 'accountant'] },
    ],
  },
  {
    title: 'વ્યવસ્થા',
    items: [{ to: '/admin', label: 'Admin', icon: 'settings', roles: ['owner'] }],
  },
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

  const role = profile?.role ?? ''
  const groups = GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex min-h-dvh">
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden print:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="sidebar"
        aria-label="મુખ્ય મેનુ"
        className={`print:hidden fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 lg:visible dark:border-slate-800 dark:bg-slate-900 ${
          open ? 'translate-x-0' : '-translate-x-full invisible'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
              <Icon name="cross" className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-bold">Kheteshwar Medical</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-400">Medical Store</p>
            </div>
          </div>
          <button type="button" className="btn-ghost min-w-11 shrink-0 border-0 px-0 lg:hidden" aria-label="મેનુ બંધ કરો" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="પેજ">
          {groups.map((g) => (
            <div key={g.title} className="mb-5 last:mb-0">
              <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400">{g.title}</p>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                        isActive
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon name={item.icon} className="size-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Branch card */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright">
              <Icon name="store" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{selected?.name}</p>
              <p className="truncate text-xs text-slate-600 dark:text-slate-400">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
          </div>
          {canSwitch && (
            <button type="button" className="btn-ghost mt-2 w-full gap-2" onClick={switchBranch}>
              <Icon name="refresh" />
              શાખા બદલો
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="print:hidden sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-4">
          <button
            type="button"
            className="btn-ghost min-w-11 border-0 px-0 lg:hidden"
            aria-label="મેનુ ખોલો"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" className="size-6" />
          </button>

          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-bold">Kheteshwar Medical</p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">
              {selected?.name}
              {profile ? ` · ${ROLE_LABELS[profile.role]}` : ''}
            </p>
          </div>

          <ThemeToggle />

          <button type="button" className="btn-ghost shrink-0 gap-2" onClick={() => void signOut()} aria-label="લોગઆઉટ">
            <Icon name="logout" />
            <span className="hidden sm:inline">લોગઆઉટ</span>
          </button>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
