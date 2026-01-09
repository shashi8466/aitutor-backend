import { createClient } from '@supabase/supabase-js';

export const getUserFromRequest = async (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env['Project-URL'] || 'https://wqavuacgbawhgcdxxzom.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env['anon-public'];

    if (!SUPABASE_KEY) {
        console.error('❌ [AuthHelper] SUPABASE_KEY is missing');
        return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return user;
};
