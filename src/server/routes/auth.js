import express from 'express';
import BrevoEmailService from '../services/BrevoEmailService.js';
import { getUserFromRequest } from '../utils/authHelper.js';

const router = express.Router();
const emailService = new BrevoEmailService();

/**
 * POST /api/auth/welcome-email
 * Send welcome email to new user
 */
router.post('/welcome-email', async (req, res) => {
  try {
    const { email, name, userId } = req.body;

    // Security: allow either
    // 1) a Supabase service-role call (trigger uses service_role_key), OR
    // 2) a logged-in user JWT (client-side fallback).
    const bearerToken = req.headers.authorization
      ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim()
      : null;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    const isServiceRoleCall = Boolean(serviceRoleKey && bearerToken && bearerToken === serviceRoleKey);

    let verifiedUser = null;
    if (!isServiceRoleCall) {
      verifiedUser = await getUserFromRequest(req);
      if (!verifiedUser) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      if (userId && String(verifiedUser.id) !== String(userId)) {
        return res.status(403).json({ success: false, error: 'Forbidden user' });
      }
      if (email && verifiedUser.email && String(verifiedUser.email).toLowerCase() !== String(email).toLowerCase()) {
        return res.status(403).json({ success: false, error: 'Forbidden email' });
      }
    }

    // Validate input
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Idempotency: if the queue row is already marked `sent`, don't send again.
    // This prevents duplicates when multiple signup mechanisms enqueue/call welcome emails.
    let welcomeQueueRow = null;
    let adminSupabase = null;
    if (userId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          adminSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          const { data, error } = await adminSupabase
            .from('welcome_email_queue')
            .select('id,status,payload')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error) welcomeQueueRow = data;
        }
      } catch {
        // If queue table/function isn't available, we'll still send best-effort.
        welcomeQueueRow = null;
        adminSupabase = null;
      }
    }

    if (welcomeQueueRow?.status === 'sent') {
      return res.json({
        success: true,
        message: 'Welcome email already sent',
        provider: 'idempotent'
      });
    }

    console.log('📧 Welcome email request:', { email, name, userId });

    // Send welcome email via Brevo
    const safeName = name || verifiedUser?.user_metadata?.name || verifiedUser?.user_metadata?.full_name || 'Student';
    const result = await emailService.sendWelcomeEmail(email, safeName);

    if (result.success) {
      console.log('✅ Welcome email sent successfully to:', email);

      // If this email came from the queue, mark the row as sent so the queue processor won't duplicate.
      if (adminSupabase && welcomeQueueRow?.id) {
        try {
          const nowIso = new Date().toISOString();
          await adminSupabase
            .from('welcome_email_queue')
            .update({
              status: 'sent',
              processed_at: nowIso,
              processing_at: null,
              error_message: null,
              payload: {
                ...(welcomeQueueRow.payload || {}),
                messageId: result.messageId
              }
            })
            .eq('id', welcomeQueueRow.id);
        } catch (e) {
          console.warn('⚠️ Could not update welcome_email_queue status:', e?.message || e);
        }
      }
      
      // Log to notification_outbox for tracking
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        await supabase.from('notification_outbox').insert([{
          event_type: 'WELCOME_EMAIL',
          recipient_profile_id: userId,
          recipient_email: email,
          payload: { name, type: 'welcome' },
          status: 'sent',
          created_at: new Date().toISOString()
        }]);
      } catch (dbError) {
        console.warn('⚠️ Could not log to notification_outbox:', dbError.message);
      }

      res.json({
        success: true,
        message: 'Welcome email sent successfully',
        provider: result.provider,
        messageId: result.messageId
      });
    } else {
      console.error('❌ Welcome email failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Welcome email endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auth/test-welcome-email
 * Test welcome email endpoint (for development)
 */
router.post('/test-welcome-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Test email is required' 
      });
    }

    console.log('🧪 Testing welcome email to:', email);

    const result = await emailService.sendWelcomeEmail(email, 'Test User');

    res.json({
      success: result.success,
      message: result.success ? 'Test email sent!' : 'Test failed',
      provider: result.provider,
      messageId: result.messageId,
      error: result.error
    });
  } catch (error) {
    console.error('❌ Test email error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
