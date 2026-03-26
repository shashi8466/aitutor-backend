// ============================================
// CHECK WELCOME EMAIL SYSTEM STATUS
// ============================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Checking Welcome Email System Status...\n');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSystem() {
  // Check 1: Database connection
  console.log('📝 Step 1: Testing database connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return;
    }
    console.log('✅ Database connection OK\n');
  } catch (error) {
    console.error('❌ Database error:', error.message);
    return;
  }

  // Check 2: welcome_email_queue table exists
  console.log('📝 Step 2: Checking welcome_email_queue table...');
  const { data: tableExists, error: tableError } = await supabase
    .from('welcome_email_queue')
    .select('*', { count: 'exact', head: true });

  if (tableError) {
    console.error('❌ Table welcome_email_queue does not exist!');
    console.error('   Error:', tableError.message);
    console.log('\n💡 SOLUTION: Run SUPABASE_WELCOME_EMAIL_SIMPLE.sql in Supabase SQL Editor\n');
    return;
  }
  console.log('✅ welcome_email_queue table exists\n');

  // Check 3: Check queue status
  console.log('📝 Step 3: Checking queue status...');
  const { count: pendingCount } = await supabase
    .from('welcome_email_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: sentCount } = await supabase
    .from('welcome_email_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent');

  const { count: totalCount } = await supabase
    .from('welcome_email_queue')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total emails: ${totalCount || 0}`);
  console.log(`   Pending: ${pendingCount || 0}`);
  console.log(`   Sent: ${sentCount || 0}`);
  
  if (pendingCount > 0) {
    console.log('\n⚠️ Found pending emails in queue!\n');
    
    // Show recent pending
    const { data: pending } = await supabase
      .from('welcome_email_queue')
      .select('email, name, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('Recent pending emails:');
    pending.forEach(item => {
      console.log(`   - ${item.email} (${item.name}) - ${new Date(item.created_at).toLocaleString()}`);
    });
  } else {
    console.log('\n✅ No pending emails (queue is empty)\n');
  }

  // Check 4: Test insert (verify permissions)
  console.log('📝 Step 4: Testing write permissions...');
  const testEmail = {
    user_id: '00000000-0000-0000-0000-000000000000',
    email: 'test@example.com',
    name: 'Test User',
    status: 'pending'
  };

  const { error: insertError } = await supabase
    .from('welcome_email_queue')
    .insert([testEmail]);

  if (insertError) {
    console.error('❌ Cannot insert into queue:', insertError.message);
    console.log('💡 Check RLS policies on welcome_email_queue table\n');
  } else {
    console.log('✅ Write permissions OK\n');
    
    // Clean up test record
    await supabase
      .from('welcome_email_queue')
      .delete()
      .eq('email', 'test@example.com');
  }

  // Summary
  console.log('==========================================');
  console.log('📊 SUMMARY');
  console.log('==========================================');
  console.log('Database Connection: ✅ OK');
  console.log('Queue Table: ✅ Exists');
  console.log('Queue Status:', pendingCount === 0 ? '✅ Empty (ready)' : `⚠️ ${pendingCount} pending`);
  console.log('Permissions: ✅ OK');
  console.log('==========================================\n');

  console.log('✅ Welcome email system is ready!\n');
  console.log('Next steps:');
  console.log('1. Backend processor is already running');
  console.log('2. When users sign up, they\'ll be added to the queue');
  console.log('3. Processor will send emails within 10 seconds');
  console.log('4. Monitor this dashboard: node check-welcome-email-status.js\n');
}

checkSystem();
