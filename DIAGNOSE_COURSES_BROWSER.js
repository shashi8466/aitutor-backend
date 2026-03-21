// ============================================
// COPY AND PASTE THIS IN BROWSER CONSOLE
// Run on any page to diagnose courses issue
// ============================================

console.log('🔍 Starting Course System Diagnostic...\n');

async function diagnoseCourses() {
  // Step 1: Check authentication
  console.log('📝 Step 1: Checking authentication...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ NOT LOGGED IN!');
    console.log('   → Please login first');
    return;
  }
  
  console.log('✅ Logged in as:', session.user.email);
  
  // Step 2: Check user role
  console.log('\n📝 Step 2: Checking your role...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, name, email')
    .eq('id', session.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message);
    return;
  }
  
  console.log('✅ Profile found:');
  console.log('   Name:', profile.name);
  console.log('   Email:', profile.email);
  console.log('   Role:', profile.role);
  
  // Step 3: Try to fetch courses using Supabase client
  console.log('\n📝 Step 3: Fetching courses from database...');
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (coursesError) {
    console.error('❌ Error fetching courses:', coursesError);
    console.log('   Message:', coursesError.message);
    console.log('   Details:', coursesError.details);
    console.log('   Hint:', coursesError.hint);
  } else {
    console.log(`✅ Found ${courses.length} courses`);
    if (courses.length > 0) {
      console.log('   First course:', courses[0]);
      console.log('   Latest course:', courses[0]?.name);
    } else {
      console.warn('   ⚠️ No courses in database!');
      console.log('   → Admin needs to create courses first');
    }
  }
  
  // Step 4: Try API endpoint
  console.log('\n📝 Step 4: Testing backend API endpoint...');
  try {
    const response = await fetch('/api/tutor/courses', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('API Response:', data);
    
    if (response.status === 200) {
      if (data.courses && Array.isArray(data.courses)) {
        console.log(`✅ API returned ${data.courses.length} courses`);
      } else if (data.message) {
        console.warn('   ⚠️ API message:', data.message);
      } else {
        console.error('   ❌ Unexpected API response format');
      }
    } else {
      console.error('   ❌ API error:', response.status);
    }
  } catch (error) {
    console.error('   ❌ Network error calling API:', error);
  }
  
  // Step 5: Check RLS policies
  console.log('\n📝 Step 5: Checking database permissions...');
  const { count: courseCount } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });
  
  console.log('Course count via RLS:', courseCount || 0);
  
  if ((courseCount || 0) === 0 && courses && courses.length === 0) {
    console.log('   ✅ Confirmed: No courses exist OR RLS blocking access');
  }
  
  // Step 6: Summary and recommendations
  console.log('\n==========================================');
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('==========================================');
  console.log('Authentication:', session ? '✅ Logged in' : '❌ Not logged in');
  console.log('Your role:', profile?.role || 'Unknown');
  console.log('Courses in DB:', courses ? courses.length : 'Query failed');
  console.log('API Status:', response?.status || 'Not tested');
  console.log('==========================================\n');
  
  // Recommendations
  if (!courses || courses.length === 0) {
    console.log('💡 RECOMMENDATIONS:');
    console.log('');
    console.log('1. If courses exist but not showing:');
    console.log('   → Run DIAGNOSE_COURSES_ISSUE.sql in Supabase');
    console.log('   → This will fix RLS policies');
    console.log('');
    console.log('2. If no courses exist:');
    console.log('   → Go to /admin → Create a course');
    console.log('   → Or use Course Management to add courses');
    console.log('');
    console.log('3. Check backend logs for errors:');
    console.log('   → Look for "GET /api/tutor/courses" requests');
    console.log('   → Check for 500 errors or permission issues');
  } else {
    console.log('✅ Courses are working correctly!');
    console.log('   If not showing in UI, check:');
    console.log('   - Component state management');
    console.log('   - Network tab for failed requests');
    console.log('   - Browser console for JavaScript errors');
  }
}

// Run the diagnostic
diagnoseCourses();
