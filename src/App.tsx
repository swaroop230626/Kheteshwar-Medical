import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { BranchProvider, useBranch } from './branch/BranchContext'
import { Layout } from './components/Layout'
import { LoadingScreen, MessageScreen } from './components/Screen'
import { BranchSelect } from './pages/BranchSelect'
import { Billing } from './pages/Billing'
import { Customers } from './pages/Customers'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import { Medicines } from './pages/Medicines'
import { Purchases } from './pages/Purchases'
import { Reports } from './pages/Reports'

// Needs a session and a readable profile.
function RequireAuth() {
  const { session, initializing, profileState, signOut, reloadProfile } = useAuth()

  if (initializing) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  if (profileState === 'idle' || profileState === 'loading') return <LoadingScreen />

  if (profileState === 'missing') {
    return (
      <MessageScreen title="Account set up નથી">
        <p>Account set up નથી, owner નો સંપર્ક કરો.</p>
        <button type="button" className="btn-ghost" onClick={() => void signOut()}>
          લોગઆઉટ (Logout)
        </button>
      </MessageScreen>
    )
  }
  if (profileState === 'error') {
    return (
      <MessageScreen title="પ્રોફાઇલ લોડ થઈ નથી">
        <p>ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો. (Could not load your profile.)</p>
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={reloadProfile}>
            ફરી પ્રયાસ
          </button>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            લોગઆઉટ
          </button>
        </div>
      </MessageScreen>
    )
  }

  return (
    <BranchProvider>
      <Outlet />
    </BranchProvider>
  )
}

// Needs a selected branch; otherwise sends the user to branch selection.
function RequireBranch() {
  const { state, branches, selected, reload } = useBranch()
  const { signOut } = useAuth()

  if (state === 'loading') return <LoadingScreen />
  if (state === 'error') {
    return (
      <MessageScreen title="શાખાઓ લોડ થઈ નથી">
        <p>Could not load branches. ફરી પ્રયાસ કરો.</p>
        <button type="button" className="btn-primary" onClick={reload}>
          ફરી પ્રયાસ
        </button>
      </MessageScreen>
    )
  }
  if (branches.length === 0) {
    return (
      <MessageScreen title="કોઈ શાખા મળી નથી">
        <p>તમારા account સાથે કોઈ શાખા જોડાયેલી નથી. Owner નો સંપર્ક કરો.</p>
        <button type="button" className="btn-ghost" onClick={() => void signOut()}>
          લોગઆઉટ (Logout)
        </button>
      </MessageScreen>
    )
  }
  if (!selected) return <Navigate to="/select-branch" replace />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/select-branch" element={<BranchSelect />} />
        <Route element={<RequireBranch />}>
          <Route index element={<Dashboard />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="billing" element={<Billing />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
