import { Icon } from '../../components/Icon'
import { Tabs } from '../../components/ui'
import type { CustomerOption } from './api'
import { money, type CustomerDraft, type CustomerMode } from './cart'

interface Props {
  customers: CustomerOption[]
  value: CustomerDraft
  onChange: (v: CustomerDraft) => void
  disabled: boolean
}

export function CustomerPicker({ customers, value, onChange, disabled }: Props) {
  const picked = customers.find((c) => c.id === value.customerId)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label="Customer">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon name="users" className="size-5 text-brand dark:text-brand-bright" />
        Customer
      </h2>
      <Tabs<CustomerMode>
        className="mt-2"
        label="Customer પ્રકાર"
        value={value.mode}
        onChange={(mode) => !disabled && onChange({ ...value, mode })}
        items={[
          { value: 'walkin', label: 'Walk-in', icon: 'user' },
          { value: 'existing', label: 'હાલનો', icon: 'users' },
          { value: 'new', label: 'નવો', icon: 'plus' },
        ]}
      />

      {value.mode === 'existing' && (
        <div className="mt-3">
          <label htmlFor="cust-select" className="mb-1 block text-sm font-medium">Customer પસંદ કરો</label>
          <select id="cust-select" className="field" value={value.customerId} disabled={disabled}
            onChange={(e) => onChange({ ...value, customerId: e.target.value })}>
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
          <div className="min-w-0">
            <label htmlFor="cust-name" className="mb-1 block text-sm font-medium">નામ</label>
            <input id="cust-name" className="field" value={value.newName} disabled={disabled}
              onChange={(e) => onChange({ ...value, newName: e.target.value })} />
          </div>
          <div className="min-w-0">
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
