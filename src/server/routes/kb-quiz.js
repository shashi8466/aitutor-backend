import express from 'express';
import { searchExactKBQuestions } from '../utils/prep365KB.js';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * POST /api/kb-quiz
 * Strictly Knowledge Base only quiz endpoint.
 * Optimized to use the project's existing robust matching engine.
 */
router.post('/', async (req, res) => {
  const { topic, level } = req.body;

  console.log(`📚 [KB QUIZ] Request for Topic: "${topic}" | Level: "${level}"`);

  if (!topic || !level) {
    return res.status(400).json({ 
      error: "Both topic and level are required" 
    });
  }

  try {
    // PASS 1: Leverage the existing robust matching engine
    let questions = await searchExactKBQuestions(topic, level, 5);

    // PASS 2: IF Utility fails, try a Raw Database Fallback with partial matching
    if (!questions || questions.length === 0) {
      console.log(`🔄 [KB QUIZ] Pass 1 failed for "${topic}". Attempting Pass 2: Raw partial search...`);
      const { data: fallbackData } = await supabase
        .from('questions')
        .select('*')
        .ilike('topic', `%${topic}%`)
        .eq('level', level.charAt(0).toUpperCase() + level.slice(1).toLowerCase())
        .limit(5);
      
      if (fallbackData && fallbackData.length > 0) {
        questions = fallbackData.map(q => ({
          ...q,
          difficulty: q.level,
          text: q.question || q.text,
          correctAnswer: q.correct_answer,
          explanation: q.explanation || ''
        }));
      }
    }

    if (!questions || questions.length === 0) {
      console.warn(`⚠️ [KB QUIZ] Final fail. No questions found for Topic: "${topic}", Level: "${level}"`);
      return res.status(404).json({
        error: "No Knowledge Base questions found for this topic and level",
        topic,
        level
      });
    }

    console.log(`✅ [KB QUIZ] Success! Returning ${questions.length} questions.`);

    return res.json({
      source: "KB",
      questions: questions
    });

  } catch (err) {
    console.error('💥 [KB QUIZ] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
