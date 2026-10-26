type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

// PostgREST returns at most 1000 rows per request, so read page by page.
export async function fetchAll(page: (from: number, to: number) => Page): Promise<unknown[]> {
  const size = 1000
  const out: unknown[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < size) break
  }
  return out
}
