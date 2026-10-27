import { PAY_METHODS, money, nextKey, resolvePayments, round2, type PayMethod, type PayRow } from './cart'

interface Props {
  rows: PayRow[]
  total: number
  onChange: (rows: PayRow[]) => void
  disabled: boolean
}

export function PaymentEditor({ rows, total, onChange, disabled }: Props) {
  const resolved = resolvePayments(rows, total)
  const diff = round2(total - resolved.sum)

  function patch(key: string, p: Partial<PayRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Payment">
      <h2 className="font-semibold">Payment</h2>
      <div className="mt-3 space-y-3">
        {rows.map((r, idx) => (
          <div key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
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
              <button type="button" className="btn-ghost min-w-11 px-0" disabled={disabled}
                aria-label="ચૂકવણી દૂર કરો" onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>✕</button>
            ) : (
              <span className="min-w-11" />
            )}
          </div>
        ))}
      </div>

      <button type="button" className="btn-ghost mt-3" disabled={disabled}
        onClick={() => onChange([...rows, { key: nextKey('pay'), method: 'upi', amount: '' }])}>
        + બીજી રીત (split)
      </button>

      <p className={`mt-3 text-sm font-medium ${diff === 0 && !resolved.invalid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-300'}`}>
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
