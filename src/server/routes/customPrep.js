/**
 * Custom Prep / Prepare More — Full-Length Test specific.
 *
 * Every route here is scoped to the logged-in student's own data; nothing here reads or writes
 * anything outside the new custom_prep_plans table plus read-only lookups against
 * test_submissions/test_responses/questions/courses that already exist for other features.
 */
import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import { analyticsService } from '../services/analyticsService.js';
import { classifyDifficulty, buildDayByDayPlan, getRecommendedLevel, routingLevelFor } from '../utils/customPrepPlanner.js';

const router = express.Router();

const MIN_HOURS_PER_DAY = 0.5;
const MAX_HOURS_PER_DAY = 12;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

/**
 * GET /api/custom-prep/analysis/:submissionId
 * The setup-screen data: current score, recommended target band, and the full strengths/
 * weaknesses breakdown - fetched fresh from the submission every time (no plan saved yet).
 */
router.get('/analysis/:submissionId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { submissionId } = req.params;
        const { data: sub } = await supabase
            .from('test_submissions')
            .select('id, user_id')
            .eq('id', submissionId)
            .single();

        if (!sub) return res.status(404).json({ error: 'Submission not found' });
        if (sub.user_id !== userId) return res.status(403).json({ error: 'Not authorized to view this submission' });

        const analysis = await analyticsService.getFullLengthPrepAnalysis(submissionId);
        res.json({ analysis });
    } catch (error) {
        if (error.code === 'NOT_FULL_LENGTH') {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        console.error('❌ [CustomPrep] Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze this test' });
    }
});

/**
 * POST /api/custom-prep/generate
 * body: { submissionId, targetScore, hoursPerDay, numDays }
 * Re-runs the analysis (never trusts a client-supplied analysis snapshot), builds the day-by-day
 * plan, and upserts it - a student re-generating from the SAME Full-Length Test's report updates
 * their one plan for that test rather than creating a duplicate (matches the
 * unique(student_id, source_submission_id) constraint).
 */
router.post('/generate', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { submissionId, targetScore, hoursPerDay, numDays } = req.body;
        const parsedTarget = parseInt(targetScore, 10);
        const parsedHours = parseFloat(hoursPerDay);
        const parsedDays = parseInt(numDays, 10);

        if (!submissionId || isNaN(parsedTarget) || parsedTarget < 400 || parsedTarget > 1600) {
            return res.status(400).json({ error: 'A valid submissionId and targetScore (400-1600) are required' });
        }
        if (isNaN(parsedHours) || parsedHours < MIN_HOURS_PER_DAY || parsedHours > MAX_HOURS_PER_DAY) {
            return res.status(400).json({ error: `hoursPerDay must be between ${MIN_HOURS_PER_DAY} and ${MAX_HOURS_PER_DAY}` });
        }
        if (isNaN(parsedDays) || parsedDays < MIN_DAYS || parsedDays > MAX_DAYS) {
            return res.status(400).json({ error: `numDays must be between ${MIN_DAYS} and ${MAX_DAYS}` });
        }

        const { data: sub } = await supabase
            .from('test_submissions')
            .select('id, user_id, course_id, course:courses(name)')
            .eq('id', submissionId)
            .single();

        if (!sub) return res.status(404).json({ error: 'Submission not found' });
        if (sub.user_id !== userId) return res.status(403).json({ error: 'Not authorized for this submission' });

        const analysis = await analyticsService.getFullLengthPrepAnalysis(submissionId);
        const totalHours = Math.round(parsedHours * parsedDays * 100) / 100;

        const difficulty = classifyDifficulty({
            currentScore: analysis.currentScore,
            targetScore: parsedTarget,
            totalHours
        });

        const days = buildDayByDayPlan({
            weaknesses: analysis.weaknesses,
            currentScore: analysis.currentScore,
            targetScore: parsedTarget,
            hoursPerDay: parsedHours,
            numDays: parsedDays
        });

        const planRecord = {
            student_id: userId,
            source_submission_id: submissionId,
            course_id: sub.course_id,
            test_name: sub.course?.name || 'Full-Length Test',
            current_score: analysis.currentScore,
            recommended_target_min: analysis.recommendedTarget.min,
            recommended_target_max: analysis.recommendedTarget.max,
            target_score: parsedTarget,
            hours_per_day: parsedHours,
            num_days: parsedDays,
            total_hours: totalHours,
            difficulty_label: difficulty.label,
            analysis: {
                overall: analysis.overall,
                mathScore: analysis.mathScore,
                readingScore: analysis.readingScore,
                strengths: analysis.strengths,
                weaknesses: analysis.weaknesses,
                generatedAt: new Date().toISOString()
            },
            plan: { days, difficulty },
            current_day_index: 0,
            status: 'active',
            updated_at: new Date().toISOString()
        };

        const { data: savedPlan, error: upsertError } = await supabase
            .from('custom_prep_plans')
            .upsert(planRecord, { onConflict: 'student_id,source_submission_id' })
            .select()
            .single();

        if (upsertError) throw upsertError;

        res.json({ plan: savedPlan });
    } catch (error) {
        if (error.code === 'NOT_FULL_LENGTH') {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        console.error('❌ [CustomPrep] Generate error:', error);
        res.status(500).json({ error: 'Failed to generate Custom Prep plan' });
    }
});

