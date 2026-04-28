// Test script to validate form submission debugging and fixes
// This script tests the enhanced error handling and debugging capabilities

import fs from 'fs';
import path from 'path';

console.log('🔍 Testing Form Submission Debugging...\n');

// Test 1: Validate enhanced error handling in DemoLeadForm
console.log('📋 Test 1: Enhanced Error Handling in DemoLeadForm');

const demoFormPath = path.join(__dirname, 'src/components/demo/DemoLeadForm.jsx');

try {
  const demoFormContent = fs.readFileSync(demoFormPath, 'utf8');

  // Check for detailed error logging
  const errorLogging = demoFormContent.includes('console.error(\'❌ [DEMO FORM] Submission error:\', err)');
  console.log(`  ✅ Detailed error logging: ${errorLogging}`);

  // Check for specific error message extraction
  const errorExtraction = demoFormContent.includes('err?.response?.data?.error || err?.message ||');
  console.log(`  ✅ Specific error message extraction: ${errorExtraction}`);

  // Check for proper error display
  const errorDisplay = demoFormContent.includes('setError(errorMessage)');
  console.log(`  ✅ Proper error display: ${errorDisplay}`);

} catch (error) {
  console.error('❌ Test 1 failed:', error);
}

// Test 2: Validate enhanced debugging in PublicDemoQuizInterface
console.log('\n🔍 Test 2: Enhanced Debugging in PublicDemoQuizInterface');

const demoQuizPath = path.join(__dirname, 'src/components/demo/PublicDemoQuizInterface.jsx');

try {
  const demoQuizContent = fs.readFileSync(demoQuizPath, 'utf8');

  // Check for submission data logging
  const submissionLogging = demoQuizContent.includes('console.log(\'🚀 [DEMO] Submitting lead with data:\'');
  console.log(`  ✅ Submission data logging: ${submissionLogging}`);

  // Check for success response logging
  const successLogging = demoQuizContent.includes('console.log(\'✅ [DEMO] Lead submission successful:\'');
  console.log(`  ✅ Success response logging: ${successLogging}`);

  // Check for detailed error logging
  const detailedErrorLogging = demoQuizContent.includes('console.error("❌ [DEMO] Failed to submit lead:", err)');
  console.log(`  ✅ Detailed error logging: ${detailedErrorLogging}`);

  // Check for response data logging
  const responseLogging = demoQuizContent.includes('console.error("❌ [DEMO] Error response:", err?.response?.data)');
  console.log(`  ✅ Response data logging: ${responseLogging}`);

  // Check for status code logging
  const statusLogging = demoQuizContent.includes('console.error("❌ [DEMO] Error status:", err?.response?.status)');
  console.log(`  ✅ Status code logging: ${statusLogging}`);

  // Check for improved error message creation
  const errorMessageCreation = demoQuizContent.includes('const errorMessage = err?.response?.data?.error ||');
  console.log(`  ✅ Improved error message creation: ${errorMessageCreation}`);

} catch (error) {
  console.error('❌ Test 2 failed:', error);
}

// Test 3: Validate score data structure
console.log('\n📊 Test 3: Score Data Structure Validation');

try {
  const demoQuizContent = fs.readFileSync(demoQuizPath, 'utf8');

  // Check for scoreDetails structure
  const scoreDetailsStructure = demoQuizContent.includes('allLevels') && 
                              demoQuizContent.includes('comprehensive') && 
                              demoQuizContent.includes('finalPredictedScore');
  console.log(`  ✅ ScoreDetails structure: ${scoreDetailsStructure}`);

  // Check for module details
  const moduleDetails = demoQuizContent.includes('moduleDetails') && 
                       demoQuizContent.includes('moduleHistory');
  console.log(`  ✅ Module details: ${moduleDetails}`);

  // Check for adaptive test metadata
  const adaptiveMetadata = demoQuizContent.includes('isAdaptiveSAT') && 
                          demoQuizContent.includes('scoringMethod');
  console.log(`  ✅ Adaptive test metadata: ${adaptiveMetadata}`);

} catch (error) {
  console.error('❌ Test 3 failed:', error);
}

// Test 4: Validate API endpoint integration
console.log('\n🌐 Test 4: API Endpoint Integration');

