// ============================================
// COPY AND PASTE THIS IN BROWSER CONSOLE
// ============================================
// Run this on the /admin/notifications page to diagnose the 401 error
// ============================================

console.log('🔍 Starting Admin Notification Diagnostic...\n');

async function diagnoseAdminIssue() {
  // Step 1: Check if logged in
  console.log('📝 Step 1: Checking authentication...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ NOT LOGGED IN!');
    console.log('   → Please login at /login');
    return;
  }
  
  console.log('✅ Logged in as:', session.user.email);
  console.log('   User ID:', session.user.id);
  console.log('   Token present:', !!session.access_token);
  
  // Step 2: Check profile role
  console.log('\n📝 Step 2: Checking your role in database...');
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
  
  if (profile.role !== 'admin') {
    console.error('❌ YOUR ROLE IS NOT ADMIN!');
    console.log('   Current role:', profile.role);
    console.log('   → Run this in Supabase SQL Editor:');
    console.log(`   UPDATE profiles SET role = 'admin' WHERE email = '${profile.email}';`);
    console.log('   → Then logout and login again');
    return;
  }
  
  console.log('✅ You are an admin!');
  
  // Step 3: Test API call directly
  console.log('\n📝 Step 3: Testing students API endpoint...');
  try {
    const response = await fetch('/api/admin/students-with-preferences', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.status === 401) {
      console.error('❌ 401 UNAUTHORIZED');
      console.log('   Details:', data.error || data.details);
      console.log('   → This means the token validation failed');
      console.log('   → Try logout and login again');
    } else if (data.success && data.students) {
      console.log(`✅ Found ${data.students.length} students`);
      if (data.students.length > 0) {
        console.log('   First student:', data.students[0].name);
      } else {
        console.warn('   ⚠️ No students in database');
        console.log('   → Create student accounts first');
      }
    } else {
      console.error('❌ Unexpected response:', data);
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
  
  // Step 4: Test parents API
  console.log('\n📝 Step 4: Testing parents API endpoint...');
  try {
    const response = await fetch('/api/admin/parents-with-preferences', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.status === 401) {
      console.error('❌ 401 UNAUTHORIZED for parents endpoint');
    } else if (data.success && data.parents) {
      console.log(`✅ Found ${data.parents.length} parents`);
      if (data.parents.length > 0) {
        console.log('   First parent:', data.parents[0].name);
      } else {
        console.warn('   ⚠️ No parents in database');
        console.log('   → Create parent accounts first');
      }
    }
  } catch (error) {
    console.error('❌ Network error:', error);
  }
  
  // Step 5: Count all users in database
  console.log('\n📝 Step 5: Counting all users in database...');
  const { count: studentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student');
  
  const { count: parentCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'parent');
  
  const { count: adminCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');
  
  console.log('Database counts:');
  console.log('   Students:', studentCount || 0);
  console.log('   Parents:', parentCount || 0);
  console.log('   Admins:', adminCount || 0);
  
  if ((studentCount || 0) === 0 && (parentCount || 0) === 0) {
    console.warn('\n⚠️ WARNING: No students or parents in database!');
    console.log('   → You need to create user accounts');
    console.log('   → Or have users sign up through the app');
  }
  
  console.log('\n✅ Diagnostic complete!\n');
  console.log('Summary:');
  console.log('--------');
  if (profile.role === 'admin') {
    if ((studentCount || 0) > 0) {
      console.log('✅ You are admin');
      console.log('✅ Students exist in database');
      console.log('❌ But API returns 401 → Authentication/RLS issue');
      console.log('\n   Recommended fix:');
      console.log('   1. Logout and login again');
      console.log('   2. Check backend logs for detailed errors');
      console.log('   3. Check RLS policies in database');
    } else {
      console.log('✅ You are admin');
      console.log('⚠️ No students in database');
      console.log('\n   Recommended fix:');
      console.log('   Create student accounts first');
    }
  } else {
    console.log('❌ You are NOT an admin (role:', profile.role + ')');
    console.log('\n   Recommended fix:');
    console.log(`   UPDATE profiles SET role = 'admin' WHERE email = '${profile.email}';`);
    console.log('   Then logout and login again');
  }
}

// Run the diagnostic
diagnoseAdminIssue();
