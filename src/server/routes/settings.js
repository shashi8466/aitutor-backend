import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

import { getUserFromRequest } from '../utils/authHelper.js';

const router = express.Router();

// Middleware: require admin role
async function requireAdmin(req, res, next) {
  try {
    const user = req.user || await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = user; // Set for downstream
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/settings/general  — Public site settings (name, logo)
router.get('/general', async (req, res) => {
  try {
    let data, error;
    
    // Try to get site settings
    try {
      const result = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      data = result.data;
      error = result.error;
    } catch (tableError) {
      // Table doesn't exist, use default values
      console.warn('⚠️ [SETTINGS] site_settings table not found, using defaults');
      data = null;
      error = null;
    }

    // If no data or table doesn't exist, return default settings
    if (error || !data) {
      const defaultSettings = {
        id: 1,
        app_name: process.env.APP_NAME || 'AIPrep365',
        logo_url: null,
        primary_color: '#6366f1',
        secondary_color: '#8b5cf6',
        description: 'AI-Powered Test Preparation Platform',
        contact_email: process.env.ADMIN_EMAIL || 'admin@aiprep365.com',
        updated_at: new Date().toISOString()
      };
      
      console.log('📋 [SETTINGS] Returning default settings');
      return res.json({ success: true, data: defaultSettings });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [SETTINGS] Error in /general endpoint:', err);
    // Return default settings even on error to prevent frontend breaking
    const defaultSettings = {
      id: 1,
      app_name: process.env.APP_NAME || 'AIPrep365',
      logo_url: null,
      primary_color: '#6366f1',
      secondary_color: '#8b5cf6',
      description: 'AI-Powered Test Preparation Platform',
      contact_email: process.env.ADMIN_EMAIL || 'admin@aiprep365.com',
      updated_at: new Date().toISOString()
    };
    
    res.json({ success: true, data: defaultSettings });
  }
});

// PUT /api/settings/general  — Update public site settings (admin only)
router.put('/general', requireAdmin, async (req, res) => {
  try {
    const { app_name, logo_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (app_name !== undefined) updates.app_name = app_name;
    if (logo_url !== undefined) updates.logo_url = logo_url;

    let data, error;
    
    // Try to update existing record
    try {
      const result = await supabase
        .from('site_settings')
        .update(updates)
        .eq('id', 1)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
    } catch (updateError) {
      // If update fails, try to insert new record
      console.warn('⚠️ [SETTINGS] Update failed, trying to insert new record');
      const insertData = {
        id: 1,
        app_name: app_name || process.env.APP_NAME || 'AIPrep365',
        logo_url: logo_url || null,
        primary_color: '#6366f1',
        secondary_color: '#8b5cf6',
        description: 'AI-Powered Test Preparation Platform',
        contact_email: process.env.ADMIN_EMAIL || 'admin@aiprep365.com',
        ...updates
      };
      
      const insertResult = await supabase
        .from('site_settings')
        .insert(insertData)
        .select()
        .single();
      
      data = insertResult.data;
      error = insertResult.error;
    }

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ [SETTINGS] Error in PUT /general endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/advanced  — Internal settings (admin only)
router.get('/advanced', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('internal_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;

    // Redact sensitive keys before sending to browser
    const safe = { ...data };
    if (safe.email_config?.pass) safe.email_config = { ...safe.email_config, pass: '••••••••' };
    if (safe.sms_config?.auth_token) safe.sms_config = { ...safe.sms_config, auth_token: '••••••••' };
    if (safe.payment_config?.secret_key) safe.payment_config = { ...safe.payment_config, secret_key: '••••••••' };

    res.json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/advanced  — Update internal settings (admin only)
router.put('/advanced', requireAdmin, async (req, res) => {
  try {
    const config = req.body;

    // Fetch current settings first so we can merge (don't overwrite passwords with '••••••••')
    const { data: current } = await supabase
      .from('internal_settings')
      .select('*')
      .eq('id', 1)
      .single();

    const merged = { ...current };

    // Merge each config section — skip any field that is exactly the placeholder '••••••••'
    const sections = ['email_config', 'sms_config', 'payment_config', 'api_config', 'site_config'];
    for (const section of sections) {
      if (config[section]) {
        merged[section] = { ...(current?.[section] || {}) };
        for (const [key, val] of Object.entries(config[section])) {
          if (val !== '••••••••') {
            merged[section][key] = val;
          }
        }
      }
    }

    merged.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('internal_settings')
      .update(merged)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/category-visibility — Any authenticated user (students/tutors need this to
// filter their own My Courses / Recordings UI; admin needs it to render the settings screen).
// Returns { my_courses: { 'SAT': true, ... }, recordings: { 'sat': true, ... } } - every row
// keyed by its own category, defaulting a category to visible (true) if no row exists for it yet
// (matches the "ON unless explicitly turned off" default every other row was seeded with).
router.get('/category-visibility', async (req, res) => {
  try {
    const user = req.user || await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase.from('category_visibility_settings').select('context, category, enabled');
    if (error) throw error;

    const byContext = { my_courses: {}, recordings: {} };
    (data || []).forEach((row) => {
      if (!byContext[row.context]) byContext[row.context] = {};
      byContext[row.context][row.category] = row.enabled;
    });
    res.json({ success: true, data: byContext });
  } catch (err) {
    // Fail OPEN (every category visible) rather than hiding every course/recording site-wide if
    // this table isn't migrated onto a given environment yet - this is a visibility REFINEMENT,
    // never the primary access gate, so a read failure here must never look like "nothing exists".
    console.error('❌ [SETTINGS] Error in GET /category-visibility - has the category_visibility_settings migration been run?', err.message);
    res.json({ success: true, data: { my_courses: {}, recordings: {} } });
  }
});

// PUT /api/settings/category-visibility — Admin only. body: { my_courses: {category: bool},
// recordings: {category: bool} }. Upserts exactly the categories provided - a category omitted
// from the body is left untouched, so the UI can save without needing to know about every
// possible category key (keeps this data-driven/extensible per the original requirement).
router.put('/category-visibility', requireAdmin, async (req, res) => {
  try {
    const { my_courses: myCourses, recordings } = req.body || {};
    const rows = [];
    Object.entries(myCourses || {}).forEach(([category, enabled]) => rows.push({ context: 'my_courses', category, enabled: !!enabled, updated_at: new Date().toISOString() }));
    Object.entries(recordings || {}).forEach(([category, enabled]) => rows.push({ context: 'recordings', category, enabled: !!enabled, updated_at: new Date().toISOString() }));

    if (rows.length === 0) return res.status(400).json({ error: 'No categories provided.' });

    const { error } = await supabase.from('category_visibility_settings').upsert(rows, { onConflict: 'context,category' });
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('❌ [SETTINGS] Error in PUT /category-visibility:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
