import { createClient } from '@supabase/supabase-js';

// Separate instances for different keys to prevent cross-contamination and auth errors
let supabaseAnonInstance = null;
let supabaseAdminInstance = null;

const getSupabaseAnon = () => {
    if (supabaseAnonInstance) return supabaseAnonInstance;

    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!key) {
        console.error('❌ [AuthHelper] Missing Supabase ANON key. Check .env!');
        return null;
    }

    supabaseAnonInstance = createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
    return supabaseAnonInstance;
};

const getSupabaseAdmin = () => {
    if (supabaseAdminInstance) return supabaseAdminInstance;

    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!key) {
        console.warn('⚠️ [AuthHelper] Missing Supabase SERVICE ROLE key. Using Anon key as fallback.');
        return getSupabaseAnon();
    }

    supabaseAdminInstance = createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
    return supabaseAdminInstance;
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
            req.authFailure = 'No Authorization header';
            return null;
        }

        const supabase = getSupabaseAnon();
        if (!supabase) {
            console.error(`[${timestamp}] ❌ Supabase client initialization failed`);
            req.authFailure = 'Supabase client init failed (missing keys?)';
            return null;
        }

        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token || token === 'undefined' || token === 'null') {
            console.warn(`[${timestamp}] ⚠️ Invalid token format: "${token}" for ${req.method} ${url}`);
            req.authFailure = `Invalid token format: ${token}`;
            return null;
        }

        const userPromise = supabase.auth.getUser(token);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Supabase Auth Timeout')), 10000)
        );

        const { data: authData, error } = await Promise.race([userPromise, timeoutPromise])
            .catch(err => ({ data: { user: null }, error: { message: err.message } }));
        
        const user = authData?.user;

        if (error) {
            console.error(`[${timestamp}] ❌ JWT Verification Failed (${req.method} ${url}):`, error.message);
            req.authFailure = `JWT Verification Failed: ${error.message}`;
            return null;
        }

        if (!user) {
            console.warn(`[${timestamp}] ⚠️ Valid token but no user found in Supabase for ${req.method} ${url}`);
            req.authFailure = 'Valid token but no user found in Supabase Auth';
            return null;
        }

        return user;
    } catch (err) {
        console.error(`[${timestamp}] 💥 Critical Auth Error:`, err.message);
        req.authFailure = `Critical Auth Error: ${err.message}`;
        return null;
    }
};
