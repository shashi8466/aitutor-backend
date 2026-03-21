import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

// Middleware: require admin role
async function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/settings/general  — Public site settings (name, logo)
router.get('/general', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/general  — Update public site settings (admin only)
router.put('/general', requireAdmin, async (req, res) => {
  try {
    const { app_name, logo_url } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (app_name !== undefined) updates.app_name = app_name;
    if (logo_url !== undefined) updates.logo_url = logo_url;

    const { data, error } = await supabase
      .from('site_settings')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
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

export default router;
