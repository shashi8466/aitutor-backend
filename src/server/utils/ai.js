import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('🔧 Initializing AI Utils...');

// Initialize keys
const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

console.log('🔑 API Key status:', apiKey ? 'Found' : 'Missing');
console.log('🔑 API Key type:', apiKey?.startsWith('AIza') ? 'Google Gemini' : apiKey?.startsWith('sk-') ? 'OpenAI' : 'Unknown');

// Determine provider
const isGoogleKey = apiKey?.startsWith('AIza');

// Initialize Clients
let openai;
let genAI;

try {
  if (apiKey) {
    if (isGoogleKey) {
      console.log('🤖 Initializing Google Gemini Client...');
      genAI = new GoogleGenerativeAI(apiKey);
      console.log('✅ Google Gemini client initialized');
    } else {
      console.log('🤖 Initializing OpenAI Client...');
      openai = new OpenAI({
        apiKey: apiKey,
      });
      console.log('✅ OpenAI client initialized successfully');
    }
  } else {
    console.warn('⚠️ No AI API Key found in environment variables');
  }
} catch (error) {
  console.error('❌ AI Client Initialization Error:', error);
}

export const generateAIResponse = async (messages, jsonMode = false, temperature = 0.7, fastMode = false) => {
  if (!apiKey) {
    throw new Error("AI API Key is missing. Please add OPENAI_API_KEY to your .env file.");
  }

  const MAX_RETRIES = fastMode ? 1 : 3; // Fewer retries for fast mode
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (!fastMode) console.log(`🔄 [AI] Attempt ${attempt}/${MAX_RETRIES} (Mode: ${jsonMode ? "JSON" : "Text"}, Temp: ${temperature})`);

      if (isGoogleKey) {
        if (!genAI) throw new Error("Google AI client not initialized");
        // Use flash model for speed
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            responseMimeType: jsonMode ? "application/json" : "text/plain",
            temperature: temperature,
            maxOutputTokens: fastMode ? 500 : 2000 // Shorter responses in fast mode
          }
        });

        let prompt = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
        if (jsonMode) prompt += "\n\nCRITICAL: Return ONLY valid JSON.";

        const result = await model.generateContent(prompt);
        return result.response.text();
      } else {
        if (!openai) throw new Error("OpenAI client not initialized");
        // Use gpt-4o-mini for fast mode, gpt-4o for full mode
        const completion = await openai.chat.completions.create({
          model: fastMode ? "gpt-4o-mini" : "gpt-4o",
          messages: messages,
          temperature: temperature,
          max_tokens: fastMode ? 500 : 2000, // Shorter responses in fast mode
          response_format: jsonMode ? { type: "json_object" } : undefined
        });
        return completion.choices[0].message.content.trim();
      }
    } catch (error) {
      lastError = error;
      const status = error.status || error.response?.status;

      // If it's a permanent error (Auth/Model not found), don't retry
      if (status === 401 || status === 404) break;

      console.warn(`⚠️ [AI] Attempt ${attempt} failed: ${error.message}`);

      // Wait before retrying (Exponential backoff: 1s, 2s)
      if (attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, attempt * 1000));
      }
    }
  }

  // If we're here, all retries failed
  console.error('❌ [AI] All attempts failed');
  if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('ETIMEDOUT') || lastError.message.includes('DNS')) {
    throw new Error("AI Service is temporarily unreachable (Network/DNS Error). Please check your internet connection or try again in a minute.");
  }
  throw new Error(lastError.message || "AI Service Failed after multiple attempts");
};

/**
 * Robust JSON Extractor - Enhanced Version
 */
export const extractJSON = (text) => {
  if (!text) {
    console.warn('⚠️ extractJSON received empty text');
    return null;
  }

  let cleanText = text.trim();
  console.log('🔍 Attempting to extract JSON from text (length:', cleanText.length, ')');

  // 1. Remove markdown code blocks
  cleanText = cleanText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');

  // 2. Try direct parse
  try {
    const parsed = JSON.parse(cleanText);
    console.log('✅ Direct JSON parse successful');
    return parsed;
  } catch (e) {
    console.log('⚠️ Direct parse failed, trying extraction methods...');

    // 3. Fallback: Search for JSON object (first '{' to last '}')
    try {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const extracted = cleanText.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(extracted);
        console.log('✅ Object extraction successful');
        return parsed;
      }

      // 4. Fallback: Search for JSON array (first '[' to last ']')
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');

      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const extracted = cleanText.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(extracted);
        console.log('✅ Array extraction successful');
        return parsed;
      }
    } catch (e2) {
      console.error("❌ JSON Extraction Failed:", e2.message);
    }
  }

  console.error('❌ All JSON extraction methods failed');
  return null;
};

console.log('✅ AI Utils module loaded');