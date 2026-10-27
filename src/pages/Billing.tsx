import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useBranch } from '../branch/BranchContext'
import { createBill } from '../features/billing/api'
import type { SellableBatch } from '../features/billing/api'
import { BillResult, type BillSummary } from '../features/billing/BillResult'
import { CartLines, lineError } from '../features/billing/CartLines'
import {
  PAY_METHODS,
  cartTotals,
  lineAmounts,
  money,
  nextKey,
  parseQty,
  resolvePayments,
  round2,
  type CartLine,
  type CustomerDraft,
  type PayRow,
} from '../features/billing/cart'
import { CustomerPicker } from '../features/billing/CustomerPicker'
import { MedicineList, type Group } from '../features/billing/MedicineList'
import { PaymentEditor } from '../features/billing/PaymentEditor'
import { useBillingData } from '../features/billing/useBillingData'
import { ReturnPanel } from '../features/returns/ReturnPanel'

const CAN_BILL = ['owner', 'branch_manager', 'billing_staff']

const freshCustomer = (): CustomerDraft => ({ mode: 'walkin', customerId: '', newName: '', newPhone: '' })
const freshPay = (): PayRow[] => [{ key: nextKey('pay'), method: 'cash', amount: '' }]

interface Problem {
  message: string
  technical?: string
}

