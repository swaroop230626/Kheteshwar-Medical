import type { CustomerOption } from './api'
import { money, type CustomerDraft, type CustomerMode } from './cart'

const MODES: { value: CustomerMode; label: string }[] = [
  { value: 'walkin', label: 'Walk-in' },
  { value: 'existing', label: 'હાલનો' },
  { value: 'new', label: 'નવો' },
]

interface Props {
  customers: CustomerOption[]
  value: CustomerDraft
  onChange: (v: CustomerDraft) => void
  disabled: boolean
}

export function CustomerPicker({ customers, value, onChange, disabled }: Props) {
  const picked = customers.find((c) => c.id === value.customerId)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Customer">
      <h2 className="font-semibold">Customer</h2>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Customer પ્રકાર">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            disabled={disabled}
            aria-pressed={value.mode === m.value}
            onClick={() => onChange({ ...value, mode: m.value })}
            className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              value.mode === m.value
                ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {value.mode === 'existing' && (
        <div className="mt-3">
          <label htmlFor="cust-select" className="mb-1 block text-sm font-medium">Customer પસંદ કરો</label>
          <select
            id="cust-select"
            className="field"
            value={value.customerId}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, customerId: e.target.value })}
          >
            <option value="">— પસંદ કરો —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ''}
              </option>
            ))}
          </select>
          {picked && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              બાકી: {money.format(picked.balance)} · Credit limit: {money.format(picked.creditLimit)}
            </p>
          )}
          {customers.length === 0 && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">આ શાખામાં હજી કોઈ customer નથી. "નવો" પસંદ કરો.</p>
          )}
        </div>
      )}

      {value.mode === 'new' && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="cust-name" className="mb-1 block text-sm font-medium">નામ</label>
            <input id="cust-name" className="field" value={value.newName} disabled={disabled}
              onChange={(e) => onChange({ ...value, newName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="cust-phone" className="mb-1 block text-sm font-medium">Phone (વૈકલ્પિક)</label>
            <input id="cust-phone" inputMode="tel" className="field" value={value.newPhone} disabled={disabled}
              onChange={(e) => onChange({ ...value, newPhone: e.target.value })} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 sm:col-span-2">
            નવા customer ની credit limit ₹0 હોય છે, એટલે Credit માં વેચાણ થઈ શકશે નહીં.
          </p>
        </div>
      )}

      {value.mode === 'walkin' && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Customer વગર Cash / UPI / Card bill. Credit માટે customer જોઈએ.</p>
      )}
    </section>
  )
}
