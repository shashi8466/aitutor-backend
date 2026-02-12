import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('🔧 Initializing AI Utils...');

// Initialize Clients lazily
let openai = null;
let genAI = null;

const getAIClient = (provider = 'auto') => {
  const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (provider === 'google' || (provider === 'auto' && googleKey && !openaiKey)) {
    if (!googleKey) return { apiKey: null };
    // Re-initialize if key changed
    if (!genAI || genAI.apiKey !== googleKey) {
      console.log('🤖 Initialising Google Gemini Client...');
      genAI = new GoogleGenerativeAI(googleKey);
      genAI.apiKey = googleKey;
    }
    return { apiKey: googleKey, type: 'google', client: genAI };
  } else {
    if (!openaiKey) return { apiKey: null };
    // Re-initialize if key changed
    if (!openai || openai.apiKey !== openaiKey) {
      console.log('🤖 Initialising OpenAI Client...');
      openai = new OpenAI({ apiKey: openaiKey });
    }
    return { apiKey: openaiKey, type: 'openai', client: openai };
  }
};

export const generateAIResponse = async (messages, jsonMode = false, temperature = 0.7, fastMode = false) => {
  const MAX_RETRIES = fastMode ? 1 : 2;
  let lastError;

  // Potential providers to try
  const providers = ['openai'];

  for (const provider of providers) {
    const { apiKey, type, client } = getAIClient(provider);
    if (!apiKey) continue;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (!fastMode) console.log(`🔄 [AI] Attempting ${type.toUpperCase()} (Attempt ${attempt}/${MAX_RETRIES}, JSON: ${jsonMode})`);

        if (type === 'google') {
          const model = client.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
              responseMimeType: jsonMode ? "application/json" : "text/plain",
              temperature: temperature,
              maxOutputTokens: fastMode ? 500 : 2000
            }
          });

          let prompt = messages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
          if (jsonMode) prompt += "\n\nCRITICAL: Return ONLY valid JSON.";

          const result = await model.generateContent(prompt);
          return result.response.text();
        } else {
          const completion = await client.chat.completions.create({
            model: fastMode ? "gpt-4o-mini" : "gpt-4o",
            messages: messages,
            temperature: temperature,
            max_tokens: fastMode ? 500 : 2000,
            response_format: jsonMode ? { type: "json_object" } : undefined
          });
          return completion.choices[0].message.content.trim();
        }
      } catch (error) {
        lastError = error;
        const status = error.status || error.response?.status;

        console.warn(`⚠️ [AI] ${type.toUpperCase()} failed: ${error.message}`);

        // If it's a quota error (429), break inner loop and try next provider
        if (status === 429) {
          console.error(`🔴 [AI] ${type.toUpperCase()} Quota Exceeded. Trying next provider...`);
          break;
        }

        // For other errors, maybe retry if we have attempts left
        if (attempt < MAX_RETRIES && status !== 401 && status !== 404) {
          await new Promise(res => setTimeout(res, attempt * 1000));
        } else {
          break; // Stop retrying this provider
        }
      }
    }

    // If we successfully returned above, we won't reach here. 
    // If we reach here, it means the current provider failed.
  }

  // All providers/attempts failed
  console.error('❌ [AI] All AI services failed or exceeded quota');
  if (lastError?.message?.includes('quota') || lastError?.status === 429) {
    throw new Error("AI Quota Exceeded. Please check your API billing or add a backup GEMINI_API_KEY to your .env file.");
  }
  throw new Error(lastError?.message || "AI Service failed after trying all options.");
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