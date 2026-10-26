import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseProfile, type Profile } from '../types'

export type ProfileState = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface BilingualError {
  gu: string
  en: string
}

interface AuthValue {
  session: Session | null
  initializing: boolean
  profile: Profile | null
  profileState: ProfileState
  signIn: (email: string, password: string) => Promise<BilingualError | null>
  signOut: () => Promise<void>
  reloadProfile: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function describeSignInError(code: string | undefined, name: string | undefined): BilingualError {
  if (code === 'invalid_credentials') {
    return { gu: 'ઇમેઇલ અથવા પાસવર્ડ ખોટો છે.', en: 'Incorrect email or password.' }
  }
  if (code === 'email_not_confirmed') {
    return { gu: 'ઇમેઇલ હજી ચકાસાયો નથી.', en: 'Your email is not confirmed yet.' }
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return { gu: 'ઘણા પ્રયાસો થયા. થોડી વાર પછી ફરી પ્રયાસ કરો.', en: 'Too many attempts. Try again in a few minutes.' }
  }
  if (name === 'AuthRetryableFetchError') {
    return { gu: 'ઇન્ટરનેટ કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.', en: 'Check your internet connection and try again.' }
  }
  return { gu: 'લોગિન થઈ શક્યું નહીં. ફરી પ્રયાસ કરો.', en: 'Could not sign in. Please try again.' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [reloadKey, setReloadKey] = useState(0)

  // Restore session on refresh and follow auth changes.
  // Do not call supabase inside the callback itself (can deadlock); effects below react to state.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitializing(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileState('idle')
      return
    }
    let cancelled = false
    setProfileState('loading')
    void supabase
      .from('profiles')
      .select('id, role, branch_id')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setProfile(null)
          setProfileState('error')
          return
        }
        const parsed = parseProfile(data)
        setProfile(parsed)
        setProfileState(parsed ? 'ready' : 'missing')
      })
    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? describeSignInError(error.code, error.name) : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const reloadProfile = useCallback(() => setReloadKey((k) => k + 1), [])

  const value = useMemo<AuthValue>(
    () => ({ session, initializing, profile, profileState, signIn, signOut, reloadProfile }),
    [session, initializing, profile, profileState, signIn, signOut, reloadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
