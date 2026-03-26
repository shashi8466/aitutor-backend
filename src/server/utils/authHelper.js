import { createClient } from '@supabase/supabase-js';

// Reuse client instance to avoid performance issues and overhead
let supabaseInstance = null;

const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    const key = process.env.SUPABASE_ANON_KEY;

    if (!key) {
        console.error('❌ [AuthHelper] SUPABASE_ANON_KEY is missing from environment variables!');
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
