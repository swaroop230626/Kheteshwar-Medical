import { money } from '../billing/cart'
import { useShop, type Paper } from '../billing/PrintBill'

export interface ReturnReceipt {
  returnNo: string
  billNo: string
  customer: string
  date: string // ISO time the return was saved
  reason: string
  items: { name: string; batchNo: string; qty: number; refund: number }[]
  total: number
  method: string // 'cash' or 'credit'
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

// Only visible when printing. Always dark text on white, whatever the screen theme is.
export function PrintReturn({ receipt, branchId, paper }: { receipt: ReturnReceipt; branchId: string; paper: Paper }) {
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

        <p className="my-1 border-y border-dashed border-black py-1 text-center font-bold">SALES RETURN</p>

        <div className="flex justify-between gap-2">
          <span>Return: <b>{receipt.returnNo}</b></span>
          <span>{when(receipt.date)}</span>
        </div>
        <p>Original bill: {receipt.billNo}</p>
        <p>Customer: {receipt.customer}</p>
        {receipt.reason && <p>કારણ: {receipt.reason}</p>}

        <div className="mt-1 border-t border-black">
          {receipt.items.map((i) => (
            <div key={`${i.name}-${i.batchNo}`} className="border-b border-dotted border-black py-1">
              <p className="font-semibold">{i.name}</p>
              <div className="flex justify-between gap-2">
                <span>Batch {i.batchNo || '—'} · પરત {i.qty}</span>
                <span>{money.format(i.refund)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-1 flex justify-between border-t border-black pt-1 text-sm font-bold">
          <span>TOTAL REFUND</span>
          <span>{money.format(receipt.total)}</span>
        </div>
        <p className="mt-1">
          {receipt.method === 'credit' ? 'Customer ના balance માંથી ઘટાડ્યા (રોકડ નથી આપી)' : 'Cash refund આપ્યું'}
        </p>

        <p className="mt-2 text-center">આભાર!</p>
      </div>
    </div>
  )
}
