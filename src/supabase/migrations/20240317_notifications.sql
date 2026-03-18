-- 1. Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    whatsapp_enabled BOOLEAN DEFAULT false,
    test_completion_notify BOOLEAN DEFAULT true,
    weekly_report_notify BOOLEAN DEFAULT true,
    due_date_reminder_notify BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Test Assignments (Due Dates)
CREATE TABLE IF NOT EXISTS test_assignments (
    id BIGSERIAL PRIMARY KEY,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
    level TEXT, -- e.g., 'easy', 'medium', 'hard'
    due_date TIMESTAMPTZ NOT NULL,
    assigned_by UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'overdue'
    notified_7d BOOLEAN DEFAULT false,
    notified_3d BOOLEAN DEFAULT false,
    notified_1d BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Notification Logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_type TEXT, -- 'student', 'parent'
    channel TEXT, -- 'email', 'sms', 'whatsapp'
    notification_type TEXT, -- 'test_completion', 'weekly_report', 'due_reminder'
    status TEXT, -- 'sent', 'failed'
    metadata JSONB, -- store IDs related (submission_id, assignment_id, etc)
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all settings" ON notification_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Students can view their assignments" ON test_assignments FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Admins can manage assignments" ON test_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Function to handle new user notification settings
CREATE OR REPLACE FUNCTION handle_new_user_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notification_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create settings on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_notification_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_notification_settings();

-- Backfill existing users (Optional - run manually if needed)
-- INSERT INTO notification_settings (user_id)
-- SELECT id FROM auth.users
-- ON CONFLICT (user_id) DO NOTHING;
