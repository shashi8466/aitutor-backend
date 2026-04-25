import { createClient } from '@supabase/supabase-js';

// Reuse client instance to avoid performance issues and overhead
let supabaseInstance = null;

const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    // ALWAYS use Anon Key for verifying user sessions. 
    // Using the Service Role key for auth.getUser() can cause 'Auth session missing' errors.
    const key =
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
        console.error('❌ [AuthHelper] Missing Supabase keys. Check .env!');
        return null;
    }

    supabaseInstance = createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
    return supabaseInstance;
};

export const getUserFromRequest = async (req) => {
    const timestamp = new Date().toISOString();
    const url = req.url.split('?')[0];

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            if (url.includes('/api/')) {
                console.warn(`[${timestamp}] ⚠️ No Authorization header for ${req.method} ${url}`);
            }
            return null;
        }

        const supabase = getSupabase();
        if (!supabase) {
            console.error(`[${timestamp}] ❌ Supabase client initialization failed`);
            return null;
        }

        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token || token === 'undefined' || token === 'null') {
            console.warn(`[${timestamp}] ⚠️ Invalid token format: "${token}"`);
            return null;
        }

        // Verify with Supabase (with a 10-second timeout to prevent hanging)
        const userPromise = supabase.auth.getUser(token);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Supabase Auth Timeout')), 10000)
        );

        const { data: authData, error } = await Promise.race([userPromise, timeoutPromise])
            .catch(err => ({ data: { user: null }, error: { message: err.message } }));
        
        const user = authData?.user;

        if (error) {
            console.error(`[${timestamp}] ❌ JWT Verification Failed (${req.method} ${url}):`, error.message);
            return null;
        }

        if (!user) {
            console.warn(`[${timestamp}] ⚠️ Valid token but no user found in Supabase`);
            return null;
        }

        // console.log(`[${timestamp}] ✅ Auth Success: ${user.email} (${req.method} ${url})`);
        return user;
    } catch (err) {
        console.error(`[${timestamp}] 💥 Critical Auth Error:`, err.message);
        return null;
    }
};
