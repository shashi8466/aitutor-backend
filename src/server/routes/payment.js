import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

console.log('🔧 Initializing Payment Routes (Stripe)...');

// Initialize Stripe with environment variable (supports test and live modes)
let stripeTest = null;
let stripeLive = null;

const getStripe = (useTestMode = true) => {
  // Determine which key to use
  const stripeKey = useTestMode
    ? (process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY)
    : (process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY);

  if (!stripeKey) {
    throw new Error(`Stripe ${useTestMode ? 'test' : 'live'} key is not configured`);
  }

  // Use cached instance or create new
  if (useTestMode) {
    if (!stripeTest) {
      stripeTest = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      console.log('✅ Stripe Test Mode initialized');
    }
    return stripeTest;
  } else {
    if (!stripeLive) {
      stripeLive = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      console.log('✅ Stripe Live Mode initialized');
    }
    return stripeLive;
  }
};

// Get payment mode from settings
const getPaymentMode = async (supabase) => {
  try {
    const { data: settings } = await supabase
      .from('site_settings')
      .select('stripe_mode')
      .eq('id', 1)
      .single();

    return settings?.stripe_mode === 'live' ? false : true; // Returns true for test, false for live
  } catch (error) {
    console.warn('⚠️ Could not fetch payment mode, defaulting to test');
    return true; // Default to test mode
  }
};

