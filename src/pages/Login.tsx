import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type BilingualError } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { ThemeToggle } from '../components/ThemeToggle'
import { Notice } from '../components/ui'

export function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<BilingualError | null>(null)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn(email.trim(), password)
    if (result) setError(result)
    setLoading(false)
  }

  return (
    <main className="relative grid min-h-dvh place-items-center bg-gradient-to-b from-brand-soft to-slate-50 p-4 dark:from-slate-900 dark:to-slate-950">
      <div className="absolute right-3 top-3">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-gradient-to-br from-brand-strong to-brand px-6 py-7 text-white">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15">
            <Icon name="cross" className="size-8" />
          </span>
          <h1 className="mt-4 text-2xl font-bold leading-tight">Kheteshwar Medical</h1>
          <p className="mt-1 text-sm text-white/85">સ્ટોક, બિલિંગ અને હિસાબ, એક જ જગ્યાએ</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">લોગિન કરો</h2>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">ઇમેઇલ (Email)</label>
            <div className="relative">
              <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input id="email" type="email" inputMode="email" autoComplete="email" required className="field pl-10"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">પાસવર્ડ (Password)</label>
            <div className="relative">
              <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required className="field px-10"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="absolute right-0 top-0 grid size-11 place-items-center rounded-lg text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand dark:text-slate-400 dark:hover:text-slate-100"
                aria-label={show ? 'પાસવર્ડ છુપાવો' : 'પાસવર્ડ બતાવો'} aria-pressed={show} onClick={() => setShow((v) => !v)}>
                <Icon name={show ? 'eyeOff' : 'eye'} />
              </button>
            </div>
          </div>

          {error && (
            <Notice kind="error">
              <p>{error.gu}</p>
              <p>{error.en}</p>
            </Notice>
          )}

          <button type="submit" className="btn-primary w-full gap-2" disabled={loading}>
            {loading && <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none" aria-hidden="true" />}
            {loading ? 'લોગિન થઈ રહ્યું છે…' : 'લોગિન (Login)'}
          </button>
        </form>
      </div>
    </main>
  )
}
