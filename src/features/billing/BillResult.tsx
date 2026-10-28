import { useState } from 'react'
import { formatDate } from '../medicines/stock'
import { money } from './cart'
import { PrintBill, type Paper } from './PrintBill'

export interface BillSummary {
  billNo: string
  date: string // ISO time the bill was saved
  customer: string
  items: { name: string; batchNo: string; expiryDate: string; qty: number; mrp: number; gstRate: number; total: number }[]
  taxable: number
  cgst: number
  sgst: number
  gst: number
  total: number
  payments: { label: string; amount: number }[]
}

export function BillResult({ bill, branchId, warning, onNew }: { bill: BillSummary; branchId: string; warning?: string; onNew: () => void }) {
  const [paper, setPaper] = useState<Paper>('thermal')

  return (
    <>
      {/* paper size used by the browser's print dialog */}
      <style>{`@media print { @page { size: ${paper === 'a4' ? 'A4' : '80mm auto'}; margin: 4mm; } }`}</style>

      <div className="mx-auto max-w-2xl space-y-4 print:hidden">
        <div role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <p className="font-semibold">Bill સફળતાથી સેવ થયું. સ્ટોક ઘટી ગયો છે.</p>
          <p className="text-2xl font-bold">{bill.billNo}</p>
        </div>

        {warning && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{warning}</p>
        )}

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

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Print">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Paper size">
            {([
              { v: 'thermal', label: 'Receipt (80mm)' },
              { v: 'a4', label: 'A4' },
            ] as const).map((o) => (
              <button key={o.v} type="button" aria-pressed={paper === o.v} onClick={() => setPaper(o.v)}
                className={`min-h-11 rounded-lg border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  paper === o.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => window.print()}>Print bill</button>
            <button type="button" className="btn-ghost" onClick={onNew}>+ નવું Bill</button>
          </div>
        </section>
      </div>

      <PrintBill bill={bill} branchId={branchId} paper={paper} />
    </>
  )
}
