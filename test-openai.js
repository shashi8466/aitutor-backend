/**
 * Standalone OpenAI API Test Script
 * Run with: node test-openai.js
 */
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

console.log('🧪 Testing OpenAI API Connection...\n');

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

console.log('✅ API Key found (length:', apiKey.length, ')');
console.log('🔑 Key prefix:', apiKey.substring(0, 20) + '...\n');

// ✅ Correct initialization (no custom baseURL)
const openai = new OpenAI({
  apiKey: apiKey,
});

async function testConnection() {
  try {
    console.log('📡 Sending test request to OpenAI...\n');
    
    // ✅ Updated to use gpt-4o-mini instead of deprecated gpt-3.5-turbo
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ Latest small model
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say 'Hello, I am working!' if you can read this." }
      ],
      max_tokens: 50
    });

    console.log('✅ SUCCESS! OpenAI API is working correctly.\n');
    console.log('📩 Response:', completion.choices[0].message.content);
    console.log('\n✅ Your API key is valid and the model is accessible.');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.status === 404) {
      console.error('\n🔍 404 Error Diagnosis:');
      console.error('- The model "gpt-3.5-turbo" may have been deprecated');
      console.error('- Try using "gpt-4o-mini" instead (the latest small model)');
      console.error('- Check available models at: https://platform.openai.com/docs/models');
    }
    
    if (error.status === 401) {
      console.error('\n🔍 401 Authentication Error:');
      console.error('- Your API key may be invalid or expired');
      console.error('- Generate a new key at: https://platform.openai.com/api-keys');
    }
    
    process.exit(1);
  }
}

testConnection();
