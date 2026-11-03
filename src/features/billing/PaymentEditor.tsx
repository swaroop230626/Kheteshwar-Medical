import { Icon, type IconName } from '../../components/Icon'
import { PAY_METHODS, money, nextKey, resolvePayments, round2, type PayMethod, type PayRow } from './cart'

interface Props {
  rows: PayRow[]
  total: number
  onChange: (rows: PayRow[]) => void
  disabled: boolean
}

const METHOD_ICON: Record<PayMethod, IconName> = {
  cash: 'banknote',
  upi: 'phone',
  card: 'card',
  credit: 'wallet',
}

export function PaymentEditor({ rows, total, onChange, disabled }: Props) {
  const resolved = resolvePayments(rows, total)
  const diff = round2(total - resolved.sum)
  const good = diff === 0 && !resolved.invalid

  function patch(key: string, p: Partial<PayRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Payment">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon name="wallet" className="size-5 text-brand dark:text-brand-bright" />
        Payment
      </h2>

      <div className="mt-3 space-y-3">
        {rows.map((r, idx) => (
          <div key={r.key} className="grid grid-cols-[auto_1fr_1fr_auto] items-end gap-2">
            <span className="mb-1 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand-strong dark:bg-brand/25 dark:text-brand-bright" aria-hidden="true">
              <Icon name={METHOD_ICON[r.method]} />
            </span>
            <div className="min-w-0">
              <label htmlFor={`${r.key}-m`} className="mb-1 block text-sm font-medium">રીત</label>
              <select id={`${r.key}-m`} className="field" value={r.method} disabled={disabled}
                onChange={(e) => patch(r.key, { method: e.target.value as PayMethod })}>
                {PAY_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor={`${r.key}-a`} className="mb-1 block text-sm font-medium">રકમ (₹)</label>
              <input id={`${r.key}-a`} inputMode="decimal" className="field" disabled={disabled}
                placeholder={resolved.amounts[idx] > 0 ? String(resolved.amounts[idx]) : '0'}
                value={r.amount} onChange={(e) => patch(r.key, { amount: e.target.value })} />
            </div>
            {rows.length > 1 ? (
              <button type="button" className="btn-ghost mb-0 min-w-11 px-0" disabled={disabled}
                aria-label="ચૂકવણી દૂર કરો" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
                <Icon name="trash" />
              </button>
            ) : (
              <span className="min-w-11" />
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn-ghost mt-3 gap-2" disabled={disabled}
        onClick={() => onChange([...rows, { key: nextKey('pay'), method: 'upi', amount: '' }])}>
        <Icon name="plus" />
        બીજી રીત (split)
      </button>

      <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${good ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-300'}`}>
        <Icon name={good ? 'check' : 'alert'} className="size-4 shrink-0" />
        {resolved.invalid
          ? 'રકમ ખોટી છે.'
          : diff === 0
            ? `ચૂકવણી પૂરી: ${money.format(resolved.sum)}`
            : diff > 0
              ? `ઓછા: ${money.format(diff)}`
              : `વધારે: ${money.format(-diff)}`}
      </p>
    </section>
  )
}