// Helper function to get authenticated Supabase client
const getSupabase = (authHeader) => {
  const token = authHeader?.replace('Bearer ', '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env['Project-URL'] || 'https://wqavuacgbawhgcdxxzom.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env['anon-public'];

  if (!supabaseKey) {
    throw new Error('Supabase initialization failed: supabaseKey is required.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
};

// Test route
router.get('/test', (req, res) => {
  console.log('🧪 Payment test endpoint called');
  res.json({
    message: 'Payment routes are working!',
    provider: 'Stripe',
    testMode: {
      configured: !!(process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY),
      key: process.env.STRIPE_TEST_SECRET_KEY ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'
    },
    liveMode: {
      configured: !!process.env.STRIPE_LIVE_SECRET_KEY,
      key: 'STRIPE_LIVE_SECRET_KEY'
    },
    timestamp: new Date().toISOString()
  });
});

// Create Stripe Checkout Session (REAL STRIPE FLOW)
router.post('/create-checkout-session', async (req, res) => {
  console.log('💰 [Payment] Create Stripe Checkout Session request received');

  try {
    const { courseId, userId } = req.body;

    // Validate required fields
    if (!courseId || !userId) {
      return res.status(400).json({ error: 'Course ID and User ID are required' });
    }

    const supabase = getSupabase(req.headers.authorization);

    // Fetch course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, price_full, description')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Handle free courses
    if (!course.price_full || parseFloat(course.price_full) === 0) {
      // For free courses, check if enrollment key is required
      // First, check if the course requires an enrollment key
      const { data: keyCheck } = await supabase
        .from('enrollment_keys')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .limit(1);

      if (keyCheck && keyCheck.length > 0) {
        // If enrollment keys exist for this course, student must use a key
        // Check if there's a specific key for this user's enrollment method
        // Actually, if there are ANY active keys for the course, we should require one to be used
        // But we should allow enrollment if no keys exist at all
        // Let me reconsider: If there are active enrollment keys for this course, 
        // students should not be able to enroll directly - they must use the enrollment key system

        // So the logic should be: if keys exist, return an error saying to use the key
        return res.status(200).json({  // Return 200 so frontend can handle the 'requiresKey' flag logic easily
          requiresKey: true,
          error: 'This course requires an enrollment key.',
          courseName: course.name
        });
      }

      // If no enrollment key is required, allow direct enrollment
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert([{
          user_id: userId,
          course_id: parseInt(courseId)
        }])
        .select()
        .single();

      if (enrollError && enrollError.code !== '23505') { // Ignore duplicate error
        throw enrollError;
      }

      return res.json({
        free: true,
        courseName: course.name,
        message: 'Enrolled successfully in free course',
        redirectTo: `/student/course/${courseId}`
      });
    }

    // Get user details
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, mobile')
      .eq('id', userId)
      .single();

    // Calculate price in cents (Stripe requires smallest currency unit)
    const priceInCents = Math.round(parseFloat(course.price_full) * 100);

    // Determine payment mode (test or live)
    const useTestMode = await getPaymentMode(supabase);
    console.log(`💳 [Payment] Using ${useTestMode ? 'TEST' : 'LIVE'} mode`);

    // Create Stripe Checkout Session with appropriate mode
    const stripeInstance = getStripe(useTestMode);

    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: course.name,
              description: course.description || `Enroll in ${course.name}`,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/payment-success?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/courses`,
      client_reference_id: userId,
      metadata: {
        courseId: courseId.toString(),
        userId: userId.toString(),
        courseName: course.name
      },
      customer_email: profile?.email || user.email,
    });

    console.log('✅ [Payment] Stripe Checkout Session created:', session.id);

    res.json({
      sessionId: session.id,
      url: session.url, // This is the URL to redirect the user to Stripe Checkout
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });

  } catch (error) {
    console.error('💰 [Payment] Create checkout session error:', error);
    res.status(500).json({
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
});

// Stripe Webhook Handler (CRITICAL FOR SECURITY)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('⚠️ [Payment] Stripe webhook secret not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  try {
    // Try test mode first, then live mode (webhook will use the same mode as checkout)
    let event;
    try {
      const stripeTestInstance = getStripe(true);
      event = stripeTestInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (testError) {
      // If test mode fails, try live mode
      const stripeLiveInstance = getStripe(false);
      event = stripeLiveInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    }

    console.log(`🔔 [Payment] Webhook received: ${event.type}`);

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const courseId = session.metadata.courseId;
      const userId = session.metadata.userId;

      console.log(`✅ [Payment] Payment successful for user ${userId}, course ${courseId}`);

      // Create enrollment using service role key (no auth header needed)
      const supabaseUrl = process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
      const serviceRoleKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!serviceRoleKey) {
        console.error('❌ [Payment] Service role key not configured');
        return res.status(500).send('Service role key missing');
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Check if enrollment keys exist for this course - if they do, direct enrollment shouldn't be allowed
      const { data: keyCheck } = await supabase
        .from('enrollment_keys')
        .select('id')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .limit(1);

      if (keyCheck && keyCheck.length > 0) {
        console.error('❌ [Payment] Course has active enrollment keys, direct enrollment not allowed');
        return res.status(400).send('Course requires enrollment key. Direct enrollment not allowed.');
      }

      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .insert([{
          user_id: userId,
          course_id: parseInt(courseId)
        }])
        .select()
        .single();

      if (enrollError && enrollError.code !== '23505') { // Ignore duplicate error
        console.error('❌ [Payment] Enrollment failed:', enrollError);
        return res.status(500).send('Enrollment failed');
      }

      console.log(`✅ [Payment] User ${userId} enrolled in course ${courseId}`);

      // Store payment record for tracking
      await supabase
        .from('payments')
        .insert([{
          user_id: userId,
          course_id: parseInt(courseId),
          stripe_session_id: session.id,
          amount: session.amount_total / 100, // Convert back to dollars
          currency: session.currency,
          status: 'completed'
        }]);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ [Payment] Webhook error:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Verify payment session (called from success page)
router.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Try to retrieve session from either test or live mode
    let session;
    try {
      const stripeTestInstance = getStripe(true);
      session = await stripeTestInstance.checkout.sessions.retrieve(sessionId);
    } catch (testError) {
      const stripeLiveInstance = getStripe(false);
      session = await stripeLiveInstance.checkout.sessions.retrieve(sessionId);
    }

    if (session.payment_status === 'paid') {
      res.json({
        success: true,
        courseId: session.metadata.courseId,
        userId: session.metadata.userId,
        courseName: session.metadata.courseName
      });
    } else {
      res.json({
        success: false,
        status: session.payment_status
      });
    }
  } catch (error) {
    console.error('❌ [Payment] Session verification error:', error);
    res.status(500).json({ error: 'Failed to verify session' });
  }
});

export default router;