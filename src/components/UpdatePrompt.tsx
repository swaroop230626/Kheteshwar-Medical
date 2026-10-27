import { useRegisterSW } from 'virtual:pwa-register/react'

// Shows "new version available" when a new build has been deployed.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed app can stay open for days, so look for a new version every hour
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <p className="font-semibold">નવું version ઉપલબ્ધ છે.</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">Reload કરો. ચાલુ bill હોય તો પહેલાં તે સેવ કરી લો.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" onClick={() => void updateServiceWorker(true)}>
          Reload કરો
        </button>
        <button type="button" className="btn-ghost" onClick={() => setNeedRefresh(false)}>
          પછી
        </button>
      </div>
    </div>
  )
}
