import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// Same top of every page: icon, title, branch and the page's main buttons
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: IconName
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright">
          <Icon name={icon} className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="break-words text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </header>
  )
}
