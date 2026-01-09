# 🔐 Stripe Test & Live Mode Setup Guide

## ✅ Fixed Issues

1. ✅ **404 Error Fixed**: Payment API route now properly registered  
2. ✅ **Test/Live Mode Support**: System now supports both Stripe modes
3. ✅ **Automatic Mode Detection**: Backend reads mode from database settings

---

## 🚀 Quick Setup Steps

### 1. **Add Stripe Keys to Render**

Go to Render Dashboard → Environment Variables:

#### For Test Mode Only (Start Here):
```env
STRIPE_TEST_SECRET_KEY=sk_test_51MAzIHSSRuiRedgG8Igew2C4Rdm1RHzqFRpmYKN2qPrtqRsh5woWKTaGSR
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_51MAzIHSSRuiRedgG8Igew2C4Rdm1RHzqFRpmYKN2qPrtgsIdshsiwWKTaGSR
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard)
FRONTEND_URL=https://aitutor-4431c.web.app
```

#### For Live Mode (When Ready for Production):
```env
STRIPE_LIVE_SECRET_KEY=sk_live_... (from Stripe Dashboard)
STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_... (from Stripe Dashboard)
```

**Note**: If you only have one set of keys, you can use:
```env
STRIPE_SECRET_KEY=sk_test_... (works for either mode)
```

### 2. **Run Database Migration**

Go to Supabase → SQL Editor and run:

```sql
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS stripe_mode VARCHAR(10) DEFAULT 'test';

UPDATE site_settings 
SET stripe_mode = 'test' 
WHERE stripe_mode IS NULL;
```

This adds a column to control Test vs Live mode.

### 3. **Configure Stripe Webhook**

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add Endpoint**
3. **URL**: `https://aitutor-backend-u7h3.onrender.com/api/payment/webhook`
4. **Events**: Select `checkout.session.completed`
5. Copy **Signing Secret** → Add to Render as `STRIPE_WEBHOOK_SECRET`

### 4. **Test the Integration**

Visit: `https://aitutor-backend-u7h3.onrender.com/api/payment/test`

You should see:
```json
{
  "message": "Payment routes are working!",
  "provider": "Stripe",
  "testMode": {
    "configured": true,
    "key": "STRIPE_TEST_SECRET_KEY"
  },
  "liveMode": {
    "configured": false,
    "key": "STRIPE_LIVE_SECRET_KEY"
  }
}
```

---

## 🔄 Switching Between Test and Live Mode

### In Supabase:

```sql
-- Switch to Test Mode (Use test cards)
UPDATE site_settings SET stripe_mode = 'test' WHERE id = 1;

-- Switch to Live Mode (Real payments)
UPDATE site_settings SET stripe_mode = 'live' WHERE id = 1;
```

### What Happens:

| Mode | Keys Used | Cards | Real Money |
|------|-----------|-------|------------|
| **Test** | `STRIPE_TEST_SECRET_KEY` | Test cards (4242...) | No |
| **Live** | `STRIPE_LIVE_SECRET_KEY` | Real cards | Yes |

---

## 🧪 Test Cards (Test Mode Only)

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0027 6000 3184` | 🔐 3D Secure Required |

Use any future expiry, any CVC, any ZIP.

---

## 📊 How It Works

### Test Mode Flow:
```
Student clicks "Enroll" 
  ↓
Backend detects stripe_mode = 'test' in database
  ↓
Uses STRIPE_TEST_SECRET_KEY
  ↓
Redirects to Stripe Test Checkout
  ↓
Student uses test card (4242...)
  ↓
Webhook verifies test payment
  ↓
Student enrolled
```

### Live Mode Flow:
```
Admin changes stripe_mode = 'live' in database
  ↓
Backend uses STRIPE_LIVE_SECRET_KEY
  ↓
Real card processing
  ↓
Real money charged
```

---

## ⚠️ Important Security Notes

1. **Never commit Stripe keys to Git** ✅ Already handled
2. **Always test in Test Mode first** ✅ System defaults to test
3. **Webhook signature verification is mandatory** ✅ Already implemented
4. **Use Stripe's hosted checkout only** ✅ Already implemented

---

## 🐛 Troubleshooting

### "404 Error on /api/payment/create-checkout-session"
- ✅ **FIXED**: Server restart required after code changes
- Run: `npm run dev` or wait for Render auto-deploy

### "Stripe key not configured"
- Check Render Environment Variables
- Verify test mode has `STRIPE_TEST_SECRET_KEY`
- Verify live mode has `STRIPE_LIVE_SECRET_KEY`

### "Payment works but enrollment fails"
- Check webhook is configured in Stripe Dashboard
- Verify `STRIPE_WEBHOOK_SECRET` in Render
- Check Render logs for webhook errors

### "How do I know which mode I'm in?"
- Check backend logs: "Using TEST/LIVE mode"
- Or run SQL: `SELECT stripe_mode FROM site_settings WHERE id = 1;`

---

## 📞 Next Steps

1. ✅ Add keys to Render
2. ✅ Run database migration  
3. ✅ Configure webhook
4. ✅ Test with test card (4242...)
5. 🎯 Switch to live mode when ready

The code is already deployed and ready to use! Just add your environment variables.
