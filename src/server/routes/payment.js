import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

console.log('🔧 Initializing Payment Routes...');

// Initialize Razorpay with better error handling
const rzpKey = process.env.RAZORPAY_KEY_ID || 'rzp_test_11111111111111';
const rzpSecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_for_development';
const isDevelopment = process.env.NODE_ENV === 'development' || rzpKey.includes('placeholder') || rzpKey === 'rzp_test_11111111111111';

let razorpay = null;

try {
  // Always initialize Razorpay, even with test credentials
  razorpay = new Razorpay({
    key_id: rzpKey,
    key_secret: rzpSecret
  });

  if (isDevelopment) {
    console.log('⚠️  Using TEST/DEMO payment mode - No real money will be charged');
  } else {
    console.log('✅ Razorpay initialized with production credentials');
  }
} catch (err) {
  console.error('❌ Razorpay initialization failed:', err.message);
}

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

// Test route to verify payment routes are working
router.get('/test', (req, res) => {
  console.log('🧪 Payment test endpoint called');
  res.json({
    message: 'Payment routes are working!',
    razorpayStatus: razorpay ? 'initialized' : 'not configured',
    isDevelopment,
    keyId: isDevelopment ? rzpKey : 'hidden',
    timestamp: new Date().toISOString()
  });
});

// Create Payment Order
router.post('/create-order', async (req, res) => {
  console.log('💰 [Payment] Create order request received');

  try {
    const { courseId, studentInfo } = req.body;

    // Validate required fields
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // CRITICAL FIX: In Development, proceed even if Razorpay failed to init
    if (!razorpay && !isDevelopment) {
      console.error('💰 [Payment] Razorpay not initialized (Production)');
      return res.status(503).json({
        error: 'Payment gateway not configured. Please contact administrator.',
        hint: 'Razorpay credentials missing'
      });
    }

    const supabase = getSupabase(req.headers.authorization);

    // Fetch course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, price_full')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Handle free courses
    if (!course.price_full || parseFloat(course.price_full) === 0) {
      return res.json({
        free: true,
        courseName: course.name,
        message: 'This course is free'
      });
    }

    // Update student profile if info provided
    if (studentInfo && req.headers.authorization) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({
              father_name: studentInfo.fatherName,
              father_mobile: studentInfo.fatherMobile,
              mobile: studentInfo.mobile
            })
            .eq('id', user.id);
        }
      } catch (profileError) {
        console.warn('Profile update warning:', profileError.message);
      }
    }

    // Development Mode: Always force a mock order success
    if (isDevelopment) {
      console.log('💰 [Payment] Creating DEMO order (no real payment required)');

      const mockOrder = {
        id: `order_demo_${Date.now()}`,
        currency: "INR",
        amount: Math.round(parseFloat(course.price_full) * 100), // Convert to paise
        status: 'created'
      };

      return res.json({
        id: mockOrder.id,
        currency: mockOrder.currency,
        amount: mockOrder.amount,
        key_id: rzpKey,
        course_name: course.name,
        description: `Demo Enrollment for ${course.name}`,
        isDemoMode: true,
        prefill: {
          name: studentInfo?.name || '',
          email: studentInfo?.email || '',
          contact: studentInfo?.mobile || ''
        }
      });
    }

    // Production Mode: Create real Razorpay order
    const orderOptions = {
      amount: Math.round(parseFloat(course.price_full) * 100),
      currency: "INR",
      receipt: `rcpt_${courseId}_${Date.now()}`,
      notes: {
        course_id: courseId,
        course_name: course.name,
        student_name: studentInfo?.name || 'Unknown'
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    res.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
      key_id: rzpKey,
      course_name: course.name,
      description: `Enrollment for ${course.name}`,
      prefill: {
        name: studentInfo?.name || '',
        email: studentInfo?.email || '',
        contact: studentInfo?.mobile || ''
      }
    });

  } catch (error) {
    console.error('💰 [Payment] Create order error:', error);
    res.status(500).json({
      error: 'Failed to create payment order',
      message: error.message
    });
  }
});

// Verify Payment
router.post('/verify', async (req, res) => {
  console.log('💰 [Payment] Verify payment request received');

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId, userId } = req.body;

    // Development Mode: Relaxed verification
    if (isDevelopment) {
      console.log('💰 [Payment] DEMO MODE - Skipping signature verification');
      if (!courseId || !userId) {
        return res.status(400).json({ error: 'Missing courseId or userId' });
      }
    } else {
      // Production Mode: Strict verification
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment data' });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', rzpSecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    // Create enrollment
    const supabase = getSupabase(req.headers.authorization);
    const { data: enrollment, error: enrollError } = await supabase
      .from('enrollments')
      .insert([{
        user_id: userId,
        course_id: parseInt(courseId)
      }])
      .select()
      .single();

    if (enrollError) {
      if (enrollError.code === '23505') { // Duplicate
        return res.json({
          success: true,
          message: 'Already enrolled!',
          enrollment_status: 'already_enrolled'
        });
      }
      throw enrollError;
    }

    res.json({
      success: true,
      message: isDevelopment ? 'Demo enrollment successful!' : 'Payment verified!',
      enrollment: enrollment,
      isDemoMode: isDevelopment
    });

  } catch (error) {
    console.error('💰 [Payment] Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed', message: error.message });
  }
});

export default router;