/**
 * GET /api/custom-prep/plans
 * Summary list for the sidebar page - one row per completed Full-Length Test the student has
 * generated a plan for, newest first.
 */
router.get('/plans', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: plans, error } = await supabase
            .from('custom_prep_plans')
            .select('id, source_submission_id, test_name, current_score, recommended_target_min, recommended_target_max, target_score, hours_per_day, num_days, total_hours, difficulty_label, current_day_index, status, created_at, updated_at')
            .eq('student_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        res.json({ plans: plans || [] });
    } catch (error) {
        console.error('❌ [CustomPrep] List plans error:', error);
        res.status(500).json({ error: 'Failed to load Custom Prep plans' });
    }
});

/**
 * GET /api/custom-prep/plans/:planId
 * Full plan detail. The original analysis.weaknesses snapshot (accuracy, recommendedLevel) is
 * returned exactly as generated - the historical Full-Length Test record - and is never
 * overwritten here. Two DIFFERENT, additional-only measurements are layered on top of it, neither
 * of which ever touches the original numbers:
 *   - customPrepStatus (Not Started/In Progress/Completed): derived client-side from this same
 *     plan's plan.days[].tasks (which this response already includes).
 *   - customPrepPerformance: this topic's most recent REAL quiz result taken after this plan was
 *     generated, on that topic's matched course AT THE SAME LEVEL this plan assigned it - i.e.
 *     genuine new evidence of whether the assigned-level practice is working, not just "did the
 *     student check the task box." Scoped to the assigned level (not just "any later submission on
 *     that course") so a Hard-level topic's new evidence never gets confused with an unrelated
 *     Easy-level attempt on the same course.
 */
router.get('/plans/:planId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { planId } = req.params;
        const { data: plan, error } = await supabase
            .from('custom_prep_plans')
            .select('*')
            .eq('id', planId)
            .single();

        if (error || !plan) return res.status(404).json({ error: 'Plan not found' });
        if (plan.student_id !== userId) return res.status(403).json({ error: 'Not authorized for this plan' });

        const weakTopics = plan.analysis?.weaknesses || [];
        const courseIds = [...new Set(weakTopics.map(t => t.courseId).filter(Boolean))];

        const latestByKey = {};
        if (courseIds.length > 0) {
            const { data: laterSubs } = await supabase
                .from('test_submissions')
                .select('course_id, level, raw_score_percentage, created_at')
                .in('course_id', courseIds)
                .eq('user_id', userId)
                .gt('created_at', plan.created_at)
                .order('created_at', { ascending: false });

            (laterSubs || []).forEach(s => {
                const key = `${s.course_id}::${(s.level || '').toLowerCase()}`;
                if (key in latestByKey) return; // most recent kept - laterSubs is already newest-first
                latestByKey[key] = s.raw_score_percentage != null ? Math.round(s.raw_score_percentage) : null;
            });
        }

        const weaknessesWithProgress = weakTopics.map(t => {
            const recommendedLevel = t.recommendedLevel || getRecommendedLevel(t.accuracy);
            const routingLevel = routingLevelFor(recommendedLevel);
            const key = t.courseId != null ? `${t.courseId}::${routingLevel.toLowerCase()}` : null;
            const customPrepPerformance = key && key in latestByKey ? latestByKey[key] : null;
            let performanceStatus = null;
            if (customPrepPerformance != null) {
                performanceStatus = customPrepPerformance > t.accuracy
                    ? 'Improving'
                    : (customPrepPerformance === t.accuracy ? 'Unchanged' : 'Needs More Practice');
            }
            return { ...t, recommendedLevel, customPrepPerformance, performanceStatus };
        });

        res.json({ plan: { ...plan, analysis: { ...plan.analysis, weaknesses: weaknessesWithProgress } } });
    } catch (error) {
        console.error('❌ [CustomPrep] Get plan error:', error);
        res.status(500).json({ error: 'Failed to load plan' });
    }
});

