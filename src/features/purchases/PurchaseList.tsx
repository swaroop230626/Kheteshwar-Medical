import { Fragment, useState } from 'react'
import { formatDate } from '../medicines/stock'
import type { Grn } from './api'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function ItemsDetail({ grn, names }: { grn: Grn; names: Map<string, string> }) {
  if (grn.items.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">આ purchase માં કોઈ item નથી.</p>
  }
  return (
    <>
      {/* Mobile: item blocks */}
      <ul className="space-y-2 md:hidden">
        {grn.items.map((it) => (
          <li key={it.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <p className="font-semibold">{names.get(it.medicineId) ?? 'અજ્ઞાત દવા'}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              <div><dt className="text-slate-600 dark:text-slate-400">Batch</dt><dd className="break-all">{it.batchNo}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Expiry</dt><dd>{formatDate(it.expiryDate)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Qty</dt><dd>{it.qty}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Rate</dt><dd>{money.format(it.purchaseRate)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">GST</dt><dd>{it.gstRate}%</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Line total</dt><dd className="font-semibold">{money.format(it.lineTotal)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: item table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
          <tr>
            <th scope="col" className="py-2 pr-3">દવા</th>
            <th scope="col" className="py-2 pr-3">Batch</th>
            <th scope="col" className="py-2 pr-3">Expiry</th>
            <th scope="col" className="py-2 pr-3 text-right">Qty</th>
            <th scope="col" className="py-2 pr-3 text-right">Rate</th>
            <th scope="col" className="py-2 pr-3 text-right">GST %</th>
            <th scope="col" className="py-2 text-right">Line total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {grn.items.map((it) => (
            <tr key={it.id}>
              <td className="py-2 pr-3 font-medium">{names.get(it.medicineId) ?? 'અજ્ઞાત દવા'}</td>
              <td className="break-all py-2 pr-3">{it.batchNo}</td>
              <td className="py-2 pr-3">{formatDate(it.expiryDate)}</td>
              <td className="py-2 pr-3 text-right">{it.qty}</td>
              <td className="py-2 pr-3 text-right">{money.format(it.purchaseRate)}</td>
              <td className="py-2 pr-3 text-right">{it.gstRate}%</td>
              <td className="py-2 text-right font-semibold">{money.format(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function PurchaseList({ grns, names }: { grns: Grn[]; names: Map<string, string> }) {
  const [open, setOpen] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      {/* Mobile: cards */}
      <ul className="space-y-3 md:hidden">
        {grns.map((g) => {
          const isOpen = open.has(g.id)
          return (
            <li key={g.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{g.supplier}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{g.grnNo}</p>
                </div>
                <p className="shrink-0 text-lg font-bold">{money.format(g.total)}</p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 text-sm">
                <div><dt className="text-slate-600 dark:text-slate-400">Invoice no</dt><dd className="break-all font-medium">{g.invoiceNo}</dd></div>
                <div><dt className="text-slate-600 dark:text-slate-400">Invoice date</dt><dd className="font-medium">{formatDate(g.invoiceDate)}</dd></div>
              </dl>
              <button
                type="button"
                className="btn-ghost mt-3 w-full justify-between"
                aria-expanded={isOpen}
                onClick={() => toggle(g.id)}
              >
                <span>Items ({g.items.length})</span>
                <Chevron open={isOpen} />
              </button>
              {isOpen && <div className="mt-3"><ItemsDetail grn={g} names={names} /></div>}
            </li>
          )
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th scope="col" className="w-12 px-3 py-3"><span className="sr-only">Items</span></th>
              <th scope="col" className="px-3 py-3">GRN no</th>
              <th scope="col" className="px-3 py-3">Supplier</th>
              <th scope="col" className="px-3 py-3">Invoice no</th>
              <th scope="col" className="px-3 py-3">Invoice date</th>
              <th scope="col" className="px-3 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {grns.map((g) => {
              const isOpen = open.has(g.id)
              return (
                <Fragment key={g.id}>
                  <tr className="border-t border-slate-200 align-middle dark:border-slate-800">
                    <td className="px-3 py-1">
                      <button
                        type="button"
                        className="btn-ghost min-w-11 border-0 px-0"
                        aria-expanded={isOpen}
                        aria-label={`${g.grnNo} ની items ${isOpen ? 'બંધ કરો' : 'ખોલો'}`}
                        onClick={() => toggle(g.id)}
                      >
                        <Chevron open={isOpen} />
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium">{g.grnNo}</td>
                    <td className="px-3 py-3 font-semibold">{g.supplier}</td>
                    <td className="break-all px-3 py-3">{g.invoiceNo}</td>
                    <td className="px-3 py-3">{formatDate(g.invoiceDate)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{money.format(g.total)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50 dark:bg-slate-950">
                      <td />
                      <td colSpan={5} className="px-3 py-3"><ItemsDetail grn={g} names={names} /></td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
