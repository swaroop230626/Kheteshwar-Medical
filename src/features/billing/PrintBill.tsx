import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isRecord } from '../../lib/parse'
import { formatDate } from '../medicines/stock'
import { money } from './cart'
import type { BillSummary } from './BillResult'

export type Paper = 'thermal' | 'a4'

interface Shop {
  name: string
  gstNo: string
  licence: string
  address: string
  phone: string
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

// Shop details for the bill header. If anything is missing the header just shows less.
function useShop(branchId: string): Shop | null {
  const [shop, setShop] = useState<Shop | null>(null)
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('branches')
      .select('name, gst_no, drug_licence_no, address, phone')
      .eq('id', branchId)
      .maybeSingle()
      .then(({ data }) => {
        const r: unknown = data
        if (cancelled || !isRecord(r)) return
        setShop({ name: text(r.name), gstNo: text(r.gst_no), licence: text(r.drug_licence_no), address: text(r.address), phone: text(r.phone) })
      })
    return () => {
      cancelled = true
    }
  }, [branchId])
  return shop
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

// Only visible when printing. Always dark text on white, whatever the screen theme is.
export function PrintBill({ bill, branchId, paper }: { bill: BillSummary; branchId: string; paper: Paper }) {
  const shop = useShop(branchId)
  const thermal = paper === 'thermal'

  return (
    <div className="hidden print:block">
      <div className={`mx-auto bg-white text-black ${thermal ? 'w-[72mm] text-[11px] leading-snug' : 'w-full max-w-[190mm] text-[13px] leading-normal'}`}>
        <div className="text-center">
          <p className="text-base font-bold">{shop?.name || 'Kheteshwar Medical'}</p>
          {shop?.address && <p>{shop.address}</p>}
          {shop?.phone && <p>Phone: {shop.phone}</p>}
          {shop?.gstNo && <p>GSTIN: {shop.gstNo}</p>}
          {shop?.licence && <p>Drug Licence: {shop.licence}</p>}
        </div>

        <p className="my-1 border-y border-dashed border-black py-1 text-center font-bold">TAX INVOICE</p>

        <div className="flex justify-between gap-2">
          <span>Bill: <b>{bill.billNo}</b></span>
          <span>{when(bill.date)}</span>
        </div>
        <p>Customer: {bill.customer}</p>

        <div className="mt-1 border-t border-black">
          {bill.items.map((i) => (
            <div key={`${i.name}-${i.batchNo}`} className="border-b border-dotted border-black py-1">
              <p className="font-semibold">{i.name}</p>
              <div className="flex justify-between gap-2">
                <span>{i.qty} × {money.format(i.mrp)} · GST {i.gstRate}%</span>
                <span>{money.format(i.total)}</span>
              </div>
              <p>Batch {i.batchNo} · Exp {formatDate(i.expiryDate)}</p>
            </div>
          ))}
        </div>

        <div className="mt-1 space-y-0.5">
          <div className="flex justify-between"><span>Subtotal</span><span>{money.format(bill.taxable)}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>{money.format(bill.cgst)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>{money.format(bill.sgst)}</span></div>
          <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
            <span>TOTAL</span><span>{money.format(bill.total)}</span>
          </div>
        </div>

        <div className="mt-1 border-t border-dashed border-black pt-1">
          {bill.payments.map((p) => (
            <div key={p.label} className="flex justify-between"><span>{p.label}</span><span>{money.format(p.amount)}</span></div>
          ))}
        </div>

        <p className="mt-2 text-center">આભાર! ફરી પધારજો.</p>
      </div>
    </div>
  )
}
