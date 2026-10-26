export const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

// Orange when something is due, green when zero. Text is shown too, not colour alone.
export function BalanceBadge({ balance }: { balance: number }) {
  const due = balance > 0
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${
        due
          ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200'
          : 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200'
      }`}
    >
      {due ? `બાકી ${money.format(balance)}` : 'બાકી નથી'}
    </span>
  )
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="લોડ થઈ રહ્યું છે" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-800" />
      ))}
    </div>
  )
}
