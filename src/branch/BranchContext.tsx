import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { parseBranches, type Branch } from '../types'

const STORAGE_KEY = 'kheteshwar.branchId'
const NO_BRANCH_ID = '00000000-0000-0000-0000-000000000000'

type BranchState = 'loading' | 'ready' | 'error'

interface BranchValue {
  branches: Branch[]
  selected: Branch | null
  state: BranchState
  canSwitch: boolean
  selectBranch: (id: string) => void
  clearBranch: () => void
  reload: () => void
}

const BranchContext = createContext<BranchValue | null>(null)

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable: selection just won't persist
  }
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [state, setState] = useState<BranchState>('loading')
  const [reloadKey, setReloadKey] = useState(0)

  const role = profile?.role
  const profileBranchId = profile?.branch_id ?? null

  useEffect(() => {
    if (!role) return
    let cancelled = false
    setState('loading')

    const base = supabase.from('branches').select('id, company_id, name, bill_prefix')
    // Owner: all branches RLS allows. Everyone else: only their own branch.
    const scoped = role === 'owner' ? base : base.eq('id', profileBranchId ?? NO_BRANCH_ID)

    void scoped.order('name').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setState('error')
        return
      }
      const list = parseBranches(data)
      const stored = readStored()
      const pick = list.find((b) => b.id === stored) ?? (list.length === 1 ? list[0] : undefined)
      setBranches(list)
      setSelectedId(pick?.id ?? null)
      writeStored(pick?.id ?? null)
      setState('ready')
    })
    return () => {
      cancelled = true
    }
  }, [role, profileBranchId, reloadKey])

  const selectBranch = useCallback((id: string) => {
    setSelectedId(id)
    writeStored(id)
  }, [])

  const clearBranch = useCallback(() => {
    setSelectedId(null)
    writeStored(null)
  }, [])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const selected = useMemo(
    () => branches.find((b) => b.id === selectedId) ?? null,
    [branches, selectedId],
  )

  const value = useMemo<BranchValue>(
    () => ({
      branches,
      selected,
      state,
      canSwitch: role === 'owner' && branches.length > 1,
      selectBranch,
      clearBranch,
      reload,
    }),
    [branches, selected, state, role, selectBranch, clearBranch, reload],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch(): BranchValue {
  const ctx = useContext(BranchContext)
  if (!ctx) throw new Error('useBranch must be used inside BranchProvider')
  return ctx
}
