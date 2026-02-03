
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkQuestions() {
    console.log("🔍 Checking questions for submission 7...");
    const IDs = [68, 69, 70, 72, 77, 80, 82, 83, 84, 85, 88, 67, 71, 73, 74, 75, 76, 78, 79, 81, 86, 87];

    const { data: qs, error } = await supabase
        .from('questions')
        .select('id')
        .in('id', IDs);

    if (error) {
        console.error("❌ Error:", error);
        return;
    }

    console.log(`📊 Found ${qs?.length || 0} questions out of ${IDs.length}`);
    const foundIDs = qs.map(q => q.id);
    const missingIDs = IDs.filter(id => !foundIDs.includes(id));
    if (missingIDs.length > 0) {
        console.log("❌ Missing IDs:", missingIDs);
    }
}

checkQuestions();
