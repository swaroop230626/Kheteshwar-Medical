import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Names of env variables that are missing (shown on a clear error screen in main.tsx)
export const missingEnv: string[] = []
if (!url) missingEnv.push('VITE_SUPABASE_URL')
if (!key) missingEnv.push('VITE_SUPABASE_PUBLISHABLE_KEY')

// Placeholders keep createClient from throwing; the app never renders when env is missing.
export const supabase = createClient(url || 'http://localhost', key || 'missing-key')
