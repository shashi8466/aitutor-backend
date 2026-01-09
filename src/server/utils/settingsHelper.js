import { createClient } from '@supabase/supabase-js';

export const getAppSettings = async () => {
    try {
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env['Project-URL'] || 'https://wqavuacgbawhgcdxxzom.supabase.co';
        const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env['anon-public'];

        if (!SUPABASE_KEY) {
            console.warn('⚠️ [SettingsHelper] SUPABASE_KEY missing, using defaults');
            return { app_name: 'Pundits AI', logo_url: null };
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return { app_name: 'Pundits AI', logo_url: null };
        }

        return data;
    } catch (err) {
        console.error('Error fetching settings on server:', err);
        return { app_name: 'Pundits AI', logo_url: null };
    }
};
