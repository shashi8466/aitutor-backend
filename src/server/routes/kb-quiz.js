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
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Auth required" });

    // Topic practice has no plan restriction - Free and Premium students both see every
    // topic that has questions in the Knowledge Base.
    const { data: questionsData, error: qError } = await supabase
      .from('questions')
      .select('topic')
      .not('topic', 'is', null);

    if (qError) throw qError;

    const allTopics = [...new Set(questionsData.map(item => item.topic))]
      .filter(topic => topic && topic.length < 150);

    return res.json({ topics: allTopics.sort() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
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

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // SAT Math / SAT Reading & Writing topic practice is available to Free and Premium
    // students alike - no plan-based topic restriction or per-category question limit.

    const finalCount = Math.min(requestedCount, 50); // Hard cap per request

    // Pull the full current UNUSED pool for this topic + level
    const poolFetchLimit = 1000;
    const allUnused = await searchExactKBQuestions(topic, level, poolFetchLimit, safeExcludeIds);
    const questions = allUnused.slice(0, finalCount);
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
      `[KB QUIZ] SUCCESS: Returning ${questions.length}/${requestedCount} (Final: ${finalCount}) questions.`
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
