import { supabase } from '../../lib/supabase'
import { isRecord, toNum } from '../../lib/parse'

const BUCKET = 'prescriptions'
export const MAX_PHOTOS = 3

export interface PhotoFile {
  id: string
  name: string
  url: string // short-lived signed link
}

export interface UploadResult {
  uploaded: number
  failed: number
  message: string // first problem, for display
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Phone photos are 3-8 MB. Shrink to about 1600px JPEG before uploading.
export async function compressImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8))
    return blob ?? file
  } catch {
    return file
  }
}

export async function uploadPrescriptions(branchId: string, billId: string, files: File[]): Promise<UploadResult> {
  let uploaded = 0
  let failed = 0
  let message = ''
  for (const file of files) {
    try {
      if (!file.type.startsWith('image/')) throw new Error('ફક્ત ફોટા (image) ચાલશે.')
      const blob = await compressImage(file)
      if (blob.size > 5 * 1024 * 1024) throw new Error('ફોટો 5 MB થી મોટો છે.')
      const path = `${branchId}/${billId}/${uid()}.jpg`

      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
      if (up.error) throw new Error(up.error.message)

      const ins = await supabase.from('prescription_files').insert({
        branch_id: branchId,
        bill_id: billId,
        storage_path: path,
        file_name: file.name.slice(0, 120),
        size_bytes: blob.size,
      })
      if (ins.error) throw new Error(ins.error.message)
      uploaded += 1
    } catch (e) {
      failed += 1
      if (message === '') message = e instanceof Error ? e.message : String(e)
    }
  }
  return { uploaded, failed, message }
}

export async function listPrescriptions(billId: string): Promise<PhotoFile[]> {
  const { data, error } = await supabase
    .from('prescription_files')
    .select('id, storage_path, file_name')
    .eq('bill_id', billId)
    .order('created_at')
  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as unknown[]).flatMap((r) =>
    isRecord(r) && typeof r.id === 'string' && typeof r.storage_path === 'string'
      ? [{ id: r.id, path: r.storage_path, name: typeof r.file_name === 'string' ? r.file_name : 'ફોટો' }]
      : [],
  )
  if (rows.length === 0) return []

  const signed = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 600)
  if (signed.error) throw new Error(signed.error.message)
  const urlByPath = new Map<string, string>()
  for (const s of signed.data ?? []) {
    if (typeof s.path === 'string' && typeof s.signedUrl === 'string') urlByPath.set(s.path, s.signedUrl)
  }
  return rows.flatMap((r) => {
    const url = urlByPath.get(r.path)
    return url ? [{ id: r.id, name: r.name, url }] : []
  })
}

export function countOf(v: unknown): number {
  return Array.isArray(v) ? v.length : toNum(v) ?? 0
}
