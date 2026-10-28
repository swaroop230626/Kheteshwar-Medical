export type Cell = string | number

function cell(v: Cell): string {
  if (typeof v === 'number') return String(v)
  // a text cell starting with = + - @ could be run as a formula by Excel; make it plain text
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// Excel opens this directly. The BOM makes Gujarati text and ₹ show correctly.
export function downloadCsv(filename: string, rows: Cell[][]): void {
  const text = '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeName(s: string): string {
  const t = s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return t === '' ? 'branch' : t
}
