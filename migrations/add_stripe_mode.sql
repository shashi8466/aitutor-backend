# Database Migration: Add Stripe Mode to Settings

## Run this SQL in Supabase SQL Editor

```sql
-- Add stripe_mode column to site_settings table
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS stripe_mode VARCHAR(10) DEFAULT 'test';

-- Set default to test mode for existing records
UPDATE site_settings 
SET stripe_mode = 'test' 
WHERE stripe_mode IS NULL;

-- Add comment
COMMENT ON COLUMN site_settings.stripe_mode IS 'Stripe payment mode: test or live';
```

## Explanation

This adds a `stripe_mode` column to your `site_settings` table that controls whether the system uses Stripe test mode or live mode:

- **'test'**: Uses `STRIPE_TEST_SECRET_KEY` for safe testing with test cards
- **'live'**: Uses `STRIPE_LIVE_SECRET_KEY` for real payments

Default is **'test'** for safety.
