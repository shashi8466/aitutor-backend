import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

export const getUserFromRequest = async (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return user;
};