function BillingInner({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { batches, customers, state, reload } = useBillingData(branchId)
  const [lines, setLines] = useState<CartLine[]>([])
  const [customer, setCustomer] = useState<CustomerDraft>(freshCustomer)
  const [pay, setPay] = useState<PayRow[]>(freshPay)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [result, setResult] = useState<BillSummary | null>(null)

  const batchById = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches])
  const batchesByMedicine = useMemo(() => {
    const m = new Map<string, SellableBatch[]>()
    for (const b of batches) m.set(b.medicineId, [...(m.get(b.medicineId) ?? []), b])
    return m // each list already in FEFO order (earliest expiry first)
  }, [batches])
  const groups = useMemo<Group[]>(
    () =>
      [...batchesByMedicine.entries()]
        .map(([medicineId, list]) => ({ medicineId, name: list[0].name, batches: list }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [batchesByMedicine],
  )

  const totals = useMemo(() => cartTotals(lines, batchById), [lines, batchById])
  const inCart = useMemo(() => new Set(lines.map((l) => l.batchId)), [lines])

  function addBatch(b: SellableBatch) {
    setProblem(null)
    setLines((prev) => {
      const existing = prev.find((l) => l.batchId === b.id)
      if (existing) {
        const q = parseQty(existing.qty) ?? 0
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: String(q + 1) } : l))
      }
      return [...prev, { key: nextKey('line'), medicineId: b.medicineId, name: b.name, gstRate: b.gstRate, batchId: b.id, qty: '1' }]
    })
  }

  function resetAll() {
    setLines([])
    setCustomer(freshCustomer())
    setPay(freshPay())
    setProblem(null)
    setResult(null)
  }

  async function save() {
    if (savingRef.current) return
    setProblem(null)

    if (lines.length === 0) return setProblem({ message: 'Cart ખાલી છે. દવા ઉમેરો.' })
    if (lines.some((l) => lineError(l, batchById.get(l.batchId)) !== null)) {
      return setProblem({ message: 'Cart ની લાલ વિગતો સુધારો.' })
    }
    if (customer.mode === 'existing' && customer.customerId === '') return setProblem({ message: 'Customer પસંદ કરો.' })
    if (customer.mode === 'new' && customer.newName.trim() === '') return setProblem({ message: 'નવા customer નું નામ લખો.' })

    const rp = resolvePayments(pay, totals.total)
    if (rp.invalid || rp.sum !== totals.total) {
      return setProblem({ message: `ચૂકવણીનો સરવાળો (${money.format(rp.sum)}) કુલ રકમ (${money.format(totals.total)}) જેટલો હોવો જોઈએ.` })
    }
    const payments = pay
      .map((r, i) => ({ method: r.method, amount: rp.amounts[i] }))
      .filter((p) => p.amount > 0)
    if (payments.some((p) => p.method === 'credit') && customer.mode === 'walkin') {
      return setProblem({ message: 'Credit માટે customer પસંદ કરો અથવા નવો ઉમેરો.' })
    }

    savingRef.current = true
    setSaving(true)
    const res = await createBill({
      branchId,
      customerId: customer.mode === 'existing' ? customer.customerId : null,
      newCustomerName: customer.mode === 'new' ? customer.newName.trim() : null,
      newCustomerPhone: customer.mode === 'new' ? customer.newPhone.trim() : null,
      items: lines.map((l) => ({ batch_id: l.batchId, qty: parseQty(l.qty) ?? 0 })),
      payments,
    })
    savingRef.current = false
    setSaving(false)

    if (!res.ok) {
      setProblem({ message: res.message, technical: res.technical })
      return
    }

    const pickedName = customers.find((c) => c.id === customer.customerId)?.name
    const label = customer.mode === 'existing' ? (pickedName ?? 'Customer') : customer.mode === 'new' ? customer.newName.trim() : 'Walk-in'
    const merged = new Map<string, number>()
    for (const p of payments) {
      const name = PAY_METHODS.find((m) => m.value === p.method)?.label ?? p.method
      merged.set(name, round2((merged.get(name) ?? 0) + p.amount))
    }

    let cgst = 0
    let sgst = 0
    for (const l of lines) {
      const b = batchById.get(l.batchId)
      const q = parseQty(l.qty)
      if (!b || q === null) continue
      const a = lineAmounts(b.mrp, q, l.gstRate)
      cgst += a.cgst
      sgst += a.sgst
    }

    setResult({
      billNo: res.billNo,
      date: new Date().toISOString(),
      cgst: round2(cgst),
      sgst: round2(sgst),
      customer: label,
      items: lines.flatMap((l) => {
        const b = batchById.get(l.batchId)
        const q = parseQty(l.qty)
        if (!b || q === null) return []
        return [{ name: l.name, batchNo: b.batchNo, expiryDate: b.expiryDate, qty: q, mrp: b.mrp, gstRate: l.gstRate, total: lineAmounts(b.mrp, q, l.gstRate).total }]
      }),
      taxable: totals.taxable,
      gst: totals.gst,
      total: res.total,
      payments: [...merged.entries()].map(([name, amount]) => ({ label: name, amount })),
    })
    reload() // stock changed
  }

  if (result) {
    return (
      <BillResult
        bill={result}
        branchId={branchId}
        onNew={() => {
          resetAll()
        }}
      />
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">{branchName}</p>

      {state === 'loading' && <p role="status" className="py-10 text-center text-slate-600 dark:text-slate-400">લોડ થઈ રહ્યું છે…</p>}

      {state === 'error' && (
        <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">ડેટા લોડ થઈ શક્યો નથી.</p>
          <p className="text-sm">ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.</p>
          <button type="button" className="btn-primary mt-3" onClick={reload}>ફરી પ્રયાસ</button>
        </div>
      )}

      {state === 'ready' && (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
          <MedicineList groups={groups} inCart={inCart} onAdd={addBatch} />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Cart ({lines.length})</h2>
            <CartLines
              lines={lines}
              batchById={batchById}
              batchesByMedicine={batchesByMedicine}
              disabled={saving}
              onQty={(key, qty) => setLines((p) => p.map((l) => (l.key === key ? { ...l, qty } : l)))}
              onBatch={(key, batchId) => setLines((p) => p.map((l) => (l.key === key ? { ...l, batchId } : l)))}
              onRemove={(key) => setLines((p) => p.filter((l) => l.key !== key))}
            />

            <CustomerPicker customers={customers} value={customer} onChange={setCustomer} disabled={saving} />

            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-label="Totals">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{money.format(totals.taxable)}</dd></div>
                <div className="flex justify-between"><dt>GST</dt><dd>{money.format(totals.gst)}</dd></div>
                <div className="flex justify-between text-xl font-bold"><dt>કુલ</dt><dd>{money.format(totals.total)}</dd></div>
              </dl>
            </section>

            <PaymentEditor rows={pay} total={totals.total} onChange={setPay} disabled={saving} />

            {problem && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p className="font-semibold">{problem.message}</p>
                {problem.technical && <p className="mt-1 break-words font-mono text-xs">Technical: {problem.technical}</p>}
              </div>
            )}

            <button type="button" className="btn-primary w-full" disabled={saving || lines.length === 0} onClick={() => void save()}>
              {saving ? 'સેવ થઈ રહ્યું છે…' : 'Bill સેવ કરો'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Billing() {
  const { selected } = useBranch()
  const { profile } = useAuth()
  if (!selected) return null
  if (!profile || !CAN_BILL.includes(profile.role)) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">તમારી role થી bill બનાવી શકાતું નથી.</p>
      </div>
    )
  }
  return <BillingTabs branchId={selected.id} branchName={selected.name} />
}

// Both tabs stay mounted, so a half-made cart is not lost when you look at a return.
function BillingTabs({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [tab, setTab] = useState<'bill' | 'return'>('bill')
  const tabs = [
    { v: 'bill', label: 'નવું Bill' },
    { v: 'return', label: 'Bill શોધો અને પરત કરો' },
  ] as const
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:max-w-xl print:hidden" role="group" aria-label="Billing વિભાગ">
        {tabs.map((t) => (
          <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => setTab(t.v)}
            className={`min-h-11 rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              tab === t.v ? 'border-brand bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-bright' : 'border-slate-300 dark:border-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={tab === 'bill' ? '' : 'hidden'}>
        <BillingInner branchId={branchId} branchName={branchName} />
      </div>
      <div className={tab === 'return' ? '' : 'hidden'}>
        <ReturnPanel branchId={branchId} branchName={branchName} />
      </div>
    </div>
  )
}
