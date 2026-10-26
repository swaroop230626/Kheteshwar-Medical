import { formatDate } from '../medicines/stock'
import { money } from './cart'

export interface BillSummary {
  billNo: string
  customer: string
  items: { name: string; batchNo: string; expiryDate: string; qty: number; mrp: number; gstRate: number; total: number }[]
  taxable: number
  gst: number
  total: number
  payments: { label: string; amount: number }[]
}

export function BillResult({ bill, onNew }: { bill: BillSummary; onNew: () => void }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
        <p className="font-semibold">Bill સફળતાથી સેવ થયું. સ્ટોક ઘટી ગયો છે.</p>
        <p className="text-2xl font-bold">{bill.billNo}</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">Customer: <span className="font-medium text-slate-900 dark:text-slate-100">{bill.customer}</span></p>
        <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          {bill.items.map((i) => (
            <li key={`${i.name}-${i.batchNo}`} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="break-words font-semibold">{i.name}</p>
                <p className="text-slate-600 dark:text-slate-400">
                  Batch {i.batchNo} · Exp {formatDate(i.expiryDate)} · {i.qty} × {money.format(i.mrp)} · GST {i.gstRate}%
                </p>
              </div>
              <p className="shrink-0 font-semibold">{money.format(i.total)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money.format(bill.taxable)}</dd></div>
          <div className="flex justify-between"><dt>GST</dt><dd>{money.format(bill.gst)}</dd></div>
          <div className="flex justify-between text-lg font-bold"><dt>કુલ</dt><dd>{money.format(bill.total)}</dd></div>
        </dl>
        <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          {bill.payments.map((p) => (
            <li key={p.label} className="flex justify-between"><span>{p.label}</span><span>{money.format(p.amount)}</span></li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn-primary w-full sm:w-auto" onClick={onNew}>+ નવું Bill</button>
    </div>
  )
}
