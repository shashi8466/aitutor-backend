/**
 * Standalone Google Gemini API Test Script
 * Run with: node test-gemini.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

console.log('🧪 Testing Google Gemini API Connection...\n');

if (!apiKey) {
  console.error('❌ API Key not found in environment variables');
  process.exit(1);
}

if (!apiKey.startsWith('AIza')) {
  console.error('⚠️ Warning: This does not look like a Google Gemini key');
  console.error('Expected format: AIza...');
}

console.log('✅ API Key found (length:', apiKey.length, ')');
console.log('🔑 Key prefix:', apiKey.substring(0, 20) + '...\n');

async function testConnection() {
  try {
    console.log('📡 Sending test request to Google Gemini...\n');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent("Say 'Hello, I am working!' if you can read this.");
    const response = result.response;
    const text = response.text();

    console.log('✅ SUCCESS! Google Gemini API is working correctly.\n');
    console.log('📩 Response:', text);
    console.log('\n✅ Your API key is valid and the service is operational.');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
    if (error.status === 404) {
      console.error('\n🔍 404 Error Diagnosis:');
      console.error('- The API endpoint might be incorrect');
      console.error('- Check if the model name is valid (gemini-1.5-flash)');
    } else if (error.status === 403 || error.status === 401) {
      console.error('\n🔍 Authentication Error:');
      console.error('- Your API key might be invalid or expired');
      console.error('- Check if you have enabled the Gemini API in Google Cloud Console');
      console.error('- Verify billing is set up: https://console.cloud.google.com/billing');
    }
    
    process.exit(1);
  }
}

testConnection();