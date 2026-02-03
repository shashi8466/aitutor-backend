import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function fixTopics() {
    console.log("🔧 Fixing broken topics...");

    // Fix Q4 type issues ("in two variables" -> "Algebra - Systems...")
    const { error: e1 } = await supabase
        .from('questions')
        .update({ topic: 'Algebra - Systems of two linear equations' })
        .eq('topic', 'in two variables');
    if (e1) console.log("Error 1:", e1); else console.log("✅ Fixed 'in two variables'");

    // Fix "in one variable"
    const { error: e2 } = await supabase
        .from('questions')
        .update({ topic: 'Advanced Math - Nonlinear equations in one variable' })
        .eq('topic', 'in one variable');
    if (e2) console.log("Error 2:", e2); else console.log("✅ Fixed 'in one variable'");

    // Fix "Problem Solving..." formatting
    const { error: e3 } = await supabase
        .from('questions')
        .update({ topic: 'Problem-Solving and Data Analysis' })
        .eq('topic', 'Problem Solving & Data Analysis');
    if (e3) console.log("Error 3:", e3); else console.log("✅ Fixed 'Problem Solving' formatting");

    // Fix "Lines angles and triangles" (missing commas)
    const { error: e4 } = await supabase
        .from('questions')
        .update({ topic: 'Geometry - Lines, angles, and triangles' })
        .eq('topic', 'Lines angles and triangles');
    if (e4) console.log("Error 4:", e4); else console.log("✅ Fixed 'Lines angles and triangles'");

    // Fix "in one or two variables"
    const { error: e5 } = await supabase
        .from('questions')
        .update({ topic: 'Algebra - Linear inequalities in one or two variables' })
        .eq('topic', 'in one or two variables');
    if (e5) console.log("Error 5:", e5); else console.log("✅ Fixed 'in one or two variables'");
}

fixTopics();
