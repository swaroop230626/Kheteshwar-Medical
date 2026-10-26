import type { StatusKey } from './stock'

export const STATUS_META: Record<StatusKey, { label: string; badge: string; border: string }> = {
  expired: {
    label: 'Expired',
    badge: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
    border: 'border-l-red-600',
  },
  expiring: {
    label: '90 દિવસમાં',
    badge: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200',
    border: 'border-l-yellow-500',
  },
  low: {
    label: 'Low stock',
    badge: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
    border: 'border-l-orange-500',
  },
  ok: {
    label: 'OK',
    badge: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
    border: 'border-l-green-600',
  },
}

export function StatusBadges({ statuses }: { statuses: StatusKey[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {statuses.map((s) => (
        <span
          key={s}
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_META[s].badge}`}
        >
          {STATUS_META[s].label}
        </span>
      ))}
    </span>
  )
}
