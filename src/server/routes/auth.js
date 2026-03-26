import express from 'express';
import BrevoEmailService from '../services/BrevoEmailService.js';

const router = express.Router();
const emailService = new BrevoEmailService();

/**
 * POST /api/auth/welcome-email
 * Send welcome email to new user
 */
router.post('/welcome-email', async (req, res) => {
  try {
    const { email, name, userId } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    console.log('📧 Welcome email request:', { email, name, userId });

    // Send welcome email via Brevo
    const result = await emailService.sendWelcomeEmail(email, name);

    if (result.success) {
      console.log('✅ Welcome email sent successfully to:', email);
      
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