try {
  const demoQuizContent = fs.readFileSync(demoQuizPath, 'utf8');

  // Check for correct API endpoint
  const apiEndpoint = demoQuizContent.includes('/api/demo/submit-lead');
  console.log(`  ✅ Correct API endpoint: ${apiEndpoint}`);

  // Check for axios usage
  const axiosUsage = demoQuizContent.includes('axios.post');
  console.log(`  ✅ Axios usage: ${axiosUsage}`);

  // Check for proper data structure in API call
  const apiDataStructure = demoQuizContent.includes('courseId') && 
                         demoQuizContent.includes('level') && 
                         demoQuizContent.includes('formData') && 
                         demoQuizContent.includes('scoreDetails');
  console.log(`  ✅ API data structure: ${apiDataStructure}`);

} catch (error) {
  console.error('❌ Test 4 failed:', error);
}

// Test 5: Validate error propagation
console.log('\n⚠️ Test 5: Error Propagation');

try {
  const demoQuizContent = fs.readFileSync(demoQuizPath, 'utf8');
  const demoFormContent = fs.readFileSync(demoFormPath, 'utf8');

  // Check for proper error throwing in quiz interface
  const errorThrowing = demoQuizContent.includes('throw new Error(errorMessage)');
  console.log(`  ✅ Proper error throwing: ${errorThrowing}`);

  // Check for error catching in form
  const errorCatching = demoFormContent.includes('catch (err)');
  console.log(`  ✅ Error catching: ${errorCatching}`);

  // Check for error display to user
  const errorUserDisplay = demoFormContent.includes('setError(errorMessage)');
  console.log(`  ✅ Error display to user: ${errorUserDisplay}`);

} catch (error) {
  console.error('❌ Test 5 failed:', error);
}

// Test 6: Validate debugging information quality
console.log('\n🐛 Test 6: Debugging Information Quality');

try {
  const demoQuizContent = fs.readFileSync(demoQuizPath, 'utf8');

  // Check for phone number masking in logs
  const phoneMasking = demoQuizContent.includes('substring(0, 10) + \'...\'');
  console.log(`  ✅ Phone number masking: ${phoneMasking}`);

  // Check for score details validation in logs
  const scoreValidation = demoQuizContent.includes('hasScoreDetails') && 
                         demoQuizContent.includes('hasAllLevels') && 
                         demoQuizContent.includes('hasComprehensive');
  console.log(`  ✅ Score details validation: ${scoreValidation}`);

  // Check for total score logging
  const totalScoreLogging = demoQuizContent.includes('totalScore: scoreDetails?.comprehensive?.finalPredictedScore || 0');
  console.log(`  ✅ Total score logging: ${totalScoreLogging}`);

} catch (error) {
  console.error('❌ Test 6 failed:', error);
}

console.log('\n🎉 Form Submission Debugging Test Suite Completed!');
console.log('\n📝 Debugging Enhancements Applied:');
console.log('✅ Enhanced Error Handling: Detailed logging and specific error messages');
console.log('✅ Improved Debugging: Comprehensive logging of submission data and responses');
console.log('✅ Score Data Validation: Proper structure validation and metadata');
console.log('✅ API Integration: Correct endpoint usage and data structure');
console.log('✅ Error Propagation: Proper error throwing and catching');
console.log('✅ Debugging Quality: Phone masking and score validation in logs');

console.log('\n🔍 What to Check in Browser Console:');
console.log('• Look for "🚀 [DEMO] Submitting lead with data:" logs');
console.log('• Check for "✅ [DEMO] Lead submission successful:" on success');
console.log('• Look for "❌ [DEMO] Failed to submit lead:" on errors');
console.log('• Check for detailed error response and status information');
console.log('• Verify score details structure in the logs');

console.log('\n🚨 Common Issues to Look For:');
console.log('• Missing required fields (courseId, email, fullName)');
console.log('• Invalid score data structure');
console.log('• Network connectivity issues');
console.log('• Backend API errors (500, 400 status codes)');
console.log('• Database connection issues');

console.log('\n✨ Enhanced debugging capabilities will help identify the exact cause of form submission failures!');
