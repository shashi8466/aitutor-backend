/**
 * Comprehensive Database Diagnostic Script
 * Checks ALL tables: courses, profiles (students, parents, tutors), 
 * enrollments, test_submissions, student_progress, etc.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing! Cannot proceed.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function safeQuery(tableName, queryFn) {
    try {
        const result = await queryFn();
        return result;
    } catch (err) {
        return { data: null, error: { message: `Exception: ${err.message}`, code: 'EXCEPTION' }, count: null };
    }
}

async function runDiagnostics() {
    console.log('═══════════════════════════════════════════════════');
    console.log('   COMPREHENSIVE DATABASE DIAGNOSTICS');
    console.log('   Supabase URL:', SUPABASE_URL);
    console.log('   Service Key:', SERVICE_KEY ? `${SERVICE_KEY.substring(0, 20)}...` : 'MISSING');
    console.log('═══════════════════════════════════════════════════\n');

    // ─── 1. COURSES TABLE ────────────────────────────────
    console.log('━━━ 1. COURSES TABLE ━━━');
    const { data: courses, error: courseErr, count: courseCount } = await safeQuery('courses', () =>
        supabase.from('courses').select('*', { count: 'exact' })
    );
    if (courseErr) {
        console.log(`  ❌ ERROR: ${courseErr.message} (code: ${courseErr.code})`);
    } else {
        console.log(`  ✅ Total courses: ${courses?.length || 0}`);
        if (courses && courses.length > 0) {
            courses.forEach(c => {
                console.log(`     - [ID: ${c.id}] ${c.name} | tutor_type: ${c.tutor_type || 'N/A'} | is_practice: ${c.is_practice || false}`);
            });
        } else {
            console.log('  ⚠️ NO COURSES FOUND - This is likely the root cause!');
        }
    }

    // ─── 2. PROFILES TABLE ───────────────────────────────
    console.log('\n━━━ 2. PROFILES TABLE ━━━');
    const { data: profiles, error: profileErr } = await safeQuery('profiles', () =>
        supabase.from('profiles').select('id, name, email, role, tutor_approved, assigned_courses, linked_students, created_at')
    );
    if (profileErr) {
        console.log(`  ❌ ERROR: ${profileErr.message} (code: ${profileErr.code})`);
    } else {
        console.log(`  ✅ Total profiles: ${profiles?.length || 0}`);
        const roleCounts = {};
        (profiles || []).forEach(p => {
            roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
        });
        console.log('  Role breakdown:', JSON.stringify(roleCounts));

        // Show admins
        const admins = (profiles || []).filter(p => p.role === 'admin');
        console.log(`\n  👑 Admins (${admins.length}):`);
        admins.forEach(a => console.log(`     - ${a.name || 'No Name'} | ${a.email}`));

        // Show tutors
        const tutors = (profiles || []).filter(p => p.role === 'tutor');
        console.log(`\n  📚 Tutors (${tutors.length}):`);
        tutors.forEach(t => {
            const assigned = t.assigned_courses || [];
            console.log(`     - ${t.name || 'No Name'} | ${t.email} | approved: ${t.tutor_approved} | assigned_courses: ${JSON.stringify(assigned)}`);
        });

        // Show students
        const students = (profiles || []).filter(p => p.role === 'student');
        console.log(`\n  🎓 Students (${students.length}):`);
        students.slice(0, 10).forEach(s => console.log(`     - ${s.name || 'No Name'} | ${s.email} | id: ${s.id}`));
        if (students.length > 10) console.log(`     ... and ${students.length - 10} more`);

        // Show parents
        const parents = (profiles || []).filter(p => p.role === 'parent');
        console.log(`\n  👨‍👩‍👧 Parents (${parents.length}):`);
        parents.forEach(p => {
            const linked = p.linked_students || [];
            console.log(`     - ${p.name || 'No Name'} | ${p.email} | linked_students: ${JSON.stringify(linked)}`);
        });
    }

    // ─── 3. ENROLLMENTS TABLE ────────────────────────────
    console.log('\n━━━ 3. ENROLLMENTS TABLE ━━━');
    const { data: enrollments, error: enrollErr } = await safeQuery('enrollments', () =>
        supabase.from('enrollments').select('*', { count: 'exact' })
    );
    if (enrollErr) {
        console.log(`  ❌ ERROR: ${enrollErr.message} (code: ${enrollErr.code})`);
    } else {
        console.log(`  ✅ Total enrollments: ${enrollments?.length || 0}`);
        if (enrollments && enrollments.length > 0) {
            // Group by course_id
            const byCourse = {};
            enrollments.forEach(e => {
                byCourse[e.course_id] = (byCourse[e.course_id] || 0) + 1;
            });
            console.log('  Enrollments by course:', JSON.stringify(byCourse));
        } else {
            console.log('  ⚠️ NO ENROLLMENTS - Students cannot see courses without enrollment');
        }
    }

    // ─── 4. TEST_SUBMISSIONS TABLE ───────────────────────
    console.log('\n━━━ 4. TEST_SUBMISSIONS TABLE ━━━');
    const { data: submissions, error: subErr } = await safeQuery('test_submissions', () =>
        supabase.from('test_submissions').select('id, user_id, course_id, raw_score_percentage, scaled_score, test_date, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(20)
    );
    if (subErr) {
        console.log(`  ❌ ERROR: ${subErr.message} (code: ${subErr.code})`);
    } else {
        console.log(`  ✅ Recent submissions (showing up to 20): ${submissions?.length || 0}`);
        if (submissions && submissions.length > 0) {
            submissions.slice(0, 5).forEach(s => {
                console.log(`     - Sub ID: ${s.id} | user: ${s.user_id?.substring(0, 8)}... | course: ${s.course_id} | score: ${s.raw_score_percentage}% | scaled: ${s.scaled_score} | date: ${s.test_date}`);
            });
        } else {
            console.log('  ⚠️ NO SUBMISSIONS - Score reports will be empty');
        }
    }

    // ─── 5. STUDENT_PROGRESS TABLE ───────────────────────
    console.log('\n━━━ 5. STUDENT_PROGRESS TABLE ━━━');
    const { data: progress, error: progErr } = await safeQuery('student_progress', () =>
        supabase.from('student_progress').select('*', { count: 'exact' })
    );
    if (progErr) {
        console.log(`  ❌ ERROR: ${progErr.message} (code: ${progErr.code})`);
    } else {
        console.log(`  ✅ Total progress records: ${progress?.length || 0}`);
    }

    // ─── 6. ENROLLMENT_KEYS TABLE ────────────────────────
    console.log('\n━━━ 6. ENROLLMENT_KEYS TABLE ━━━');
    const { data: keys, error: keysErr } = await safeQuery('enrollment_keys', () =>
        supabase.from('enrollment_keys').select('id, key_code, course_id, is_active, current_uses, max_uses, created_by')
    );
    if (keysErr) {
        console.log(`  ❌ ERROR: ${keysErr.message} (code: ${keysErr.code})`);
    } else {
        console.log(`  ✅ Total enrollment keys: ${keys?.length || 0}`);
        if (keys && keys.length > 0) {
            keys.forEach(k => {
                console.log(`     - Key: ${k.key_code} | course: ${k.course_id} | active: ${k.is_active} | uses: ${k.current_uses}/${k.max_uses || '∞'}`);
            });
        }
    }

    // ─── 7. QUESTIONS TABLE ──────────────────────────────
    console.log('\n━━━ 7. QUESTIONS TABLE ━━━');
    const { data: questions, error: qErr, count: qCount } = await safeQuery('questions', () =>
        supabase.from('questions').select('course_id', { count: 'exact' })
    );
    if (qErr) {
        console.log(`  ❌ ERROR: ${qErr.message} (code: ${qErr.code})`);
    } else {
        console.log(`  ✅ Total questions: ${questions?.length || 0}`);
        if (questions && questions.length > 0) {
            const byCourse = {};
            questions.forEach(q => {
                byCourse[q.course_id] = (byCourse[q.course_id] || 0) + 1;
            });
            console.log('  Questions by course:', JSON.stringify(byCourse));
        }
    }

    // ─── 8. GRADE_SCALES TABLE ───────────────────────────
    console.log('\n━━━ 8. GRADE_SCALES TABLE ━━━');
    const { data: scales, error: scaleErr } = await safeQuery('grade_scales', () =>
        supabase.from('grade_scales').select('*')
    );
    if (scaleErr) {
        console.log(`  ❌ ERROR: ${scaleErr.message} (code: ${scaleErr.code})`);
    } else {
        console.log(`  ✅ Total grade scales: ${scales?.length || 0}`);
    }

    // ─── 9. STUDENT_GROUPS TABLE ─────────────────────────
    console.log('\n━━━ 9. STUDENT_GROUPS TABLE ━━━');
    const { data: groups, error: groupErr } = await safeQuery('student_groups', () =>
        supabase.from('student_groups').select('*')
    );
    if (groupErr) {
        console.log(`  ❌ ERROR: ${groupErr.message} (code: ${groupErr.code})`);
    } else {
        console.log(`  ✅ Total student groups: ${groups?.length || 0}`);
    }

    // ─── 10. UPLOADS TABLE ───────────────────────────────
    console.log('\n━━━ 10. UPLOADS TABLE ━━━');
    const { data: uploads, error: uploadErr } = await safeQuery('uploads', () =>
        supabase.from('uploads').select('id, course_id, file_name, status, created_at', { count: 'exact' })
    );
    if (uploadErr) {
        console.log(`  ❌ ERROR: ${uploadErr.message} (code: ${uploadErr.code})`);
    } else {
        console.log(`  ✅ Total uploads: ${uploads?.length || 0}`);
    }

    // ─── 11. NOTIFICATION_OUTBOX TABLE ───────────────────
    console.log('\n━━━ 11. NOTIFICATION_OUTBOX TABLE ━━━');
    const { data: notifs, error: notifErr } = await safeQuery('notification_outbox', () =>
        supabase.from('notification_outbox').select('id, event_type, status, created_at', { count: 'exact' })
    );
    if (notifErr) {
        console.log(`  ❌ ERROR: ${notifErr.message} (code: ${notifErr.code})`);
    } else {
        console.log(`  ✅ Total notification_outbox: ${notifs?.length || 0}`);
    }

    // ─── 12. TEST_RESPONSES TABLE ────────────────────────
    console.log('\n━━━ 12. TEST_RESPONSES TABLE ━━━');
    const { data: responses, error: respErr } = await safeQuery('test_responses', () =>
        supabase.from('test_responses').select('id', { count: 'exact', head: true })
    );
    if (respErr) {
        console.log(`  ❌ ERROR: ${respErr.message} (code: ${respErr.code})`);
    } else {
        console.log(`  ✅ test_responses table exists`);
    }

    // ─── 13. CROSS-REFERENCE CHECKS ─────────────────────
    console.log('\n━━━ 13. CROSS-REFERENCE CHECKS ━━━');

    // Check if enrolled students exist in profiles
    if (enrollments && enrollments.length > 0 && profiles) {
        const profileIds = new Set((profiles || []).map(p => p.id));
        const orphanedEnrollments = enrollments.filter(e => !profileIds.has(e.user_id));
        if (orphanedEnrollments.length > 0) {
            console.log(`  ⚠️ Orphaned enrollments (user_id not in profiles): ${orphanedEnrollments.length}`);
        } else {
            console.log('  ✅ All enrollment user_ids match profiles');
        }

        // Check if enrolled course_ids exist in courses
        const courseIds = new Set((courses || []).map(c => c.id));
        const orphanedByCourse = enrollments.filter(e => !courseIds.has(e.course_id));
        if (orphanedByCourse.length > 0) {
            console.log(`  ⚠️ Orphaned enrollments (course_id not in courses): ${orphanedByCourse.length}`);
            const badIds = [...new Set(orphanedByCourse.map(e => e.course_id))];
            console.log(`     Bad course IDs: ${JSON.stringify(badIds)}`);
        } else {
            console.log('  ✅ All enrollment course_ids match courses');
        }
    }

    // Check if submissions reference valid courses
    if (submissions && submissions.length > 0 && courses) {
        const courseIds = new Set((courses || []).map(c => c.id));
        const badSubs = submissions.filter(s => !courseIds.has(s.course_id));
        if (badSubs.length > 0) {
            console.log(`  ⚠️ Submissions with invalid course_id: ${badSubs.length}`);
        } else {
            console.log('  ✅ All submissions reference valid courses');
        }
    }

    // Check parent → student linkage
    if (profiles) {
        const parents = profiles.filter(p => p.role === 'parent');
        const studentIds = new Set(profiles.filter(p => p.role === 'student').map(p => p.id));
        parents.forEach(p => {
            const linked = p.linked_students || [];
            const orphaned = linked.filter(sid => !studentIds.has(sid));
            if (orphaned.length > 0) {
                console.log(`  ⚠️ Parent "${p.name}" has ${orphaned.length} linked students not found in profiles`);
            }
        });
        if (parents.length > 0 && parents.every(p => (p.linked_students || []).every(sid => studentIds.has(sid)))) {
            console.log('  ✅ All parent-student linkages are valid');
        }
    }

    // Check tutor assigned courses
    if (profiles && courses) {
        const courseIds = new Set((courses || []).map(c => c.id));
        const tutors = profiles.filter(p => p.role === 'tutor');
        tutors.forEach(t => {
            const assigned = (t.assigned_courses || []).map(Number);
            const invalid = assigned.filter(id => !courseIds.has(id));
            if (invalid.length > 0) {
                console.log(`  ⚠️ Tutor "${t.name}" has assigned courses not in courses table: ${JSON.stringify(invalid)}`);
            }
        });
    }

    // ─── 14. RLS CHECK (via anon key) ────────────────────
    console.log('\n━━━ 14. RLS CHECK (fetching with anon key to see if data is visible) ━━━');
    const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (ANON_KEY) {
        const anonClient = createClient(SUPABASE_URL, ANON_KEY);
        
        const { data: anonCourses, error: anonCourseErr } = await anonClient.from('courses').select('id, name');
        if (anonCourseErr) {
            console.log(`  ❌ ANON (courses): ${anonCourseErr.message}`);
            console.log('     → RLS may be blocking unauthenticated reads on courses');
        } else {
            console.log(`  Anon courses visible: ${anonCourses?.length || 0}`);
            if (anonCourses?.length === 0) {
                console.log('  ⚠️ Courses not visible via anon key - RLS is filtering. This is expected if RLS requires authenticated role.');
            }
        }

        const { data: anonProfiles, error: anonProfileErr } = await anonClient.from('profiles').select('id', { count: 'exact', head: true });
        if (anonProfileErr) {
            console.log(`  ❌ ANON (profiles): ${anonProfileErr.message}`);
        } else {
            console.log(`  Anon profiles visible: ${anonProfiles?.length ?? 'N/A (head query)'}`);
        }
    } else {
        console.log('  ⚠️ No anon key found, skipping RLS check');
    }

    // ─── SUMMARY ─────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════');
    console.log('   DIAGNOSTIC SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    
    const issues = [];
    if (!courses || courses.length === 0) issues.push('NO COURSES in database');
    if (!profiles || profiles.length === 0) issues.push('NO PROFILES in database');
    if (!enrollments || enrollments.length === 0) issues.push('NO ENROLLMENTS - students cannot access courses');
    if (!submissions || submissions.length === 0) issues.push('NO TEST SUBMISSIONS - score reports will be empty');
    if (!progress || progress.length === 0) issues.push('NO STUDENT PROGRESS records');
    
    if (courseErr) issues.push(`Courses table error: ${courseErr.message}`);
    if (profileErr) issues.push(`Profiles table error: ${profileErr.message}`);
    if (enrollErr) issues.push(`Enrollments table error: ${enrollErr.message}`);
    if (subErr) issues.push(`Test submissions error: ${subErr.message}`);
    if (progErr) issues.push(`Student progress error: ${progErr.message}`);
    if (keysErr) issues.push(`Enrollment keys error: ${keysErr.message}`);
    
    if (issues.length === 0) {
        console.log('  ✅ All tables have data and are accessible!');
        console.log('  If the frontend still shows empty data, check:');
        console.log('    1. Backend server is running (npm run server)');
        console.log('    2. Frontend is pointing to correct backend URL');
        console.log('    3. User authentication is working (check auth tokens)');
        console.log('    4. RLS policies allow the authenticated user to read data');
    } else {
        console.log('  ⚠️ Issues found:');
        issues.forEach((issue, i) => console.log(`    ${i + 1}. ${issue}`));
    }
    
    console.log('\n═══════════════════════════════════════════════════\n');
}

runDiagnostics().catch(err => {
    console.error('Fatal diagnostic error:', err);
    process.exit(1);
});
