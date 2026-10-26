import { useBranch } from '../branch/BranchContext'

const CARDS = [
  { title: 'Today sales', hint: 'આજનું વેચાણ', accent: 'border-l-brand' },
  { title: 'Expiring stock', hint: 'એક્સપાયર થનાર સ્ટોક', accent: 'border-l-amber-500' },
  { title: 'Low stock', hint: 'ઓછો સ્ટોક', accent: 'border-l-orange-500' },
  { title: 'Credit balance', hint: 'ઉધાર બાકી', accent: 'border-l-sky-500' },
]

export function Dashboard() {
  const { selected } = useBranch()

  return (
    <div>
      <h1 className="text-2xl font-bold">ડેશબોર્ડ</h1>
      {selected && (
        <p className="mt-1 text-slate-600 dark:text-slate-400">{selected.name}</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <section
            key={c.title}
            className={`min-w-0 rounded-xl border border-l-4 border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${c.accent}`}
          >
            <h2 className="font-semibold">{c.title}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{c.hint}</p>
            <p className="mt-4 text-3xl font-bold text-slate-400 dark:text-slate-600" aria-label="ડેટા નથી">
              —
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">ડેટા હજી જોડાયો નથી</p>
          </section>
        ))}
      </div>
    </div>
  )
}