/**
 * PATCH /api/custom-prep/plans/:planId/progress
 * body: { currentDayIndex?, taskUpdate?: { dayIndex, taskIndex, completed } }
 * Updates the "continue where I left off" pointer and/or a single task's completed flag,
 * in-place inside the plan jsonb.
 */
router.patch('/plans/:planId/progress', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { planId } = req.params;
        const { currentDayIndex, taskUpdate } = req.body;

        const { data: plan, error } = await supabase
            .from('custom_prep_plans')
            .select('id, student_id, plan, num_days')
            .eq('id', planId)
            .single();

        if (error || !plan) return res.status(404).json({ error: 'Plan not found' });
        if (plan.student_id !== userId) return res.status(403).json({ error: 'Not authorized for this plan' });

        const updatedPlanJson = JSON.parse(JSON.stringify(plan.plan || { days: [] }));

        if (taskUpdate && Number.isInteger(taskUpdate.dayIndex) && Number.isInteger(taskUpdate.taskIndex)) {
            const day = updatedPlanJson.days?.[taskUpdate.dayIndex];
            const task = day?.tasks?.[taskUpdate.taskIndex];
            if (!task) return res.status(400).json({ error: 'Invalid dayIndex/taskIndex' });
            const wasCompleted = !!task.completed;
            task.completed = !!taskUpdate.completed;
            // Idempotent: only stamped the FIRST time a task transitions to completed - a repeat
            // "Finish" click, refresh, or re-fired completion callback never moves this forward.
            if (task.completed && !wasCompleted) {
                task.completedAt = new Date().toISOString();
            } else if (!task.completed) {
                task.completedAt = null;
            }
        }

        const updateData = { plan: updatedPlanJson, updated_at: new Date().toISOString() };
        if (Number.isInteger(currentDayIndex)) {
            updateData.current_day_index = Math.max(0, Math.min(currentDayIndex, plan.num_days - 1));
        }

        const allTasksDone = (updatedPlanJson.days || []).every(d => (d.tasks || []).every(t => t.completed));
        if (allTasksDone && (updatedPlanJson.days || []).length > 0) {
            updateData.status = 'completed';
        }

        const { data: updated, error: updateError } = await supabase
            .from('custom_prep_plans')
            .update(updateData)
            .eq('id', planId)
            .select()
            .single();

        if (updateError) throw updateError;
        res.json({ plan: updated });
    } catch (error) {
        console.error('❌ [CustomPrep] Update progress error:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

/**
 * DELETE /api/custom-prep/plans/:planId
 * Removes only this Custom Prep plan row (including its day-by-day progress, stored inline in
 * the same row's `plan` jsonb). custom_prep_plans is a leaf table - nothing else references its
 * id - so this can never touch the source test_submissions row, test_responses, questions, or any
 * other prep plan. Deleting it does not free up the (student_id, source_submission_id) unique
 * constraint's history in any special way; it just removes the row, so the student can generate a
 * fresh plan from the same completed Full-Length Test afterward via POST /generate as normal.
 */
router.delete('/plans/:planId', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { planId } = req.params;
        const { data: plan, error } = await supabase
            .from('custom_prep_plans')
            .select('id, student_id')
            .eq('id', planId)
            .single();

        if (error || !plan) return res.status(404).json({ error: 'Plan not found' });
        if (plan.student_id !== userId) return res.status(403).json({ error: 'Not authorized for this plan' });

        const { error: deleteError } = await supabase
            .from('custom_prep_plans')
            .delete()
            .eq('id', planId);

        if (deleteError) throw deleteError;
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [CustomPrep] Delete plan error:', error);
        res.status(500).json({ error: 'Failed to delete plan' });
    }
});

export default router;
