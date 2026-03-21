
import supabaseAdmin from '../../supabase/supabaseAdmin.js';

let cachedSettings = null;
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getInternalSettings(forceFetch = false) {
    const now = Date.now();
    if (!forceFetch && cachedSettings && (now - lastFetch < CACHE_TTL)) {
        return cachedSettings;
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('internal_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            console.error('❌ Error fetching internal settings:', error.message);
            return cachedSettings || {};
        }

        cachedSettings = data || {};
        lastFetch = now;
        return cachedSettings;
    } catch (err) {
        console.error('❌ Failed to fetch internal settings:', err.message);
        return cachedSettings || {};
    }
}
