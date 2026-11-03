import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

// ---------- Empty list / nothing found ----------
export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <span className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icon name={icon} className="size-7" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- Message bars ----------
export type NoticeKind = 'success' | 'error' | 'warning' | 'info'

const NOTICE: Record<NoticeKind, { cls: string; icon: IconName }> = {
  success: { cls: 'border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200', icon: 'check' },
  error: { cls: 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200', icon: 'alert' },
  warning: { cls: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200', icon: 'alert' },
  info: { cls: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200', icon: 'info' },
}

export function Notice({ kind, children, onClose, className = '' }: { kind: NoticeKind; children: ReactNode; onClose?: () => void; className?: string }) {
  const n = NOTICE[kind]
  return (
    <div role={kind === 'success' || kind === 'info' ? 'status' : 'alert'} className={`flex items-start gap-3 rounded-xl border p-3 ${n.cls} ${className}`}>
      <Icon name={n.icon} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 break-words text-sm font-medium">{children}</div>
      {onClose && (
        <button type="button" className="-m-2 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-brand dark:hover:bg-white/10" aria-label="સંદેશ બંધ કરો" onClick={onClose}>
          <Icon name="close" className="size-5" />
        </button>
      )}
    </div>
  )
}

// ---------- Tabs / filter chips ----------
export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: IconName
  badge?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`grid gap-2 ${className}`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(t.value)}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              on
                ? 'border-brand bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.icon && <Icon name={t.icon} className="size-4 shrink-0" />}
            <span className="truncate">{t.label}</span>
            {t.badge !== undefined && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? 'bg-brand text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{t.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ---------- Search box with a magnifier ----------
export function SearchField({ id, label, placeholder, value, onChange }: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
      <input id={id} type="search" className="field pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// ---------- Loading ----------
export function LoadingBlock({ text = 'લોડ થઈ રહ્યું છે…' }: { text?: string }) {
  return (
    <p role="status" className="flex items-center justify-center gap-3 py-10 text-slate-600 dark:text-slate-400">
      <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </p>
  )
}

// ---------- Round initials (customers, staff) ----------
const AVATAR = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300',
]

export function Avatar({ name, className = 'size-10' }: { name: string; className?: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase()
  let h = 0
  for (const ch of name) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 997
  return (
    <span className={`grid shrink-0 place-items-center rounded-full text-sm font-bold ${AVATAR[h % AVATAR.length]} ${className}`} aria-hidden="true">
      {initials}
    </span>
  )
}
