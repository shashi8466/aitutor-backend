/*
# Fix RLS Security Issues
Identified from Supabase Security Advisor:
- site_settings
- contact_messages
- invitation_links
- invitation_uses

This migration ensures RLS is enabled and policies are correctly applied.
*/

-- 1. Fix site_settings
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Public read settings') THEN
        CREATE POLICY "Public read settings" ON public.site_settings FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'site_settings' AND policyname = 'Admins update settings') THEN
        CREATE POLICY "Admins update settings" ON public.site_settings FOR UPDATE TO authenticated USING (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- 2. Fix contact_messages
ALTER TABLE IF EXISTS public.contact_messages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_messages' AND policyname = 'Public can send messages') THEN
        CREATE POLICY "Public can send messages" ON public.contact_messages FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_messages' AND policyname = 'Admins view messages') THEN
        CREATE POLICY "Admins view messages" ON public.contact_messages FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- 3. Fix invitation_links
ALTER TABLE IF EXISTS public.invitation_links ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_links' AND policyname = 'Public can view active invitations') THEN
        CREATE POLICY "Public can view active invitations" ON public.invitation_links FOR SELECT USING (is_active = true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_links' AND policyname = 'Users can view own invitations') THEN
        CREATE POLICY "Users can view own invitations" ON public.invitation_links FOR SELECT TO authenticated USING (
            created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_links' AND policyname = 'Admins and tutors can create invitations') THEN
        CREATE POLICY "Admins and tutors can create invitations" ON public.invitation_links FOR INSERT TO authenticated WITH CHECK (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR (role = 'tutor' AND tutor_approved = true)))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_links' AND policyname = 'Creators can update invitations') THEN
        CREATE POLICY "Creators can update invitations" ON public.invitation_links FOR UPDATE TO authenticated USING (
            created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_links' AND policyname = 'Creators can delete invitations') THEN
        CREATE POLICY "Creators can delete invitations" ON public.invitation_links FOR DELETE TO authenticated USING (
            created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        );
    END IF;
END $$;

-- 4. Fix invitation_uses
ALTER TABLE IF EXISTS public.invitation_uses ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_uses' AND policyname = 'Creators can view invitation uses') THEN
        CREATE POLICY "Creators can view invitation uses" ON public.invitation_uses FOR SELECT TO authenticated USING (
            EXISTS (SELECT 1 FROM invitation_links il WHERE il.id = invitation_uses.invitation_id AND (il.created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')))
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invitation_uses' AND policyname = 'System can track invitation uses') THEN
        CREATE POLICY "System can track invitation uses" ON public.invitation_uses FOR INSERT WITH CHECK (true);
    END IF;
END $$;
