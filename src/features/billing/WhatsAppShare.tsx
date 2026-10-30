import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatDate } from '../medicines/stock'
import { money } from './cart'
import type { BillSummary } from './BillResult'

// India: 10 digits (or 0 + 10, or 91 + 10) -> 91XXXXXXXXXX. Anything else is rejected.
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `91${d}`
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`
  if (d.length === 12 && d.startsWith('91')) return d
  return null
}

export function billMessage(bill: BillSummary, shop: string, shopPhone: string): string {
  const when = new Date(bill.date)
  const stamp = Number.isNaN(when.getTime()) ? '' : when.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
  const lines = bill.items.map(
    (i, n) => `${n + 1}. ${i.name} (Batch ${i.batchNo}, Exp ${formatDate(i.expiryDate)})\n   ${i.qty} × ${money.format(i.mrp)} + GST ${i.gstRate}% = ${money.format(i.total)}`,
  )
  return [
    `*${shop}*`,
    shopPhone ? `Phone: ${shopPhone}` : '',
    `Bill: *${bill.billNo}*`,
    stamp ? `તારીખ: ${stamp}` : '',
    '',
    ...lines,
    '',
    `Subtotal: ${money.format(bill.taxable)}`,
    `GST: ${money.format(bill.gst)}`,
    `*કુલ: ${money.format(bill.total)}*`,
    '',
    ...bill.payments.map((p) => `${p.label}: ${money.format(p.amount)}`),
    '',
    'આભાર! ફરી પધારજો.',
  ]
    .filter((l, i, a) => !(l === '' && (i === 0 || a[i - 1] === '')))
    .join('\n')
}

interface Props {
  bill: BillSummary
  shopName: string
  shopPhone: string
}

// WhatsApp click-to-chat: opens WhatsApp with the bill written in the message box; you press Send.
export function WhatsAppShare({ bill, shopName, shopPhone }: Props) {
  const [phone, setPhone] = useState(bill.phone)
  const [error, setError] = useState<string | null>(null)

  function send() {
    setError(null)
    const text = encodeURIComponent(billMessage(bill, shopName, shopPhone))
    if (phone.trim() === '') {
      // no number: WhatsApp lets you choose the contact
      window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
      return
    }
    const num = normalizePhone(phone)
    if (num === null) return setError('Phone નંબર 10 અંકનો લખો (દા.ત. 98XXXXXXXX).')
    window.open(`https://wa.me/${num}?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="WhatsApp">
      <h2 className="font-semibold">WhatsApp પર bill મોકલો</h2>
      <div className="max-w-sm">
        <label htmlFor="wa-phone" className="mb-1 block text-sm font-medium">Customer નો mobile નંબર</label>
        <input id="wa-phone" inputMode="tel" className="field" placeholder="ખાલી રાખો તો WhatsApp માં contact પસંદ કરશો" value={phone}
          onChange={(e) => setPhone(e.target.value)} />
        {error && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </div>
      <button type="button" className="btn-primary gap-2" onClick={send}><Icon name="message" />WhatsApp ખોલો</button>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        WhatsApp ખૂલશે અને bill લખાયેલું હશે, તમારે ફક્ત Send દબાવવાનું. (આ સાદી રીત છે, automatic મોકલવા માટે WhatsApp Business API જોઈએ, જે paid છે.)
      </p>
    </section>
  )
}
