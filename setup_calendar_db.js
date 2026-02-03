import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const sql = `
CREATE TABLE IF NOT EXISTS study_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('task', 'test', 'practice')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own study tasks" ON study_tasks;
CREATE POLICY "Users can manage their own study tasks"
    ON study_tasks
    FOR ALL
    USING (auth.uid() = user_id);
`;

async function setup() {
    console.log("🚀 Setting up study_tasks table...");
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error("❌ Error setting up table:", error);
        // Fallback if rpc is not available
        console.log("Trying direct execution via REST is not possible, please ensure the table is created via SQL editor if this fails.");
    } else {
        console.log("✅ study_tasks table ready!");
    }
}

setup();
