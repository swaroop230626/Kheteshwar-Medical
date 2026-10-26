export const GST_OPTIONS = [0, 5, 12, 18] as const

export type ItemField = 'medicineId' | 'batchNo' | 'expiry' | 'qty' | 'rate' | 'mrp' | 'gst'

export interface ItemDraft {
  key: string
  medicineId: string
  batchNo: string
  expiry: string
  qty: string
  rate: string
  mrp: string
  gst: string
}

export interface FormDraft {
  supplier: string
  invoiceNo: string
  invoiceDate: string
  items: ItemDraft[]
}

export interface FormErrors {
  supplier?: string
  invoiceNo?: string
  invoiceDate?: string
  items: Record<string, Partial<Record<ItemField, string>>>
  general?: string
}

let counter = 0

export function emptyItem(): ItemDraft {
  counter += 1
  return { key: `item-${counter}`, medicineId: '', batchNo: '', expiry: '', qty: '', rate: '', mrp: '', gst: '12' }
}

export function emptyErrors(): FormErrors {
  return { items: {} }
}

export function todayISO(): string {
  const n = new Date()
  const mm = String(n.getMonth() + 1).padStart(2, '0')
  const dd = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${mm}-${dd}`
}

export function parseNum(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100
}

export interface Amounts {
  taxable: number
  gst: number
  total: number
}

// taxable = qty × rate, GST = taxable × GST% / 100, total = taxable + GST
export function lineAmounts(i: ItemDraft): Amounts | null {
  const qty = parseNum(i.qty)
  const rate = parseNum(i.rate)
  const gst = parseNum(i.gst)
  if (qty === null || rate === null || gst === null || qty < 0 || rate < 0) return null
  const taxable = round2(qty * rate)
  const gstAmt = round2((taxable * gst) / 100)
  return { taxable, gst: gstAmt, total: round2(taxable + gstAmt) }
}

export function sumTotals(items: ItemDraft[]): Amounts {
  let taxable = 0
  let gst = 0
  for (const i of items) {
    const a = lineAmounts(i)
    if (a) {
      taxable += a.taxable
      gst += a.gst
    }
  }
  return { taxable: round2(taxable), gst: round2(gst), total: round2(taxable + gst) }
}

export function validate(d: FormDraft, today: string): FormErrors {
  const e: FormErrors = { items: {} }
  if (d.supplier.trim() === '') e.supplier = 'Supplier નામ લખો.'
  if (d.invoiceNo.trim() === '') e.invoiceNo = 'Invoice no લખો.'
  if (d.invoiceDate === '') e.invoiceDate = 'Invoice date પસંદ કરો.'

  const seen = new Set<string>()
  for (const i of d.items) {
    const ie: Partial<Record<ItemField, string>> = {}
    if (i.medicineId === '') ie.medicineId = 'દવા પસંદ કરો.'
    if (i.batchNo.trim() === '') ie.batchNo = 'Batch no લખો.'
    if (i.expiry === '') ie.expiry = 'Expiry date પસંદ કરો.'
    else if (i.expiry < today) ie.expiry = 'Expiry ભૂતકાળની ન હોય.'

    const qty = parseNum(i.qty)
    if (qty === null || !Number.isInteger(qty) || qty < 1) ie.qty = 'Qty 1 કે વધુ પૂર્ણાંક હોવી જોઈએ.'
    const rate = parseNum(i.rate)
    if (rate === null || rate < 0) ie.rate = 'Rate 0 કે વધુ હોવો જોઈએ.'
    const mrp = parseNum(i.mrp)
    if (mrp === null || mrp < 0) ie.mrp = 'MRP 0 કે વધુ હોવો જોઈએ.'
    if (parseNum(i.gst) === null) ie.gst = 'GST % પસંદ કરો.'

    if (i.medicineId !== '' && i.batchNo.trim() !== '') {
      const k = `${i.medicineId}|${i.batchNo.trim().toLowerCase()}`
      if (seen.has(k)) ie.batchNo = 'આ batch ફોર્મમાં બે વાર છે.'
      seen.add(k)
    }
    if (Object.keys(ie).length > 0) e.items[i.key] = ie
  }
  if (d.items.length === 0) e.general = 'ઓછામાં ઓછી એક item ઉમેરો.'
  return e
}

export function hasErrors(e: FormErrors): boolean {
  return (
    Boolean(e.supplier || e.invoiceNo || e.invoiceDate || e.general) ||
    Object.keys(e.items).length > 0
  )
}
