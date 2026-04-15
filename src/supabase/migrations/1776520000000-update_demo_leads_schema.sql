/* 
# Update Demo Leads Schema for Multi-Level Tracking
1. Add columns to track individual level completions
2. Keep existing score_details for backward compatibility
*/

DO $$ 
BEGIN 
    -- Add individual level score columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'easy_score_details') THEN
        ALTER TABLE demo_leads ADD COLUMN easy_score_details jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'medium_score_details') THEN
        ALTER TABLE demo_leads ADD COLUMN medium_score_details jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'hard_score_details') THEN
        ALTER TABLE demo_leads ADD COLUMN hard_score_details jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add completion tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'levels_completed') THEN
        ALTER TABLE demo_leads ADD COLUMN levels_completed text DEFAULT '[]'::text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'final_email_sent') THEN
        ALTER TABLE demo_leads ADD COLUMN final_email_sent boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'demo_leads' AND column_name = 'final_combined_score') THEN
        ALTER TABLE demo_leads ADD COLUMN final_combined_score integer DEFAULT 0;
    END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_demo_leads_email_course ON demo_leads(email, course_id);
CREATE INDEX IF NOT EXISTS idx_demo_leads_final_sent ON demo_leads(final_email_sent);

-- Update RLS policies to handle new columns
DROP POLICY IF EXISTS "Public can insert demo leads" ON public.demo_leads;
DROP POLICY IF EXISTS "Admins can view demo leads" ON public.demo_leads;

-- Allow public insertion for demo flow
CREATE POLICY "Public can insert demo leads" ON public.demo_leads
FOR INSERT WITH CHECK (true);

-- Allow admins to view leads
CREATE POLICY "Admins can view demo leads" ON public.demo_leads
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Allow updates for level completion tracking
CREATE POLICY "System can update demo leads" ON public.demo_leads
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'service')
    )
)
WITH CHECK (
    -- Allow updating level scores and completion status
    jsonb_typeof(easy_score_details) = 'object' OR easy_score_details IS NULL OR
    jsonb_typeof(medium_score_details) = 'object' OR medium_score_details IS NULL OR
    jsonb_typeof(hard_score_details) = 'object' OR hard_score_details IS NULL OR
    levels_completed IS NOT NULL OR
    final_email_sent IS NOT NULL OR
    final_combined_score >= 0 AND final_combined_score <= 800
);
