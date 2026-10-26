import type { ReactNode } from 'react'

export function LoadingScreen({ label = 'લોડ થઈ રહ્યું છે…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6" role="status">
      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
        <span
          className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </div>
  )
}

export function MessageScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 space-y-4 text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </div>
  )
}
