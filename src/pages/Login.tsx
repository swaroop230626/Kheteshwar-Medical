import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type BilingualError } from '../auth/AuthContext'

export function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span
            className="grid size-11 place-items-center rounded-xl bg-brand text-2xl font-bold text-white"
            aria-hidden="true"
          >
            +
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight">Kheteshwar Medical</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">તમારા એકાઉન્ટથી લોગિન કરો</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              ઇમેઇલ (Email)
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              પાસવર્ડ (Password)
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              <p>{error.gu}</p>
              <p>{error.en}</p>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'લોગિન થઈ રહ્યું છે…' : 'લોગિન (Login)'}
          </button>
        </form>
      </div>
    </main>
  )
}
