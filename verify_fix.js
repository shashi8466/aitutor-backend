import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkAll() {
    await checkQ("Q14 (Scatterplot)", '%The scatterplot above shows the speed%');
    await checkQ("Q12 (Water filtration)", '%measured the rate of water filtration%');
    await checkQ("Q4 (System of equations)", '%(q - 12p - 28 @ 3q - 24)%');
}

async function checkQ(label, search) {
    console.log(`\n🔍 Checking ${label}...`);
    const { data } = await supabase.from('questions').select('id, topic, question').ilike('question', search).limit(1);

    if (data?.[0]) {
        const q = data[0];
        console.log(`🆔 ID: ${q.id}`);
        console.log(`🏷️  TOPIC:   "${q.topic}"`);
        console.log(`❓ QUESTION: "${q.question.substring(0, 70)}..."`);

        let status = "✅ CLEAN";

        // Specific checks for known remnants
        if (q.question.startsWith("Problem")) status = "❌ DIRTY (Topic found)";
        if (q.question.startsWith("Ratios")) status = "❌ DIRTY (Topic found)";
        if (q.question.startsWith("in two variables")) status = "❌ DIRTY (Remnant found)";

        console.log(`STATUS: ${status}`);
    } else {
        console.log("❌ Not Found");
    }
}

checkAll();
