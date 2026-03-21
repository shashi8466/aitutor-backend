-- Create notification_outbox table for notification system
CREATE TABLE public.notification_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  event_type TEXT NOT NULL,
  recipient_profile_id UUID,
  recipient_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  channels TEXT,
  scheduled_for TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  sender_profile_id UUID
);
