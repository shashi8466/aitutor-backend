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

    // Get user plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type')
      .eq('id', user.id)
      .single();
    
    const planType = profile?.plan_type || 'free';

    // Get all topics from questions
    const { data: questionsData, error: qError } = await supabase
      .from('questions')
      .select('topic')
      .not('topic', 'is', null);

    if (qError) throw qError;
    
    const allTopics = [...new Set(questionsData.map(item => item.topic))]
      .filter(topic => topic && topic.length < 150);

    // If premium, return all. If free, filter by plan_content_access
    if (planType === 'premium') {
      return res.json({ topics: allTopics.sort() });
    }

    const { data: allowedContent } = await supabase
      .from('plan_content_access')
      .select('content_id')
      .eq('content_type', 'topic')
      .eq('plan_type', 'free');
    
    const allowedTopicNames = (allowedContent || []).map(a => a.content_id);
    const filteredTopics = allTopics.filter(t => allowedTopicNames.includes(t));

    return res.json({ topics: filteredTopics.sort(), plan: planType });
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

    // 1. Fetch user profile for plan details
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type, plan_status')
      .eq('id', user.id)
      .single();

    const planType = profile?.plan_type || 'free';
    
    // 2. Check Topic Access in plan_content_access
    // If it's a topic request, check if it's assigned to this plan
    const { data: access } = await supabase
      .from('plan_content_access')
      .select('*')
      .eq('content_type', 'topic')
      .eq('content_id', topic)
      .eq('plan_type', planType)
      .maybeSingle();

    if (!access && planType === 'free') {
       return res.status(403).json({ 
         error: "Topic restricted. This topic is only available in the Premium plan.",
         restricted: true 
       });
    }

    // 3. Fetch Plan Limits
    const { data: planSettings } = await supabase
      .from('plan_settings')
      .select('*')
      .eq('plan_type', planType)
      .single();

    // 4. Enforce Requested Count based on limits
    // 4. Enforce Requested Count based on limits (Lifetime Questions)
    const category = topic.toLowerCase().includes('math') ? 'math' : 'rw';
    
    if (planType === 'free') {
      // Fetch total questions answered by user in this category
      const { data: submissions } = await supabase
        .from('submissions')
        .select('questions_count, courses(tutor_type, name)')
        .eq('user_id', user.id);
      
      let totalAnswered = 0;
      (submissions || []).forEach(s => {
        const type = (s.courses?.tutor_type || s.courses?.name || '').toLowerCase();
        const isMath = type.includes('math') || type.includes('quant');
        if (category === 'math' && isMath) totalAnswered += (s.questions_count || 0);
        if (category === 'rw' && !isMath) totalAnswered += (s.questions_count || 0);
      });

      const limit = category === 'math' 
        ? (planSettings?.max_questions_math || 250) 
        : (planSettings?.max_questions_rw || 250);

      if (totalAnswered >= limit) {
        return res.status(403).json({
          error: `You have reached the ${category.toUpperCase()} question limit for the Free plan (${limit} questions). Please upgrade to Premium for unlimited access.`,
          limitReached: true,
          limit
        });
      }
    }

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
      `[KB QUIZ] SUCCESS: Returning ${questions.length}/${requestedCount} (Final: ${finalCount}) questions for Plan: ${planType}.`
    );

    return res.json({
      source: "KB",
      questions: questions,
      topic: topic,
      level: level,
      requestedCount: requestedCount,
      actualCount: questions.length,
      exhausted,
      unusedAvailable,
      plan: planType
    });

  } catch (err) {
    console.error('KB QUIZ Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
});


export default router;
