import { createClient } from '@supabase/supabase-js'

// ⚠️ CRITICAL: REPLACE THESE WITH YOUR OWN SUPABASE PROJECT CREDENTIALS
// 1. Go to https://supabase.com/dashboard
// 2. Create a new project or select an existing one
// 3. Go to Project Settings -> API
// 4. Copy "Project URL" and "anon" public key

const SUPABASE_URL = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : import.meta.env?.VITE_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY : import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Warning: Supabase variables are missing in supabase.js. Check your .env file.');
}

// Safe client configuration (handles storage errors in strict browsers)
export default createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Custom storage to handle blocked storage gracefully
    storage: (() => {
      try {
        const dummyKey = '_supabase_test';
        localStorage.setItem(dummyKey, dummyKey);
        localStorage.removeItem(dummyKey);
        return localStorage;
      } catch (e) {
        console.warn('⚠️ Supabase Storage: Storage access blocked. Sessions will not persist.');
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        };
      }
    })()
  }
})
