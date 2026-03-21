// ============================================
// COMPLETE BACKEND DIAGNOSTIC TOOL
// Run this in browser console to test ALL APIs
// ============================================

console.log('🔍 Starting Complete Backend Diagnostic...\n');

async function diagnoseAllTables() {
  const results = {
    auth: false,
    profile: null,
    courses: null,
    enrollments: null,
    groups: null,
    submissions: null,
    uploads: null,
    questions: null,
    knowledgeBase: null,
    notifications: null
  };

  // ========== AUTH CHECK ==========
  console.log('📝 Step 1: Checking Authentication...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ NOT LOGGED IN - Please login first');
    return;
  }
  
  results.auth = true;
  console.log('✅ Logged in as:', session.user.email);
  
  // ========== PROFILE CHECK ==========
  console.log('\n📝 Step 2: Checking Profile...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Profile Error:', profileError.message);
  } else {
    results.profile = profile;
    console.log('✅ Profile found:');
    console.log('   Name:', profile.name);
    console.log('   Email:', profile.email);
    console.log('   Role:', profile.role);
  }

  // ========== COURSES CHECK ==========
  console.log('\n📝 Step 3: Checking Courses...');
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (coursesError) {
    console.error('❌ Courses Error:', coursesError.message);
    results.courses = { error: coursesError.message };
  } else {
    results.courses = courses;
    console.log(`✅ Found ${courses.length} courses`);
    if (courses.length > 0) {
      console.log('   Latest course:', courses[0]?.name);
      console.log('   Sample:', {
        id: courses[0]?.id,
        name: courses[0]?.name,
        category: courses[0]?.category
      });
    }
  }

  // ========== ENROLLMENTS CHECK ==========
  console.log('\n📝 Step 4: Checking Enrollments...');
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select(`
      *,
      course:courses(name),
      user:profiles(name)
    `)
    .limit(5);
  
  if (enrollmentsError) {
    console.error('❌ Enrollments Error:', enrollmentsError.message);
    results.enrollments = { error: enrollmentsError.message };
  } else {
    results.enrollments = enrollments;
    console.log(`✅ Found ${enrollments.length} enrollments`);
    if (enrollments.length > 0) {
      console.log('   Sample enrollment:', {
        id: enrollments[0]?.id,
        user: enrollments[0]?.user?.name,
        course: enrollments[0]?.course?.name
      });
    }
  }

  // ========== GROUPS CHECK ==========
  console.log('\n📝 Step 5: Checking Groups...');
  try {
    const { data: groups, error: groupsError } = await supabase
      .from('groups_table')
      .select('*')
      .limit(5);
    
    if (groupsError) {
      if (groupsError.message.includes('does not exist')) {
        console.warn('⚠️ Groups table does not exist - skipping');
        results.groups = { skipped: 'Table does not exist' };
      } else {
        console.error('❌ Groups Error:', groupsError.message);
        results.groups = { error: groupsError.message };
      }
    } else {
      results.groups = groups || [];
      console.log(`✅ Found ${groups?.length || 0} groups`);
      if (groups && groups.length > 0) {
        console.log('   Latest group:', groups[0]?.name);
      }
    }
  } catch (e) {
    console.warn('⚠️ Groups table may not exist or accessible');
    results.groups = { skipped: 'Table may not exist' };
  }

  // ========== TEST SUBMISSIONS CHECK ==========
  console.log('\n📝 Step 6: Checking Test Submissions...');
  const { data: submissions, error: submissionsError } = await supabase
    .from('test_submissions')
    .select(`
      *,
      course:courses(name)
    `)
    .order('test_date', { ascending: false })
    .limit(5);
  
  if (submissionsError) {
    console.error('❌ Submissions Error:', submissionsError.message);
    results.submissions = { error: submissionsError.message };
  } else {
    results.submissions = submissions;
    console.log(`✅ Found ${submissions.length} submissions`);
    if (submissions.length > 0) {
      console.log('   Latest submission:', {
        id: submissions[0]?.id,
        course: submissions[0]?.course?.name,
        score: submissions[0]?.score
      });
    }
  }

  // ========== UPLOADS CHECK ==========
  console.log('\n📝 Step 7: Checking Uploads...');
  const { data: uploads, error: uploadsError } = await supabase
    .from('uploads')
    .select(`
      *,
      course:courses(name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (uploadsError) {
    console.error('❌ Uploads Error:', uploadsError.message);
    results.uploads = { error: uploadsError.message };
  } else {
    results.uploads = uploads;
    console.log(`✅ Found ${uploads.length} uploads`);
    if (uploads.length > 0) {
      console.log('   Latest upload:', {
        id: uploads[0]?.id,
        filename: uploads[0]?.file_name,
        course: uploads[0]?.course?.name
      });
    }
  }

  // ========== QUESTIONS CHECK ==========
  console.log('\n📝 Step 8: Checking Questions...');
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (questionsError) {
    console.error('❌ Questions Error:', questionsError.message);
    results.questions = { error: questionsError.message };
  } else {
    results.questions = questions;
    console.log(`✅ Found ${questions.length} questions`);
    if (questions.length > 0) {
      console.log('   Sample question:', {
        id: questions[0]?.id,
        text: questions[0]?.question_text?.substring(0, 50) + '...',
        difficulty: questions[0]?.difficulty
      });
    }
  }

  // ========== KNOWLEDGE BASE CHECK ==========
  console.log('\n📝 Step 9: Checking Knowledge Base...');
  const { data: knowledgeBase, error: kbError } = await supabase
    .from('knowledge_base')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (kbError) {
    console.error('❌ Knowledge Base Error:', kbError.message);
    results.knowledgeBase = { error: kbError.message };
  } else {
    results.knowledgeBase = knowledgeBase;
    console.log(`✅ Found ${knowledgeBase.length} knowledge base entries`);
    if (knowledgeBase.length > 0) {
      console.log('   Latest entry:', {
        id: knowledgeBase[0]?.id,
        title: knowledgeBase[0]?.title,
        category: knowledgeBase[0]?.category
      });
    }
  }

  // ========== NOTIFICATIONS CHECK ==========
  console.log('\n📝 Step 10: Checking Notifications...');
  const { data: notifications, error: notifError } = await supabase
    .from('notification_outbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (notifError) {
    console.error('❌ Notifications Error:', notifError.message);
    results.notifications = { error: notifError.message };
  } else {
    results.notifications = notifications;
    console.log(`✅ Found ${notifications.length} notifications`);
    if (notifications.length > 0) {
      console.log('   Latest notification:', {
        id: notifications[0]?.id,
        recipient: notifications[0]?.recipient_profile_id,
        type: notifications[0]?.notification_type,
        status: notifications[0]?.status
      });
    }
  }

  // ========== FINAL SUMMARY ==========
  console.log('\n==========================================');
  console.log('📊 COMPLETE DATABASE DIAGNOSTIC SUMMARY');
  console.log('==========================================');
  
  const summary = [
    ['Authentication', results.auth ? '✅ Working' : '❌ Failed'],
    ['Profile', results.profile ? `✅ ${results.profile.role}` : '❌ Error'],
    ['Courses', Array.isArray(results.courses) ? `✅ ${results.courses.length} courses` : '❌ Error'],
    ['Enrollments', Array.isArray(results.enrollments) ? `✅ ${results.enrollments.length} enrollments` : '❌ Error'],
    ['Groups', Array.isArray(results.groups) ? `✅ ${results.groups.length} groups` : results.groups?.error || '❌ Error'],
    ['Submissions', Array.isArray(results.submissions) ? `✅ ${results.submissions.length} submissions` : '❌ Error'],
    ['Uploads', Array.isArray(results.uploads) ? `✅ ${results.uploads.length} uploads` : '❌ Error'],
    ['Questions', Array.isArray(results.questions) ? `✅ ${results.questions.length} questions` : '❌ Error'],
    ['Knowledge Base', Array.isArray(results.knowledgeBase) ? `✅ ${results.knowledgeBase.length} entries` : '❌ Error'],
    ['Notifications', Array.isArray(results.notifications) ? `✅ ${results.notifications.length} notifications` : '❌ Error']
  ];
  
  summary.forEach(([table, status]) => {
    console.log(`${table.padEnd(20)} ${status}`);
  });
  
  console.log('==========================================\n');
  
  // ========== RECOMMENDATIONS ==========
  const errors = summary.filter(([_, status]) => status.startsWith('❌'));
  
  if (errors.length === 0) {
    console.log('🎉 ALL TABLES ARE WORKING CORRECTLY!');
    console.log('\n✅ Your database is fully functional.');
    console.log('✅ All RLS policies are properly configured.');
    console.log('✅ You can access all data from the frontend.');
  } else {
    console.log('⚠️ ISSUES FOUND:\n');
    errors.forEach(([table, status]) => {
      console.log(`- ${table}: ${status}`);
    });
    
    console.log('\n💡 RECOMMENDED FIX:');
    console.log('Run this SQL script in Supabase SQL Editor:');
    console.log('→ FIX_ALL_TABLES_RLS.sql\n');
    console.log('This will fix RLS policies for all tables.');
  }
  
  // Return results for programmatic use
  return results;
}

// Run the diagnostic
diagnoseAllTables();
