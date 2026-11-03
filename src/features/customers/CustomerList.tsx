import { Avatar } from '../../components/ui'
import { Icon } from '../../components/Icon'
import type { Customer } from './api'
import { BalanceBadge, money } from './BalanceBadge'

interface Props {
  customers: Customer[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CustomerList({ customers, selectedId, onSelect }: Props) {
  return (
    <ul className="space-y-2">
      {customers.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            aria-current={c.id === selectedId}
            className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-slate-900 ${
              c.id === selectedId ? 'border-brand ring-1 ring-brand' : 'border-slate-200 hover:border-brand dark:border-slate-800'
            }`}
          >
            <Avatar name={c.name} />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold leading-tight">{c.name}</span>
              <span className="block truncate text-sm text-slate-600 dark:text-slate-400">
                {c.phone || 'Phone નથી'} · Limit {money.format(c.creditLimit)}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <BalanceBadge balance={c.balance} />
            </span>
            <Icon name="chevronRight" className="size-5 shrink-0 text-slate-500 dark:text-slate-400" />
          </button>
        </li>
      ))}
    </ul>
  )
}
