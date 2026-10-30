import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { EnvError } from './components/EnvError'
import { UpdatePrompt } from './components/UpdatePrompt'
import { ThemeProvider } from './theme/ThemeContext'
import { missingEnv } from './lib/supabase'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
    {missingEnv.length > 0 ? (
      <EnvError missing={missingEnv} />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
    <UpdatePrompt />
    </ThemeProvider>
  </StrictMode>,
)
