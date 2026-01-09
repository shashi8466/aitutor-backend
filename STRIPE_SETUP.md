# Stripe Payment Integration - Setup Guide

## ✅ What Has Been Implemented

### 1. **Proper Stripe Checkout Flow**
- Students click "Enroll Now" → Backend creates Stripe Checkout Session
- Student is **redirected to Stripe's hosted payment page** (NOT embedded in UI)
  
- After payment, Stripe redirects back to success page
- Webhook verifies payment and enrolls student automatically

### 2. **Security**
- **No fake enrollments**: Payment MUST be verified by Stripe webhook before enrollment
- Frontend cannot bypass payment verification
- Webhook signature validation ensures only real Stripe events are processed

### 3. **Free Courses**
- Free courses enrollment happens immediately without payment
- Backend validates course price before deciding flow

---

## 🔧 Required Environment Variables

### **Backend (Render.com)**

Add these to your Render Dashboard → Environment:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_PUBLISHABLE_KEY=pk_test_... (or pk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard > Webhooks)

# Frontend URL (for redirects)
FRONTEND_URL=https://aitutor-4431c.web.app

# Supabase (already configured)
SUPABASE_URL=https://wqavuacgbawhgcdxxzom.supabase.co
SUPABASE_KEY=<your-anon-key>
SERVICE_ROLE_KEY=<your-service-role-key>
```

### **Frontend (.env)**

Already configured to use production backend URL.

---

## 📋 Stripe Dashboard Setup

### Step 1: Get Your Stripe Keys

1. Go to https://dashboard.stripe.com/
2. Click **Developers** → **API Keys**
3. Copy:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)
4. Add to Render Environment Variables

### Step 2: Configure Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add Endpoint**
3. Enter your webhook URL:
   ```
   https://aitutor-backend-u7h3.onrender.com/api/payment/webhook
   ```
4. Select events to listen for:
   - ✅ `checkout.session.completed`
5. Click **Add Endpoint**
6. Copy the **Signing Secret** (starts with `whsec_`)
7. Add to Render as `STRIPE_WEBHOOK_SECRET`

---

## 🔄 How the Flow Works

### For Paid Courses:

```
1. Student clicks "Enroll Now"
   ↓
2. Frontend calls: POST /api/payment/create-checkout-session
   ↓
3. Backend creates Stripe Checkout Session
   ↓
4. Frontend redirects: window.location.href = session.url
   ↓
5. Student enters card on Stripe's page
   ↓
6. Stripe processes payment
   ↓
7. Stripe sends webhook to: /api/payment/webhook
   ↓
8. Backend verifies signature & enrolls student
   ↓
9. Stripe redirects to: /student/payment-success?session_id=xxx
   ↓
10. Success page verifies payment & shows confirmation
```

### For Free Courses:

```
1. Student clicks "Enroll Now"
   ↓
2. Backend detects price = 0
   ↓
3. Backend enrolls student immediately
   ↓
4. Frontend navigates directly to course
```

---

## 🧪 Testing (Test Mode)

### Test Cards (Stripe provides):

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0027 6000 3184`

Use any future expiry date, any 3-digit CVC, any ZIP.

### Testing Webhooks Locally:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run:
   ```bash
   stripe listen --forward-to localhost:3001/api/payment/webhook
   ```
3. Copy the webhook signing secret and use in your local `.env`

---

## 📊 Database Schema Required

Make sure you have this table in Supabase:

```sql
-- Payments table (for tracking)
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  course_id BIGINT REFERENCES courses(id),
  stripe_session_id TEXT UNIQUE,
  amount DECIMAL(10, 2),
  currency VARCHAR(3),
  status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollments table (already exists, verify structure)
CREATE TABLE IF NOT EXISTS enrollments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  course_id BIGINT REFERENCES courses(id),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);
```

---

## 🚀 Deployment Checklist

- [ ] Add Stripe keys to Render Environment Variables
- [ ] Configure Stripe Webhook endpoint
- [ ] Verify webhook secret in Render
- [ ] Test with test card in test mode
- [ ] Switch to live keys when ready for production
- [ ] Test live payment with real card (small amount)

---

## ⚠️ Important Notes

1. **Never commit Stripe keys to Git** - They are in Render Environment Variables
2. **Webhook signature verification is MANDATORY** - Never skip this step
3. **Always use Stripe's hosted checkout** - Never build your own payment form
4. **Test mode keys start with `_test_`** - Live keys start with `_live_`
5. **Frontend cannot decide enrollment** - Only webhook can enroll students

---

## 🐛 Troubleshooting

### "Payment successful but not enrolled"
- Check Render logs for webhook errors
- Verify webhook secret is correct
- Check Supabase permissions for `enrollments` table

### "Redirect to Stripe not working"
- Check console for `window.location.href` call
- Verify Stripe Checkout Session was created (check backend logs)
- Check if `STRIPE_SECRET_KEY` is set in Render

### "Webhook signature verification failed"
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check it's the correct webhook endpoint URL
- Make sure the endpoint uses `express.raw()` middleware

---

## 📞 Support

If you need help:
1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Check Stripe Dashboard → Events for webhook delivery status
4. Check Stripe Dashboard → Logs for API errors
