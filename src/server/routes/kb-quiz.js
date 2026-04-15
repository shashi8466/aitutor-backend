import express from 'express';
import { searchExactKBQuestions } from '../utils/prep365KB.js';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * POST /api/kb-quiz
 * Strictly Knowledge Base only quiz endpoint.
 */
router.get('/topics', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('topic')
      .not('topic', 'is', null);

    if (error) throw error;
    
    const uniqueTopics = [...new Set(data.map(item => item.topic))]
      .filter(topic => topic && topic.length < 150)
      .sort();
    return res.json({ topics: uniqueTopics });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { topic, level, count, excludeIds } = req.body;
  const requestedCount = Math.max(1, parseInt(count, 10) || 10);
  const safeExcludeIds = Array.isArray(excludeIds) ? excludeIds.filter((id) => id != null) : [];

  console.log(
    `[KB QUIZ] Request for Topic: "${topic}" | Level: "${level}" | Count: ${requestedCount} | Excl: ${safeExcludeIds.length}`
  );

  if (!topic || !level) {
    return res.status(400).json({ 
      error: "Both topic and level are required" 
    });
  }

  try {
    // Pull the full current UNUSED pool for this topic + level, then take requested count.
    const poolFetchLimit = 1000;
    const allUnused = await searchExactKBQuestions(topic, level, poolFetchLimit, safeExcludeIds);
    const questions = allUnused.slice(0, requestedCount);
    const unusedAvailable = allUnused.length;
    const exhausted = unusedAvailable === 0;

    if (questions.length === 0) {
      console.warn(`[KB QUIZ] No unused questions left for Topic: "${topic}", Level: "${level}"`);
      return res.status(404).json({
        error: "No Knowledge Base questions found for this topic and level",
        topic,
        level,
        requestedCount,
        actualCount: 0,
        unusedAvailable: 0,
        exhausted: true
      });
    }

    console.log(
      `[KB QUIZ] SUCCESS: Returning ${questions.length}/${requestedCount} questions. Unused available: ${unusedAvailable}.`
    );

    return res.json({
      source: "KB",
      questions: questions,
      topic: topic,
      level: level,
      requestedCount: requestedCount,
      actualCount: questions.length,
      exhausted,
      unusedAvailable
    });

  } catch (err) {
    console.error('KB QUIZ Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
