import { createClient } from '@supabase/supabase-js'

// ⚠️ CRITICAL: REPLACE THESE WITH YOUR OWN SUPABASE PROJECT CREDENTIALS
// 1. Go to https://supabase.com/dashboard
// 2. Create a new project or select an existing one
// 3. Go to Project Settings -> API
// 4. Copy "Project URL" and "anon" public key

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Warning: Supabase variables are missing. Some features may not work.');
}

// Standard client configuration
// Removed 'detectSessionInUrl: false' and custom 'storageKey' to prevent session issues
export default createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})