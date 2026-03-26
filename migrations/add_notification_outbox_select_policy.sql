-- Ensure `notification_outbox` is readable by authenticated users (frontend in-app notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_outbox'
      AND policyname = 'Users can view own notifications'
  ) THEN
    CREATE POLICY "Users can view own notifications"
      ON public.notification_outbox
      FOR SELECT TO authenticated
      USING (recipient_profile_id = auth.uid());
  END IF;
END $$;

