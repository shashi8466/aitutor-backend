// ============================================
// PERFORMANCE AUDIT TOOL
// Identifies slow-loading components
// ============================================

console.log('🔍 Starting Performance Audit...\n');

// Track load times for each component
const performanceMetrics = {
  dashboard: { startTime: 0, endTime: 0, loaded: false },
  courses: { startTime: 0, endTime: 0, loaded: false },
  chat: { startTime: 0, endTime: 0, loaded: false },
  content: { startTime: 0, endTime: 0, loaded: false },
  scores: { startTime: 0, endTime: 0, loaded: false }
};

// Mark when each component starts loading
export const markComponentStart = (componentName) => {
  if (performanceMetrics[componentName]) {
    performanceMetrics[componentName].startTime = performance.now();
    console.log(`⏱️ [${componentName.toUpperCase()}] Started loading at ${performanceMetrics[componentName].startTime.toFixed(2)}ms`);
  }
};

// Mark when each component finishes loading
export const markComponentEnd = (componentName, dataCount = 0) => {
  if (performanceMetrics[componentName]) {
    performanceMetrics[componentName].endTime = performance.now();
    performanceMetrics[componentName].loaded = true;
    const duration = performanceMetrics[componentName].endTime - performanceMetrics[componentName].startTime;
    
    console.log(`✅ [${componentName.toUpperCase()}] Loaded in ${duration.toFixed(2)}ms (${dataCount} items)`);
    
    // Flag slow components (>3 seconds)
    if (duration > 3000) {
      console.warn(`⚠️ [${componentName.toUpperCase()}] SLOW LOAD: ${duration.toFixed(2)}ms - Needs optimization!`);
    }
  }
};

// Generate audit report
export const generateAuditReport = () => {
  console.log('\n📊 ====== PERFORMANCE AUDIT REPORT ======\n');
  
  let totalIssues = 0;
  
  Object.entries(performanceMetrics).forEach(([name, metric]) => {
    if (metric.loaded) {
      const duration = metric.endTime - metric.startTime;
      const status = duration > 3000 ? '❌ SLOW' : duration > 1500 ? '⚠️ MODERATE' : '✅ GOOD';
      
      if (duration > 1500) totalIssues++;
      
      console.log(`${status} | ${name.padEnd(12)} | ${duration.toFixed(2).padStart(8)}ms`);
    } else {
      console.log(`❌ NOT LOADED | ${name.padEnd(12)}`);
      totalIssues++;
    }
  });
  
  console.log('\n========================================');
  console.log(`Total Issues Found: ${totalIssues}`);
  console.log('========================================\n');
  
  return performanceMetrics;
};

// Check API response times
export const auditAPIPerformance = async () => {
  console.log('🔍 Testing API Response Times...\n');
  
  const endpoints = [
    { name: 'Enrollments', url: '/api/enrollment/my-enrollments' },
    { name: 'Progress', url: '/api/progress/all' },
    { name: 'Courses', url: '/api/courses' },
    { name: 'Scores', url: '/api/grading/scores' },
    { name: 'Plan', url: '/api/plan' }
  ];
  
  for (const endpoint of endpoints) {
    const start = performance.now();
    try {
      const response = await fetch(endpoint.url);
      const end = performance.now();
      const duration = end - start;
      
      const status = duration > 2000 ? '❌ SLOW' : duration > 1000 ? '⚠️ MODERATE' : '✅ GOOD';
      console.log(`${status} | ${endpoint.name.padEnd(15)} | ${duration.toFixed(2).padStart(8)}ms | Status: ${response.status}`);
    } catch (error) {
      console.error(`❌ FAILED | ${endpoint.name.padEnd(15)} | ${error.message}`);
    }
  }
  
  console.log('\n');
};

// Usage Example:
/*
// In StudentDashboard.jsx
import { markComponentStart, markComponentEnd } from './utils/performanceAudit';

useEffect(() => {
  markComponentStart('dashboard');
  
  loadAllData().then(() => {
    markComponentEnd('dashboard', rawData.enrollments.length);
  });
}, []);
*/
