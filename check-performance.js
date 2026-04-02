// ============================================
// QUICK PERFORMANCE DIAGNOSTIC
// Run this in browser console to identify slow components
// ============================================

console.log('🔍 AI Tutor Performance Diagnostic\n');
console.log('=====================================');
console.log('Checking component load times...\n');

// Track all console logs for 10 seconds
const logs = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  logs.push({ type: 'log', message: args.join(' '), time: performance.now() });
  originalLog(...args);
};

console.warn = (...args) => {
  logs.push({ type: 'warn', message: args.join(' '), time: performance.now() });
  originalWarn(...args);
};

console.error = (...args) => {
  logs.push({ type: 'error', message: args.join(' '), time: performance.now() });
  originalError(...args);
};

// Wait for user to navigate around, then analyze
setTimeout(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  
  console.log('\n📊 ====== PERFORMANCE ANALYSIS ======\n');
  
  // Find loading-related messages
  const loadingLogs = logs.filter(log => 
    log.message.toLowerCase().includes('load') ||
    log.message.toLowerCase().includes('fetch') ||
    log.message.includes('⏱️') ||
    log.message.includes('✅') ||
    log.message.includes('❌')
  );
  
  if (loadingLogs.length === 0) {
    console.log('ℹ️ No loading activity detected yet.');
    console.log('👉 Navigate to different pages (Dashboard, Chat, Courses, Quiz) and run this again.');
  } else {
    console.log(`Found ${loadingLogs.length} loading events:\n`);
    
    loadingLogs.forEach((log, i) => {
      const time = (log.time / 1000).toFixed(2);
      console.log(`${i + 1}. [${time}s] ${log.type.toUpperCase()}: ${log.message}`);
    });
    
    // Look for errors
    const errors = logs.filter(log => log.type === 'error');
    if (errors.length > 0) {
      console.log(`\n⚠️ Found ${errors.length} errors:`);
      errors.forEach(err => console.log('  -', err.message));
    }
    
    // Look for warnings
    const warnings = logs.filter(log => log.type === 'warn');
    if (warnings.length > 0) {
      console.log(`\n⚠️ Found ${warnings.length} warnings:`);
      warnings.forEach(warn => console.log('  -', warn.message));
    }
  }
  
  console.log('\n========================================');
  console.log('💡 TIP: Check for these common issues:');
  console.log('  ❌ SLOW LOAD messages (>3000ms)');
  console.log('  ⚠️ Failed fetch requests');
  console.log('  ⚠️ Multiple sequential API calls');
  console.log('  ❌ Long gaps between start and loaded');
  console.log('\n📋 Full audit plan saved in: PERFORMANCE_FIX_PLAN.md');
  console.log('=====================================\n');
  
}, 10000);

console.log('✅ Monitoring started...');
console.log('👉 Navigate through: Dashboard → Chat → Courses → Quiz');
console.log('⏱️ Analysis will appear in 10 seconds\n');
