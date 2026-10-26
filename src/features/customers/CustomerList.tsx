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
            className={`block min-h-11 w-full rounded-xl border bg-white p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:bg-slate-900 ${
              c.id === selectedId ? 'border-brand' : 'border-slate-200 hover:border-brand dark:border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words font-semibold">{c.name}</p>
              <BalanceBadge balance={c.balance} />
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {c.phone || 'Phone નથી'} · Credit limit {money.format(c.creditLimit)}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
