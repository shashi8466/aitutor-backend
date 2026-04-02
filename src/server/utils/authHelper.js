import { createClient } from '@supabase/supabase-js';

// Reuse client instance to avoid performance issues and overhead
let supabaseInstance = null;

const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    // Prefer service role key when available. This avoids edge-cases where the anon
    // key is missing/misconfigured, while still verifying the provided user token.
    const key =
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY;

    if (!key) {
        console.error('❌ [AuthHelper] Missing Supabase key (service role or anon). Check env vars!');
        return null;
    }

    supabaseInstance = createClient(url, key);
    return supabaseInstance;
};

export const getUserFromRequest = async (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            // Only log if it's an API request that expects auth
            if (req.url.includes('/api/')) {
                console.warn(`⚠️ [Auth] No authorization header for ${req.method} ${req.url}`);
            }
            return null;
        }

        const supabase = getSupabase();
        if (!supabase) return null;

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) return null;

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.error('❌ [Auth] Token verification failed:', error.message);
            return null;
        }

        if (!user) {
            console.warn('⚠️ [Auth] Token verified but no user found');
            return null;
        }

        return user;
    } catch (err) {
        console.error('💥 [Auth] Fatal error in getUserFromRequest:', err.message);
        return null;
    }
};
