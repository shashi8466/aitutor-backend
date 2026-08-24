/**
 * Grading Routes
 * Endpoints for advanced grading system
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import { calculateSessionScore, getCategory, calculateTotalSATScore, calculateSatScore } from '../utils/scoreCalculator.js';
import { enqueueNotification, processOutboxOnce } from '../utils/notificationOutbox.js';
import notificationMiddleware from '../middleware/notificationMiddleware.js';
import { analyticsService } from '../services/analyticsService.js';
import { TAXONOMY } from '../../utils/taxonomy.js';
import { isAnswerCorrect } from '../../utils/answerGrading.js';
import { assertCourseAccessible } from '../utils/contentAccess.js';

const router = express.Router();

// Reliable course classification for the leaderboard, mirroring the main_category/tutor_type/
// is_adaptive convention already used by classifySubmission (TestReview.jsx),
// StudentCourseList.jsx, and CourseManagement.jsx - NOT the old crude "does the course name
// contain the word 'math'" substring check, which silently let Full-Length Test, ACT, and AP
// scores leak into "SAT Math" / "SAT Reading & Writing" / "SAT Overall" calculations whenever a
// course's name happened to match or not match that one keyword.
const classifyCourseForLeaderboard = (courseObj = {}) => {
    const name = (courseObj.name || '').toLowerCase();
    const category = (courseObj.category || '').toLowerCase().trim();
    const tutorType = courseObj.tutor_type || '';
    const tutorTypeUpper = tutorType.toUpperCase();
    const mainCategoryField = (courseObj.main_category || '').toUpperCase();
    const isAdaptive = courseObj.is_adaptive === true;

    let mainCat;
    if (mainCategoryField === 'FULL LENGTH TESTS' || isAdaptive ||
        name.includes('full length') || name.includes('full-length') || name.includes('linear sat')) {
        mainCat = 'FULL_LENGTH';
    } else if (mainCategoryField === 'AP' || tutorTypeUpper.startsWith('AP') || /\bap\b/.test(name)) {
        mainCat = 'AP';
    } else if (mainCategoryField === 'ACT' || tutorTypeUpper.includes('ACT') || name.includes('act')) {
        mainCat = 'ACT';
    } else {
        mainCat = 'SAT';
    }

    let subCat = null;
    if (mainCat === 'SAT') {
        if (tutorType === 'SAT Math' || tutorType === 'SAT Reading & Writing') {
            subCat = tutorType;
        } else {
            // Legacy fallback for rows without a proper tutor_type: match the course's Topic
            // (category column) against the canonical taxonomy before falling back to keywords.
            const mathTopics = Object.keys(TAXONOMY.SAT['SAT Math']).map(t => t.toLowerCase());
            const rwTopics = Object.keys(TAXONOMY.SAT['SAT Reading & Writing']).map(t => t.toLowerCase());
            if (mathTopics.includes(category)) {
                subCat = 'SAT Math';
            } else if (rwTopics.includes(category)) {
                subCat = 'SAT Reading & Writing';
            } else {
                const mathKeywords = ['math', 'algebra', 'linear', 'nonlinear', 'equivalent', 'geometry', 'triangle', 'circle', 'trigonometry', 'data', 'ratio', 'percentage', 'probability', 'statistic'];
                subCat = mathKeywords.some(k => name.includes(k) || category.includes(k)) ? 'SAT Math' : 'SAT Reading & Writing';
            }
        }
    }

    // For regular SAT/AP courses, category = Topic/Domain/Unit and name = Subtopic (each
    // subtopic is its own courses row - see CourseForm.jsx).
    return {
        mainCat,
        subCat,
        topic: courseObj.category || null,
        subtopic: courseObj.name || null
    };
};

/**
 * GET /api/grading/parent/student/:studentId/submissions
 * Get submissions for a linked student (parent only)
 */
router.get('/parent/student/:studentId/submissions', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { studentId } = req.params;

        if (!userId) {
            console.warn('⚠️ [ParentReport] Unauthorized: No userId in request');
            return res.status(401).json({ 
                error: 'Unauthorized',
                debug: { hasReqUser: !!req.user, authFailure: req.authFailure, hasAuthHeader: !!req.headers.authorization }
            });
        }

        // 1. Verify user is a parent and has THIS student linked
        const { data: parentProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role, linked_students')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error(`❌ [ParentReport] Profile error for parent ${userId}:`, profileError);
            return res.status(500).json({ error: 'Failed to verify parent profile' });
        }

        if (!parentProfile || parentProfile.role !== 'parent') {
            console.warn(`⚠️ [ParentReport] Unauthorized access: User ${userId} is not a parent (Role: ${parentProfile?.role})`);
            return res.status(403).json({ error: 'Only parents can access this endpoint' });
        }

        const linked = parentProfile.linked_students || [];
        // Use a more robust check for IDs (trim and handle string/UUID mismatch)
        const isLinked = linked.some(id => String(id).trim() === String(studentId).trim());

        if (!isLinked) {
            console.warn(`⚠️ [ParentReport] Parent ${userId} tried to access unlinked student ${studentId}. Linked:`, linked);
            return res.status(403).json({ error: 'You are not authorized to view this student\'s reports' });
        }

        console.log(`📡 [ParentReport] Fetching submissions for student ${studentId} (Requested by parent ${userId})`);

        // 2. Fetch submissions for the student (using admin client to bypass RLS)
        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select('*, courses:courses(id, name, is_practice, tutor_type)')
            .eq('user_id', studentId)
            .order('test_date', { ascending: false });

        if (error) {
            console.error(`❌ [ParentReport] Error fetching submissions for student ${studentId}:`, error);
            return res.status(500).json({ error: 'Failed to fetch student scores' });
        }

        console.log(`✅ [ParentReport] Found ${submissions?.length || 0} submissions for student ${studentId}`);
        res.json({ submissions: submissions || [] });

    } catch (error) {
        console.error('Parent get student scores error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/parent/my-children
 * Get names and basic info for all students linked to this parent (security bypass)
 */
router.get('/parent/my-children', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                debug: { hasReqUser: !!req.user, authFailure: req.authFailure, hasAuthHeader: !!req.headers.authorization }
            });
        }

        // 1. Get parent profile to see linked students
        const { data: parent, error: pError } = await supabase
            .from('profiles')
            .select('role, linked_students')
            .eq('id', userId)
            .single();

        if (pError) {
            console.error('Error fetching parent profile:', pError);
            return res.status(500).json({ error: 'Failed to fetch parent profile' });
        }

        if (!parent || parent.role !== 'parent') {
            return res.status(403).json({ error: 'Parent access level required' });
        }

        const linkedIds = parent.linked_students || [];
        if (linkedIds.length === 0) {
            return res.json({ children: [] });
        }

        // 2. Fetch children profiles using Admin client to bypass RLS
        const { data: children, error: cError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', linkedIds);

        if (cError) {
            console.error('Error fetching children profiles:', cError);
            return res.status(500).json({ error: 'Failed to fetch children data' });
        }

        res.json({ children: children || [] });
    } catch (error) {
        console.error('Get parent children fatal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/grading/parent/student/:studentId/dashboard-data
 * Optimized endpoint to fetch all data needed for the parent student dashboard in one go
 */
router.get('/parent/student/:studentId/dashboard-data', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { studentId } = req.params;

        if (!userId) {
            console.warn('⚠️ [ParentDashboard] Unauthorized: No userId in request');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // 1. Verify user is a parent and has THIS student linked
        const { data: parentProfile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, role, linked_students')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error(`❌ [ParentDashboard] Profile error for parent ${userId}:`, profileError);
            return res.status(500).json({ error: 'Failed to find parent profile' });
        }

        if (!parentProfile || parentProfile.role !== 'parent') {
            console.warn(`⚠️ [ParentDashboard] Unauthorized: User ${userId} is not a parent (Role: ${parentProfile?.role})`);
            return res.status(403).json({ error: 'Only parents can access this endpoint' });
        }

        // Trim and normalize IDs for the linkage check
        const linked = parentProfile.linked_students || [];
        const isLinked = linked.some(id => String(id).trim() === String(studentId).trim());

        if (!isLinked) {
            console.warn(`⚠️ [ParentDashboard] Linkage fail: Student ${studentId} NOT in parent ${userId}'s linked list:`, linked);
            return res.status(403).json({ error: 'You are not authorized to view this student\'s reports' });
        }

        console.log(`✅ [ParentDashboard] Verification passed for student ${studentId} (Parent: ${userId}). Starting parallel fetch...`);

        // 2. Fetch all data in parallel
        const [profileRes, submissionsRes, progressRes, planRes] = await Promise.all([
            supabase.from('profiles').select('name').eq('id', studentId).single(),
            supabase
                .from('test_submissions')
                .select('*, courses:courses(*)')
                .eq('user_id', studentId)
                .order('test_date', { ascending: false }),
            supabase
                .from('student_progress')
                .select('*, courses:courses(*)')
                .eq('user_id', studentId),
            supabase
                .from('student_plans')
                .select('*')
                .eq('user_id', studentId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        if (profileRes.error) {
            console.error(`❌ [ParentDashboard] Error fetching student profile:`, profileRes.error);
        }
        if (submissionsRes.error) {
            console.error(`❌ [ParentDashboard] Error fetching submissions:`, submissionsRes.error);
        }

        console.log(`✅ [ParentDashboard] Data fetched: Submissions: ${submissionsRes.data?.length || 0}, Progress: ${progressRes.data?.length || 0}, Plan: ${planRes.data ? 'Yes' : 'No'}`);

        res.json({
            studentName: profileRes.data?.name || 'Student',
            submissions: submissionsRes.data || [],
            progress: progressRes.data || [],
            plan: planRes.data || null
        });

    } catch (error) {
        console.error('💥 [ParentDashboard] CRITICAL ERROR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/grading/submit-test
 * Submit and grade a test
 */
router.post('/submit-test', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, level, questionIds, answers, duration, mode = 'test', moduleDetails: reqModuleDetails } = req.body;
        let modularScores = reqModuleDetails || null;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!courseId || !level || !questionIds || !answers) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            await assertCourseAccessible(supabase, userId, courseId);
        } catch (accessErr) {
            return res.status(accessErr.statusCode || 403).json({ error: accessErr.message });
        }

        // 1. Idempotency Check: Prevent duplicate submissions within a short window (30s)
        const { data: existingSub } = await supabase
            .from('test_submissions')
            .select('id, raw_score, raw_score_percentage, scaled_score')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .eq('level', level)
            .gt('created_at', new Date(Date.now() - 30000).toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingSub) {
            console.log(`♻️ [Grading] Duplicate quiz submission detected for user ${userId}. Returning existing result ${existingSub.id}.`);
            return res.json({
                submissionId: existingSub.id,
                rawScore: existingSub.raw_score,
                rawPercentage: existingSub.raw_score_percentage,
                scaledScore: existingSub.scaled_score,
                isDuplicate: true
            });
        }

        if (questionIds.length !== answers.length) {
            return res.status(400).json({ error: 'Question IDs and answers length mismatch' });
        }

        // Use database function to submit and grade test
        const { data, error } = await supabase
            .rpc('submit_and_grade_test', {
                p_user_id: userId,
                p_course_id: courseId,
                p_level: level,
                p_question_ids: questionIds,
                p_answers: answers,
                p_duration_seconds: duration || null
            });

        if (error) {
            console.error('Error submitting test:', error);
            return res.status(500).json({ error: 'Failed to submit test' });
        }

        const result = data[0];

        // 🟢 ACT Full-Length Metadata Calculation and Storage
        try {
            const { data: course } = await supabase
                .from('courses')
                .select('name, tutor_type, main_category, category')
                .eq('id', courseId)
                .maybeSingle();

            const isACTFullLength = course && (
                (course.tutor_type || '').toUpperCase() === 'FULL-LENGTH ACT' ||
                (course.category || '').toUpperCase() === 'FULL-LENGTH ACT' ||
                (course.name || '').toUpperCase().includes('ACT FULL-LENGTH') ||
                (course.name || '').toUpperCase().includes('FULL-LENGTH ACT') ||
                ((course.main_category || '').toUpperCase() === 'FULL LENGTH TESTS' && 
                 ((course.tutor_type || '').toUpperCase().includes('ACT') || 
                  (course.category || '').toUpperCase().includes('ACT') || 
                  (course.name || '').toUpperCase().includes('ACT')))
            );

            if (isACTFullLength && questionIds && questionIds.length > 0) {
                console.log(`📊 [Grading] Calculating ACT Full-Length scores for submission ${result.submission_id}`);
                const { data: questionsData } = await supabase
                    .from('questions')
                    .select('id, section, correct_answer')
                    .in('id', questionIds);

                if (questionsData && questionsData.length > 0) {
                    const englishQs = questionsData.filter(q => (q.section || '').toLowerCase() === 'english');
                    const mathQs = questionsData.filter(q => {
                        const s = (q.section || '').toLowerCase();
                        return s === 'math' || s === 'mathematics';
                    });
                    const readingQs = questionsData.filter(q => (q.section || '').toLowerCase() === 'reading');
                    const scienceQs = questionsData.filter(q => (q.section || '').toLowerCase() === 'science');

                    const getCorrectCount = (qs) => {
                        let correct = 0;
                        qs.forEach(q => {
                            const qIdx = questionIds.findIndex(id => String(id) === String(q.id));
                            if (qIdx !== -1 && isAnswerCorrect(answers[qIdx], q.correct_answer)) {
                                correct++;
                            }
                        });
                        return correct;
                    };

                    const englishCorrect = getCorrectCount(englishQs);
                    const mathCorrect = getCorrectCount(mathQs);
                    const readingCorrect = getCorrectCount(readingQs);
                    const scienceCorrect = getCorrectCount(scienceQs);

                    const getActScaled = (correct, max, sectionName) => {
                        if (max === 0) return 1;
                        const ENGLISH_TABLE = {
                          50:36,49:35,48:34,47:33,46:32,45:31,44:30,43:29,42:29,41:28,40:28,
                          39:27,38:27,37:26,36:26,35:25,34:25,33:24,32:23,31:23,30:22,29:21,
                          28:21,27:20,26:20,25:19,24:19,23:18,22:18,21:17,20:16,19:16,18:15,
                          17:15,16:14,15:13,14:13,13:12,12:11,11:11,10:10,9:9,8:8,7:7,6:6,
                          5:5,4:4,3:3,2:2,1:1,0:1
                        };
                        const MATH_TABLE = {
                          45:36,44:34,43:33,42:33,41:32,40:32,39:31,38:31,37:30,36:30,35:29,
                          34:28,33:28,32:27,31:26,30:26,29:25,28:24,27:24,26:23,25:22,24:21,
                          23:20,22:19,21:19,20:18,19:18,18:17,17:17,16:16,15:16,14:15,13:15,
                          12:14,11:13,10:13,9:12,8:11,7:10,6:9,5:8,4:7,3:5,2:4,1:2,0:1
                        };
                        const READING_TABLE = {
                          36:36,35:34,34:32,33:31,32:30,31:29,30:28,29:27,28:26,27:25,26:24,
                          25:24,24:23,23:22,22:22,21:21,20:20,19:20,18:19,17:18,16:18,15:17,
                          14:16,13:15,12:14,11:13,10:12,9:11,8:10,7:9,6:8,5:7,4:6,3:5,2:3,1:2,0:1
                        };
                        const SCIENCE_TABLE = {
                          40:36,39:35,38:34,37:33,36:32,35:31,34:30,33:29,32:28,31:27,30:26,
                          29:26,28:25,27:24,26:24,25:23,24:22,23:22,22:21,21:20,20:19,19:19,
                          18:18,17:17,16:16,15:15,14:14,13:13,12:12,11:11,10:10,9:9,8:8,7:7,
                          6:6,5:5,4:4,3:3,2:2,1:1,0:1
                        };

                        const table = sectionName === 'english' ? ENGLISH_TABLE :
                                      sectionName === 'math' ? MATH_TABLE :
                                      sectionName === 'reading' ? READING_TABLE :
                                      SCIENCE_TABLE;
                        
                        const clamped = Math.max(0, Math.min(correct, Object.keys(table).length - 1));
                        return table[clamped] ?? 1;
                    };

                    const englishScaled = getActScaled(englishCorrect, englishQs.length, 'english');
                    const mathScaled = getActScaled(mathCorrect, mathQs.length, 'math');
                    const readingScaled = readingQs.length > 0 ? getActScaled(readingCorrect, readingQs.length, 'reading') : null;
                    const scienceScaled = scienceQs.length > 0 ? getActScaled(scienceCorrect, scienceQs.length, 'science') : null;

                    const activeSections = [englishScaled, mathScaled];
                    if (readingScaled !== null) activeSections.push(readingScaled);
                    const composite = activeSections.length > 0 
                        ? Math.round((activeSections.reduce((a, b) => a + b, 0) / activeSections.length) + Number.EPSILON)
                        : 1;

                    const actScores = {
                        english: { raw: englishCorrect, max: englishQs.length || 50, scaled: englishScaled },
                        mathematics: { raw: mathCorrect, max: mathQs.length || 45, scaled: mathScaled },
                        reading: readingScaled !== null ? { raw: readingCorrect, max: readingQs.length || 36, scaled: readingScaled } : null,
                        science: scienceScaled !== null ? { raw: scienceCorrect, max: scienceQs.length || 40, scaled: scienceScaled } : null,
                        composite
                    };

                    const totalQs = questionIds.length;
                    const totalCorrect = englishCorrect + mathCorrect + (readingCorrect || 0) + (scienceCorrect || 0);
                    const accuracy = Math.round((totalCorrect / totalQs) * 100);

                    const metadata = {
                        totalCorrect,
                        accuracy,
                        actScores,
                        totalScore: composite,
                        isACTFullLength: true,
                        isPractice: mode === 'practice',
                        withScience: scienceQs.length > 0
                    };

                    const { error: updateErr } = await supabase
                        .from('test_submissions')
                        .update({ 
                            metadata,
                            scaled_score: composite
                        })
                        .eq('id', result.submission_id);

                    if (updateErr) {
                        console.error('❌ [Grading] Failed to update ACT metadata:', updateErr);
                    } else {
                        console.log(`✅ [Grading] Successfully computed and saved ACT Full-Length metadata for submission ${result.submission_id}`);
                        result.metadata = metadata;
                        result.scaled_score = composite;
                    }
                }
            }
        } catch (calcErr) {
            console.error('❌ [Grading] Error calculating ACT Full-Length scores:', calcErr);
        }

        // 🟢 FIX: Ensure student_progress stores LATEST score, not GREATEST
        // This makes sure dashboards and leaderboards are consistent with latest attempts
        try {
            await supabase
                .from('student_progress')
                .upsert({
                    user_id: userId,
                    course_id: courseId,
                    level: level,
                    score: result.raw_percentage,
                    passed: (result.raw_percentage >= 5),
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,course_id,level'
                });
            console.log(`✅ [Sync] Updated student_progress with latest score (${result.raw_percentage}%) for user ${userId}`);
        } catch (syncError) {
            console.warn('⚠️ [Sync] Failed to update latest score in student_progress:', syncError.message);
        }

        // 🟢 TRIGGER NOTIFICATION
        // Triggered explicitly for maximum reliability on Render
        try {
            console.log(`📬 [Trigger] Enqueuing notification for submission ${result.submission_id}`);
            
            modularScores = null;
            // 🟢 CALCULATE MODULAR SCORES
            // Only calculate modular breakdown for "Take the Quiz" mode (non-practice)
            const isModularTest = (mode === 'test' || mode === 'comprehensive') && !modularScores;
            if (isModularTest && questionIds && questionIds.length > 0) {
                try {
                    const { data: questionData, error: qDataErr } = await supabase
                        .from('questions')
                        .select('id, level, correct_answer')
                        .in('id', questionIds);

                    if (qDataErr) throw qDataErr;

                    if (questionData && questionData.length > 0) {
                        const tempScores = {
                            easy: { correct: 0, total: 0 },
                            medium: { correct: 0, total: 0 },
                            hard: { correct: 0, total: 0 }
                        };

                        console.log(`🔍 [Trigger] Processing ${questionIds.length} answers for sub ${result.submission_id}`);
                        
                        questionIds.forEach((qId, idx) => {
                            // Find corresponding question in DB results
                            const q = questionData.find(dq => String(dq.id) === String(qId));
                            if (q) {
                                const rawLevel = String(q.level || 'Medium').toLowerCase().trim();
                                if (tempScores[rawLevel]) {
                                    tempScores[rawLevel].total++;

                                    if (isAnswerCorrect(answers[idx], q.correct_answer)) {
                                        tempScores[rawLevel].correct++;
                                    }
                                }
                            }
                        });
                        
                        // Only assign if we actually found any questions
                        const totalFound = Object.values(tempScores).reduce((acc, s) => acc + s.total, 0);
                        if (totalFound > 0) {
                            modularScores = tempScores;
                            console.log(`📊 [Trigger] Modular breakdown calculated: ${totalFound}/${questionIds.length} questions mapped.`);
                        } else {
                            console.warn(`⚠️ [Trigger] No questions matched levels for sub ${result.submission_id}`);
                        }
                    } else {
                        console.warn(`⚠️ [Trigger] Question lookup returned no data for sub ${result.submission_id}`);
                    }
                } catch (calcError) {
                    console.error('⚠️ [Trigger] Modular calculation error:', calcError.message);
                }
            }
            // Background tasks: Trigger notifications without blocking the response
            try {
                await notificationMiddleware.scheduler.triggerTestCompletionNotification(result.submission_id, userId, modularScores);
            } catch (innerError) {
                console.error('⚠️ [Trigger] Notification background task failed:', innerError.message);
            }
        } catch (noteError) {
            console.error('⚠️ [Trigger] Failed to enqueue notification:', noteError.message);
        }

        // 4. Perform weakness analysis and generate personalized drill
        try {
            console.log(`🔍 [Weakness] Starting analysis for regular test submission ${result.submission_id}`);
            
            // Dynamic import for ESM compatibility
            const { default: weaknessAnalysis } = await import('../../services/weaknessAnalysis.js');
            const { default: drillGenerator } = await import('../../services/drillGenerator.js');
            
            // Fetch detailed responses for analysis
            const { data: detailedResponses, error: respFetchError } = await supabase
                .from('test_responses')
                .select(`
                    selected_answer,
                    is_correct,
                    time_spent,
                    question:questions(id, question, correct_answer, explanation, topic, section, difficulty, concept)
                `)
                .eq('submission_id', result.submission_id);

            if (!respFetchError && detailedResponses && detailedResponses.length > 0) {
                // Get submission details for analysis
                const { data: submissionDetails, error: subError } = await supabase
                    .from('test_submissions')
                    .select(`
                        *,
                        course:courses(id, name, tutor_type)
                    `)
                    .eq('id', result.submission_id)
                    .single();

                if (!subError && submissionDetails) {
                    // Perform weakness analysis
                    const weaknessData = await weaknessAnalysis.analyzePerformance(submissionDetails, detailedResponses);
                    
                    console.log(`✅ [Weakness] Analysis complete: ${weaknessData.weaknesses.length} weaknesses found`);

                    // Generate personalized drill if weaknesses detected
                    if (weaknessData.weaknesses.length > 0) {
                        const drill = await drillGenerator.generateDrill(weaknessData, userId, courseId);
                        if (drill) {
                            console.log(`✅ [Drill] Generated personalized drill: ${drill.title}`);
                        }
                    }

                    // Store weakness analysis results
                    const { error: analysisError } = await supabase
                        .from('weakness_analysis')
                        .insert({
                            user_id: userId,
                            course_id: courseId,
                            submission_id: result.submission_id,
                            analysis_data: weaknessData,
                            weaknesses_count: weaknessData.weaknesses.length,
                            strengths_count: weaknessData.strengths.length,
                            recommendations_count: weaknessData.recommendations.length,
                            created_at: new Date().toISOString()
                        });

                    if (analysisError) {
                        console.error('❌ [Weakness] Failed to save analysis:', analysisError);
                    } else {
                        console.log(`✅ [Weakness] Saved analysis for submission ${result.submission_id}`);
                    }
                } else {
                    console.log(`⚠️ [Weakness] Could not fetch submission details for analysis`);
                }
            } else {
                console.log(`⚠️ [Weakness] No detailed responses available for analysis`);
            }
        } catch (weaknessError) {
            console.error('❌ [Weakness] Analysis failed:', weaknessError);
            // Don't fail the entire submission if weakness analysis fails
        }

        res.json({
            submissionId: result.submission_id,
            rawScore: result.raw_score,
            rawPercentage: result.raw_percentage,
            scaledScore: result.scaled_score,
            sectionScores: result.section_scores,
            modularScores
        });

    } catch (error) {
        console.error('Submit test error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/grading/submit-adaptive-test
 * Separate endpoint for FULL LENGTH TEST submissions to ensure zero impact on existing system.
 */
router.post('/submit-adaptive-test', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, questionIds, answers, duration, scores } = req.body;
        
        console.log(`📥 [Grading] Received adaptive test submission:`);
        console.log(`   - UserId: ${userId}`);
        console.log(`   - CourseId: ${courseId}`);
        console.log(`   - QuestionIds count: ${questionIds?.length || 0}`);
        console.log(`   - Answers count: ${answers?.length || 0}`);
        console.log(`   - Has scores: ${!!scores}`);
        
        if (!userId) {
            console.warn(`[Grading] Unauthorized adaptive test submission attempt`);
            return res.status(401).json({ 
                error: 'Unauthorized',
                debug: { hasReqUser: !!req.user, authFailure: req.authFailure, hasAuthHeader: !!req.headers.authorization }
            });
        }

        try {
            await assertCourseAccessible(supabase, userId, courseId);
        } catch (accessErr) {
            return res.status(accessErr.statusCode || 403).json({ error: accessErr.message });
        }

        // 1. Idempotency Check: Prevent duplicate submissions within a short window (30s)
        const { data: existingSub } = await supabase
            .from('test_submissions')
            .select('id, scaled_score, math_scaled_score, reading_scaled_score')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .eq('level', 'Adaptive')
            .gt('created_at', new Date(Date.now() - 30000).toISOString()) // 30 seconds ago
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingSub) {
            console.log(`♻️ [Grading] Duplicate adaptive submission detected for user ${userId}. Returning existing result ${existingSub.id}.`);
            return res.json({
                submissionId: existingSub.id,
                scaledScore: existingSub.scaled_score,
                rwScore: scores?.rwScore, 
                mathScore: scores?.mathScore,
                accuracy: scores?.accuracy,
                metadata: scores
            });
        }

        // 1. Fetch correct answers to verify and store responses
        const { data: questions, error: qError } = await supabase
            .from('questions')
            .select('id, correct_answer')
            .in('id', questionIds);

        if (qError) {
            console.error('❌ [Grading] Failed to fetch questions for adaptive test:', qError);
            throw qError;
        }

        const correctIds = [];
        const incorrectIds = [];
        const responseInserts = [];

        // Ensure we have an array for questionIds
        const qIdsArray = Array.isArray(questionIds) ? questionIds : [];

        qIdsArray.forEach((qId, idx) => {
            // Robust matching: Try both number and string comparison
            const q = (questions || []).find(dq => String(dq.id) === String(qId));
            const studentAns = String(answers?.[idx] || '').trim();
            // Strictly cast to boolean to avoid Postgres 22P02 error
            const isCorrect = !!(q && isAnswerCorrect(studentAns, q.correct_answer));
            
            // Use numeric ID for the array storage (compatible with int8[] columns)
            const numericQId = parseInt(qId);
            if (!isNaN(numericQId)) {
                if (isCorrect) correctIds.push(numericQId);
                else incorrectIds.push(numericQId);

                responseInserts.push({
                    selected_answer: studentAns,
                    is_correct: isCorrect,
                    question_id: numericQId
                });
            }
        });

        // 2. Create a submission record manually with pre-calculated scores and metadata
        const { data: subData, error: subError } = await supabase
            .from('test_submissions')
            .insert({
                user_id: userId,
                course_id: courseId,
                level: 'Adaptive',
                test_date: new Date().toISOString(),
                test_duration_seconds: duration || 0,
                total_questions: (questionIds || []).length,
                raw_score: scores?.totalCorrect || 0,
                scaled_score: scores?.totalScore || 0,
                math_scaled_score: scores?.mathScore || 0,
                reading_scaled_score: scores?.rwScore || 0,
                raw_score_percentage: scores?.accuracy || 0,
                correct_questions: correctIds,
                incorrect_questions: incorrectIds,
                metadata: scores || {}, // Store full analytics here
                is_completed: true
            })
            .select();
        
        console.log(`📝 [Grading] Inserted submission record. Correct: ${correctIds.length}, Incorrect: ${incorrectIds.length}`);

        if (subError) {
            console.error('❌ [Grading] Submission Insert Failed:', subError);
            throw subError;
        }

        const submission = subData?.[0];
        if (!submission) {
            throw new Error('Failed to retrieve created submission record.');
        }

        // 3. Insert individual responses into test_responses
        if (responseInserts.length > 0) {
            const { error: respError } = await supabase
                .from('test_responses')
                .insert(responseInserts.map(r => ({ ...r, submission_id: submission.id })));
            
            if (respError) {
                console.error('❌ [Grading] Response Insert Failed:', respError);
            }
        }

        // 4. Perform weakness analysis and generate personalized drill
        try {
            console.log(`🔍 [Weakness] Starting analysis for submission ${submission.id}`);
            
            // Import weakness analysis services
            const { default: weaknessAnalysis } = await import('../../services/weaknessAnalysis.js');
            const { default: drillGenerator } = await import('../../services/drillGenerator.js');
            
            // Fetch detailed responses for analysis
            const { data: detailedResponses, error: respFetchError } = await supabase
                .from('test_responses')
                .select(`
                    selected_answer,
                    is_correct,
                    time_spent,
                    question:questions(id, question, correct_answer, explanation, topic, section, difficulty, concept)
                `)
                .eq('submission_id', submission.id);

            if (!respFetchError && detailedResponses) {
                // Create submission object for analysis
                const submissionForAnalysis = {
                    ...submission,
                    course: { tutor_type: 'Full-Length SAT Test' } // This is an adaptive test submission
                };

                // Perform weakness analysis
                const weaknessData = await weaknessAnalysis.analyzePerformance(submissionForAnalysis, detailedResponses);
                
                console.log(`✅ [Weakness] Analysis complete: ${weaknessData.weaknesses.length} weaknesses found`);

                // Generate personalized drill if weaknesses detected
                if (weaknessData.weaknesses.length > 0) {
                    const drill = await drillGenerator.generateDrill(weaknessData, userId, courseId);
                    if (drill) {
                        console.log(`✅ [Drill] Generated personalized drill: ${drill.title}`);
                    }
                }

                // Store weakness analysis results
                const { error: analysisError } = await supabase
                    .from('weakness_analysis')
                    .insert({
                        user_id: userId,
                        course_id: courseId,
                        submission_id: submission.id,
                        analysis_data: weaknessData,
                        weaknesses_count: weaknessData.weaknesses.length,
                        strengths_count: weaknessData.strengths.length,
                        recommendations_count: weaknessData.recommendations.length,
                        created_at: new Date().toISOString()
                    });

                if (analysisError) {
                    console.error('❌ [Weakness] Failed to save analysis:', analysisError);
                } else {
                    console.log(`✅ [Weakness] Saved analysis for submission ${submission.id}`);
                }
            } else {
                console.log(`⚠️ [Weakness] No detailed responses available for analysis`);
            }
        } catch (weaknessError) {
            console.error('❌ [Weakness] Analysis failed:', weaknessError);
            // Don't fail the entire submission if weakness analysis fails
        }

        // 4. Update student progress for the 'Adaptive' level
        try {
            await supabase
                .from('student_progress')
                .upsert({
                    user_id: userId,
                    course_id: courseId,
                    level: 'Adaptive',
                    score: scores.accuracy,
                    passed: true,
                    created_at: new Date().toISOString()
                }, { onConflict: 'user_id,course_id,level' });
        } catch (e) {
            console.warn('Sync progress failed for adaptive:', e.message);
        }

        // 5. Trigger notifications (Background)
        try {
            await notificationMiddleware.scheduler.triggerTestCompletionNotification(submission.id, userId, scores.moduleDetails);
        } catch (e) {
            console.warn('Notification failed for adaptive:', e.message);
        }

        res.json({
            submissionId: submission.id,
            scaledScore: scores.totalScore,
            rwScore: scores.rwScore,
            mathScore: scores.mathScore,
            accuracy: scores.accuracy,
            metadata: scores // Echo back for immediate frontend use
        });

    } catch (error) {
        console.error('Submit FULL LENGTH TEST error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// --- ANALYTICS & WEAKNESS ROUTES ---

/**
 * POST /api/grading/weakness-analysis/global
 * Perform comprehensive cross-test weakness analysis for a user
 */
router.post('/weakness-analysis/global', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`🌐 [GlobalAnalysis] Starting cross-test analysis for user ${userId}`);

        // Import services
        const { default: weaknessAnalysis } = await import('../../services/weaknessAnalysis.js');
        const { default: drillGenerator } = await import('../../services/drillGenerator.js');

        // 1. Perform global analysis
        const globalAnalysis = await weaknessAnalysis.analyzeGlobalPerformance(userId, supabase);

        if (!globalAnalysis) {
            return res.status(404).json({ 
                error: 'No performance data found to analyze',
                message: 'Take a few more tests to enable AI-powered weakness analysis.'
            });
        }

        console.log(`✅ [GlobalAnalysis] Analysis complete. Detected ${globalAnalysis.weaknesses.length} weaknesses across ${globalAnalysis.totalSubmissions} tests.`);

        // 2. Generate new drills based on detected weaknesses
        let generatedDrills = [];
        const maxDrills = 3; // Don't overwhelm the user

        // Sort weaknesses by severity and take top ones
        const topWeaknesses = globalAnalysis.weaknesses.slice(0, maxDrills);

        for (const weakness of topWeaknesses) {
            // Check if we already have an active drill for this exact weakness to avoid duplicates
            const { data: existing } = await supabase
                .from('weakness_drills')
                .select('id')
                .eq('user_id', userId)
                .eq('target_topic', weakness.topic || 'mixed')
                .eq('is_completed', false)
                .limit(1);

            if (!existing || existing.length === 0) {
                const drill = await drillGenerator.generateDrill({ weaknesses: [weakness] }, userId, courseId);
                if (drill) generatedDrills.push(drill);
            }
        }

        res.json({
            success: true,
            analysis: globalAnalysis,
            drillsGenerated: generatedDrills.length,
            message: `Analyzed ${globalAnalysis.totalSubmissions} tests and generated ${generatedDrills.length} personalized drills.`
        });

    } catch (error) {
        console.error('❌ [GlobalAnalysis] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/submission/:submissionId
 * Get detailed submission information
 */
router.get('/submission/:submissionId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { submissionId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: submission, error } = await supabase
            .from('test_submissions')
            .select(`
        *,
        course:courses(id, name, description),
        user:profiles!user_id(id, name, email)
      `)
            .eq('id', submissionId)
            .single();

        if (error) {
            console.error('Error fetching submission:', error);
            if (error.code === 'PGRST116') {
                // Supabase "not found" error code
                return res.status(404).json({ error: 'Submission not found' });
            }
            return res.status(500).json({ error: 'Failed to fetch submission details' });
        }

        // Add alias for frontend compatibility
        submission.duration = submission.test_duration_seconds || 0;


        // Verify access (own submission, or admin, or tutor, or parent)
        if (submission.user_id !== userId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, assigned_courses, tutor_approved, linked_students')
                .eq('id', userId)
                .single();

            const isAdmin = profile?.role === 'admin' || req.user?.adminId;
            let rawAssigned = profile?.assigned_courses || [];
            if (typeof rawAssigned === 'string') {
                try { rawAssigned = JSON.parse(rawAssigned); } catch (e) { rawAssigned = []; }
            }
            const assigned = Array.isArray(rawAssigned) ? rawAssigned.map(Number).filter(id => !isNaN(id)) : [];

            const isTutorWithAccess = profile?.role === 'tutor' &&
                profile?.tutor_approved &&
                assigned.includes(Number(submission.course_id));

            const isParentWithAccess = profile?.role === 'parent' &&
                (profile?.linked_students || []).includes(submission.user_id);

            if (!isAdmin && !isTutorWithAccess && !isParentWithAccess) {
                return res.status(403).json({ error: 'Not authorized' });
            }
        }

        const sid = submissionId;
        console.log(`🔍 [GRADING] Fetching responses for submission: ${sid}`);
        
        // Enhanced debugging - log what we're starting with
        console.log(`📊 [GRADING] Initial submission data for ${sid}:`);
        console.log(`   - Course: ${submission.course?.name} (${submission.course?.tutor_type})`);
        console.log(`   - Has metadata: ${submission.metadata ? 'Yes' : 'No'}`);
        console.log(`   - incorrect_questions: ${submission.incorrect_questions?.length || 0}`);
        console.log(`   - correct_questions: ${submission.correct_questions?.length || 0}`);
        console.log(`   - raw_score: ${submission.raw_score}`);
        console.log(`   - scaled_score: ${submission.scaled_score}`);
        
        if (submission.metadata) {
            try {
                const meta = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : submission.metadata;
                console.log(`   - Metadata keys: ${Object.keys(meta)}`);
                console.log(`   - Metadata responses: ${meta.responses?.length || 0}`);
                console.log(`   - Metadata answers: ${meta.answers?.length || 0}`);
                console.log(`   - Metadata questionIds: ${meta.questionIds?.length || 0}`);
            } catch (e) {
                console.log(`   - Metadata parse error: ${e.message}`);
            }
        }

        // 1. Try to fetch from test_responses (new system)
        const { data: responses, error: responsesError } = await supabase
            .from('test_responses')
            .select(`
                selected_answer,
                is_correct,
                question:questions(id, question, correct_answer, explanation, topic, section)
            `)
            .eq('submission_id', sid);

        submission.incorrect_responses = [];
        submission.correct_responses = [];
        
        console.log(`📋 [GRADING] test_responses query result for ${sid}:`);
        console.log(`   - Error: ${responsesError ? responsesError.message : 'None'}`);
        console.log(`   - Found responses: ${responses?.length || 0}`);

        if (!responsesError && responses && responses.length > 0) {
            console.log(`✅ [GRADING] Found ${responses.length} total responses in test_responses for submission ${sid}`);

            submission.incorrect_responses = responses
                .filter(r => !r.is_correct)
                .map(r => ({
                    selected_answer: r.selected_answer,
                    question_text: r.question?.question,
                    correct_answer: r.question?.correct_answer,
                    explanation: r.question?.explanation,
                    subject: r.question?.section || r.question?.topic,
                    section: r.question?.section,
                    topic: r.question?.topic,
                    question: r.question // Keep full question object for frontend
                }));

            submission.correct_responses = responses
                .filter(r => r.is_correct)
                .map(r => ({
                    selected_answer: r.selected_answer,
                    question_text: r.question?.question,
                    correct_answer: r.question?.correct_answer,
                    explanation: r.question?.explanation,
                    subject: r.question?.section || r.question?.topic,
                    section: r.question?.section,
                    topic: r.question?.topic,
                    question: r.question // Keep full question object for frontend
                }));
        } else if (responsesError) {
            console.error(`❌ [GRADING] Error fetching responses for sub ${sid}:`, responsesError);
        }

        // 1.5 NEW: Try to fetch from metadata if test_responses is incomplete
        const meta = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : (submission.metadata || {});
        
        // If we still have missing questions (compared to correct_questions/incorrect_questions counts)
        // or if test_responses was empty, try to get more from metadata
        const needsMoreIncorrect = (submission.incorrect_questions?.length || 0) > submission.incorrect_responses.length;
        const needsMoreCorrect = (submission.correct_questions?.length || 0) > submission.correct_responses.length;

        if (needsMoreIncorrect || needsMoreCorrect) {
            console.log(`🔍 [GRADING] Supplementing from metadata for submission ${sid}`);
            
            // Check for responses array
            if (meta.responses && Array.isArray(meta.responses) && meta.responses.length > 0) {
                console.log(`✅ [GRADING] Found ${meta.responses.length} responses in metadata`);
                
                meta.responses.forEach(r => {
                    const existingIds = [...submission.incorrect_responses, ...submission.correct_responses].map(er => String(er.question?.id || er.id));
                    if (!existingIds.includes(String(r.question?.id || r.id))) {
                        if (r.is_correct) submission.correct_responses.push(r);
                        else submission.incorrect_responses.push(r);
                    }
                });
            }
            // Check for answers array (reconstruct if needed)
            else if (meta.answers && Array.isArray(meta.answers) && meta.answers.length > 0 && meta.questionIds) {
                console.log(`🔧 [GRADING] Reconstructing missing responses from metadata answers`);
                
                const { data: questions } = await supabase
                    .from('questions')
                    .select('id, question, correct_answer, explanation, topic, section, difficulty')
                    .in('id', meta.questionIds);
                
                if (questions) {
                    meta.answers.forEach((answer, index) => {
                        const qId = meta.questionIds[index];
                        const existingIds = [...submission.incorrect_responses, ...submission.correct_responses].map(er => String(er.question?.id || er.id));
                        
                        if (!existingIds.includes(String(qId))) {
                            const q = questions.find(dq => String(dq.id) === String(qId));
                            if (q) {
                                const isCorrect = isAnswerCorrect(answer, q.correct_answer);
                                const resp = {
                                    selected_answer: answer,
                                    is_correct: isCorrect,
                                    question: q,
                                    question_text: q.question,
                                    correct_answer: q.correct_answer,
                                    explanation: q.explanation,
                                    subject: q.section || q.topic,
                                    section: q.section,
                                    topic: q.topic,
                                    difficulty: q.difficulty
                                };
                                if (isCorrect) submission.correct_responses.push(resp);
                                else submission.incorrect_responses.push(resp);
                            }
                        }
                    });
                }
            }
        }


        // 2. Supplement/Fallback: If any responses are missing, fetch from questions table
        const missingIncorrect = (submission.incorrect_questions?.length || 0) > submission.incorrect_responses.length;
        const missingCorrect = (submission.correct_questions?.length || 0) > submission.correct_responses.length;

        if (missingIncorrect || missingCorrect) {
            console.log(`⚠️ [GRADING] Supplementing missing responses from questions table. Missing incorrect: ${missingIncorrect}, Missing correct: ${missingCorrect}`);

            if (missingIncorrect) {
                const existingIds = [...submission.incorrect_responses, ...submission.correct_responses].map(r => String(r.question?.id || r.id));
                const missingIds = (submission.incorrect_questions || []).filter(id => id && !existingIds.includes(String(id)));

                if (missingIds.length > 0) {
                    console.log(`🔍 [GRADING] Fetching ${missingIds.length} missing incorrect questions for sub ${sid}`);
                    const { data: fallback } = await supabase
                        .from('questions')
                        .select('id, question, correct_answer, explanation, topic, section, difficulty')
                        .in('id', missingIds);

                    if (fallback) {
                        submission.incorrect_responses = [
                            ...submission.incorrect_responses,
                            ...fallback.map(q => ({
                                selected_answer: 'Not recorded',
                                question: q,
                                question_text: q.question,
                                correct_answer: q.correct_answer,
                                explanation: q.explanation,
                                subject: q.section || q.topic,
                                section: q.section,
                                topic: q.topic,
                                difficulty: q.difficulty
                            }))
                        ];
                    }
                }
            }

            if (missingCorrect) {
                const existingIds = [...submission.incorrect_responses, ...submission.correct_responses].map(r => String(r.question?.id || r.id));
                const missingIds = (submission.correct_questions || []).filter(id => id && !existingIds.includes(String(id)));

                if (missingIds.length > 0) {
                    console.log(`🔍 [GRADING] Fetching ${missingIds.length} missing correct questions for sub ${sid}`);
                    const { data: fallback } = await supabase
                        .from('questions')
                        .select('id, question, correct_answer, explanation, topic, section, difficulty')
                        .in('id', missingIds);

                    if (fallback) {
                        submission.correct_responses = [
                            ...submission.correct_responses,
                            ...fallback.map(q => ({
                                selected_answer: q.correct_answer,
                                question: q,
                                question_text: q.question,
                                correct_answer: q.correct_answer,
                                explanation: q.explanation,
                                subject: q.section || q.topic,
                                section: q.section,
                                topic: q.topic,
                                difficulty: q.difficulty
                            }))
                        ];
                    }
                }
            }
        }

        // 3. AGGRESSIVE FALLBACK: Try all possible data sources
        if (submission.incorrect_responses.length === 0 && submission.correct_responses.length === 0) {
            console.log(`🚨 [GRADING] No responses found yet, trying aggressive fallback for submission ${sid}`);
            
            // Check all possible locations for response data
            const meta = typeof submission.metadata === 'string' ? JSON.parse(submission.metadata) : (submission.metadata || {});
            
            // Try to extract from any possible field
            const possibleDataSources = [
                meta.responses,
                meta.answers,
                meta.questionData,
                meta.submissionData,
                meta.testData,
                meta.gradedResponses,
                submission.responses,
                submission.answers,
                submission.test_data,
                submission.graded_responses
            ];
            
            let foundData = null;
            let dataSource = null;
            
            for (const [index, dataSource] of possibleDataSources.entries()) {
                if (dataSource && Array.isArray(dataSource) && dataSource.length > 0) {
                    foundData = dataSource;
                    console.log(`✅ [GRADING] Found data in source ${index}: ${dataSource.length} items`);
                    break;
                }
            }
            
            // If we found data but it's not in the right format, try to convert it
            if (foundData) {
                console.log(`🔧 [GRADING] Processing found data with ${foundData.length} items`);
                
                // Check if it's already in response format
                if (foundData[0] && (foundData[0].selected_answer !== undefined || foundData[0].is_correct !== undefined)) {
                    console.log(`✅ [GRADING] Data is already in response format`);
                    submission.responses = foundData;
                    submission.incorrect_responses = foundData.filter(r => !r.is_correct);
                    submission.correct_responses = foundData.filter(r => r.is_correct);
                }
                // Check if it's in answers format
                else if (foundData[0] && typeof foundData[0] === 'string' || typeof foundData[0] === 'number') {
                    console.log(`🔧 [GRADING] Converting answers format to responses`);
                    
                    // Try to get question IDs from various sources
                    const questionIds = meta.questionIds || meta.questions || submission.question_ids || submission.incorrect_questions || submission.correct_questions;
                    
                    if (questionIds && Array.isArray(questionIds) && questionIds.length === foundData.length) {
                        console.log(`🔧 [GRADING] Reconstructing responses from answers and questionIds`);
                        
                        // Fetch questions
                        const { data: questions, error: qError } = await supabase
                            .from('questions')
                            .select('id, question, correct_answer, explanation, topic, section')
                            .in('id', questionIds);
                        
                        if (!qError && questions) {
                            const reconstructedResponses = foundData.map((answer, index) => {
                                const question = questions.find(q => q.id === questionIds[index]);
                                const isCorrect = !!(question && isAnswerCorrect(answer, question.correct_answer));
                                
                                return {
                                    selected_answer: String(answer),
                                    is_correct: isCorrect,
                                    question: question,
                                    question_text: question?.question,
                                    correct_answer: question?.correct_answer,
                                    explanation: question?.explanation,
                                    subject: question?.section || question?.topic,
                                    section: question?.section,
                                    topic: question?.topic
                                };
                            });
                            
                            submission.responses = reconstructedResponses;
                            submission.incorrect_responses = reconstructedResponses.filter(r => !r.is_correct);
                            submission.correct_responses = reconstructedResponses.filter(r => r.is_correct);
                            console.log(`✅ [GRADING] Successfully reconstructed ${reconstructedResponses.length} responses`);
                        }
                    }
                }
                // Try to extract from any other format
                else {
                    console.log(`🔧 [GRADING] Attempting to extract from unknown format`);
                    console.log(`   - Sample data:`, JSON.stringify(foundData[0], null, 2));
                    
                    // Try to find any fields that might contain answer data
                    const sampleItem = foundData[0];
                    const possibleAnswerFields = ['answer', 'selected', 'response', 'user_answer', 'student_answer'];
                    
                    for (const field of possibleAnswerFields) {
                        if (sampleItem[field] !== undefined) {
                            console.log(`🔧 [GRADING] Found potential answer field: ${field}`);
                            
                            // Try to convert this format
                            const convertedResponses = foundData.map((item, index) => {
                                // This is a basic conversion - might need refinement based on actual data structure
                                return {
                                    selected_answer: item[field],
                                    is_correct: item.is_correct || item.correct || false,
                                    question_text: item.question || item.text,
                                    correct_answer: item.correct_answer || item.correct,
                                    explanation: item.explanation,
                                    subject: item.subject || item.topic,
                                    section: item.section,
                                    topic: item.topic
                                };
                            });
                            
                            submission.responses = convertedResponses;
                            submission.incorrect_responses = convertedResponses.filter(r => !r.is_correct);
                            submission.correct_responses = convertedResponses.filter(r => r.is_correct);
                            console.log(`✅ [GRADING] Converted ${convertedResponses.length} responses from field: ${field}`);
                            break;
                        }
                    }
                }
            }
            
            // LAST RESORT: Create dummy data if nothing found (for testing purposes)
            if (submission.incorrect_responses.length === 0 && submission.correct_responses.length === 0) {
                console.log(`🚨 [GRADING] Still no data found, creating minimal response structure`);
                
                // Create a basic response based on available score data
                const score = submission.scaled_score || submission.total_score || submission.score || 0;
                const totalQuestions = submission.total_questions || 100; // Default assumption
                
                // Estimate correct answers based on score (very rough approximation)
                let estimatedCorrect = 0;
                if (submission.course?.tutor_type === 'Full-Length SAT Test') {
                    // SAT scoring: 400 base + 10 points per correct answer (rough estimate)
                    estimatedCorrect = Math.max(0, Math.floor((score - 400) / 10));
                } else {
                    // Percentage-based scoring
                    estimatedCorrect = Math.max(0, Math.floor((score / 100) * totalQuestions));
                }
                
                const estimatedIncorrect = Math.max(0, totalQuestions - estimatedCorrect);
                
                console.log(`🔧 [GRADING] Creating estimated responses: ${estimatedCorrect} correct, ${estimatedIncorrect} incorrect`);
                
                // Create basic response objects
                submission.correct_responses = Array.from({ length: Math.min(estimatedCorrect, 5) }, (_, i) => ({
                    selected_answer: 'A',
                    question_text: `Sample correct question ${i + 1}`,
                    correct_answer: 'A',
                    explanation: 'This is a sample explanation',
                    subject: 'Sample Subject'
                }));
                
                submission.incorrect_responses = Array.from({ length: Math.min(estimatedIncorrect, 5) }, (_, i) => ({
                    selected_answer: 'B',
                    question_text: `Sample incorrect question ${i + 1}`,
                    correct_answer: 'A',
                    explanation: 'This is a sample explanation',
                    subject: 'Sample Subject'
                }));
            }
        }

        // Final summary of what was retrieved
        console.log(`📊 [GRADING] Final summary for submission ${sid}:`);
        console.log(`   - Total responses found: ${submission.incorrect_responses.length + submission.correct_responses.length}`);
        console.log(`   - Correct responses: ${submission.correct_responses.length}`);
        console.log(`   - Incorrect responses: ${submission.incorrect_responses.length}`);
        console.log(`   - Has responses array: ${submission.responses ? 'Yes' : 'No'}`);
        
        res.json({ submission });

    } catch (error) {
        console.error('Get submission error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/all-my-scores
 * Get all test submissions for the current user
 */
router.get('/all-my-scores', async (req, res) => {
    try {
        let userId = req.user?.id;
        const targetUserId = req.query.userId || req.query.studentId;

        // 🕵️ [ADMIN PREVIEW] Robust handling for admin proxy requests
        // Check if requester is an admin (either directly or via previous swap)
        const isAuthorizedAdmin = req.user?.isPreview || req.user?.adminId || req.user?.role?.toLowerCase() === 'admin';
        
        if (targetUserId && isAuthorizedAdmin) {
            userId = targetUserId;
            console.log(`🕵️ [Admin Proxy] Swapping to explicit target user for scores: ${userId}`);
        }

        if (!userId) {
            console.warn(`[Grading] Unauthorized access attempt to ${req.url}`);
            return res.status(401).json({ 
                error: 'Unauthorized',
                debug: {
                    hasReqUser: !!req.user,
                    authFailure: req.authFailure,
                    hasAuthHeader: !!req.headers.authorization,
                    queryUserId: req.query.userId,
                    url: req.url
                }
            });
        }

        console.log(`📡 [ScoresFetch] Querying test_submissions for user_id: ${userId}`);

        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select('id, user_id, course_id, level, raw_score, scaled_score, math_scaled_score, reading_scaled_score, total_questions, raw_score_percentage, test_duration_seconds, is_completed, test_date, created_at, courses:courses(id, name, is_practice, tutor_type, main_category, category, is_adaptive)')
            .eq('user_id', userId)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('❌ [ScoresFetch Error] Failed to fetch scores:', error);
            return res.status(500).json({ error: 'Failed to fetch scores' });
        }

        console.log(`✅ [ScoresFetch Success] Found ${submissions?.length || 0} scores for ${userId}`);
        res.json({ submissions: submissions || [] });

    } catch (error) {
        console.error('💥 [ScoresFetch Fatal] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/my-enrollments
 * Get all course enrollments for current user (or preview target)
 */
router.get('/my-enrollments', async (req, res) => {
    try {
        let userId = req.user?.id;
        const targetUserId = req.query.userId || req.query.studentId;

        if (targetUserId && (req.user?.isPreview || req.user?.adminId || req.user?.role?.toLowerCase() === 'admin')) {
            userId = targetUserId;
            console.log(`🕵️ [Admin Proxy] Swapping to target user for enrollments: ${userId}`);
        }

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data, error } = await supabase
            .from('enrollments')
            .select('course_id, enrolled_at, courses(*)')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching enrollments:', error);
            return res.status(500).json({ error: 'Failed to fetch enrollments' });
        }

        res.json(data || []);
    } catch (error) {
        console.error('Get my enrollments error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/my-progress
 * Get all progress records for current user (or preview target)
 */
router.get('/my-progress', async (req, res) => {
    try {
        let userId = req.user?.id;
        const targetUserId = req.query.userId || req.query.studentId;

        if (targetUserId && (req.user?.isPreview || req.user?.adminId || req.user?.role?.toLowerCase() === 'admin')) {
            userId = targetUserId;
            console.log(`🕵️ [Admin Proxy] Swapping to explicit target user for progress: ${userId}`);
        }

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data, error } = await supabase
            .from('student_progress')
            .select('*, courses(name, tutor_type)')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching progress:', error);
            return res.status(500).json({ error: 'Failed to fetch progress' });
        }

        res.json(data || []);
    } catch (error) {
        console.error('Get my progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/my-plan
 * Get the study plan for current user (or preview target)
 */
router.get('/my-plan', async (req, res) => {
    try {
        let userId = req.user?.id;
        const targetUserId = req.query.userId || req.query.studentId;

        // 🕵️ [ADMIN PREVIEW] Allow admins to explicitly request a specific user's plan
        if (targetUserId && targetUserId !== userId) {
            const isAuthorizedAdmin = req.user?.adminId || req.user?.role?.toLowerCase() === 'admin';
            if (isAuthorizedAdmin) {
                userId = targetUserId;
                console.log(`🕵️ [Admin Proxy] Swapping to explicit target user for plan: ${userId}`);
            }
        }

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data, error } = await supabase
            .from('student_plans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Error fetching plan:', error);
            return res.status(500).json({ error: 'Failed to fetch plan' });
        }

        res.json(data || null);
    } catch (error) {
        console.error('Get my plan error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/my-scores/:courseId
 * Get all scores for a specific course (current user)
 */
router.get('/my-scores/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('Error fetching scores:', error);
            return res.status(500).json({ error: 'Failed to fetch scores' });
        }

        res.json({ submissions: submissions || [] });

    } catch (error) {
        console.error('Get scores error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/section-analysis/:courseId
 * Get section-wise performance analysis
 */
router.get('/section-analysis/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get all submissions for this course
        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .order('test_date', { ascending: true });

        if (error) {
            console.error('Error fetching submissions:', error);
            return res.status(500).json({ error: 'Failed to fetch analysis data' });
        }

        // Calculate averages and trends
        const analysis = {
            math: {
                attempts: 0,
                averagePercentage: 0,
                averageScaled: 0,
                bestScore: 0,
                improvement: 0,
                trend: []
            },
            reading: {
                attempts: 0,
                averagePercentage: 0,
                averageScaled: 0,
                bestScore: 0,
                improvement: 0,
                trend: []
            },
            writing: {
                attempts: 0,
                averagePercentage: 0,
                averageScaled: 0,
                bestScore: 0,
                improvement: 0,
                trend: []
            },
            overall: {
                attempts: submissions.length,
                averagePercentage: 0,
                averageScaled: 0,
                bestScore: 0,
                improvement: 0,
                trend: []
            }
        };

        if (submissions.length > 0) {
            let mathTotal = 0, mathCount = 0;
            let readingTotal = 0, readingCount = 0;
            let writingTotal = 0, writingCount = 0;
            let overallTotal = 0;

            submissions.forEach((sub, index) => {
                // Math
                if (sub.math_total_questions > 0) {
                    mathTotal += sub.math_percentage;
                    mathCount++;
                    analysis.math.trend.push({
                        date: sub.test_date,
                        percentage: sub.math_percentage,
                        scaled: sub.math_scaled_score
                    });
                    if (sub.math_percentage > analysis.math.bestScore) {
                        analysis.math.bestScore = sub.math_percentage;
                    }
                }

                // Reading
                if (sub.reading_total_questions > 0) {
                    readingTotal += sub.reading_percentage;
                    readingCount++;
                    analysis.reading.trend.push({
                        date: sub.test_date,
                        percentage: sub.reading_percentage,
                        scaled: sub.reading_scaled_score
                    });
                    if (sub.reading_percentage > analysis.reading.bestScore) {
                        analysis.reading.bestScore = sub.reading_percentage;
                    }
                }

                // Writing
                if (sub.writing_total_questions > 0) {
                    writingTotal += sub.writing_percentage;
                    writingCount++;
                    analysis.writing.trend.push({
                        date: sub.writing_test_date,
                        percentage: sub.writing_percentage,
                        scaled: sub.writing_scaled_score
                    });
                    if (sub.writing_percentage > analysis.writing.bestScore) {
                        analysis.writing.bestScore = sub.writing_percentage;
                    }
                }

                // Overall
                overallTotal += sub.raw_score_percentage;
                analysis.overall.trend.push({
                    date: sub.test_date,
                    percentage: sub.raw_score_percentage,
                    scaled: sub.scaled_score
                });
                if (sub.raw_score_percentage > analysis.overall.bestScore) {
                    analysis.overall.bestScore = sub.raw_score_percentage;
                }
            });

            // Calculate averages
            if (mathCount > 0) {
                analysis.math.averagePercentage = mathTotal / mathCount;
                analysis.math.attempts = mathCount;
                // Calculate improvement (first vs latest)
                if (mathCount >= 2) {
                    const firstScore = analysis.math.trend[0].percentage;
                    const latestScore = analysis.math.trend[mathCount - 1].percentage;
                    analysis.math.improvement = latestScore - firstScore;
                }
            }

            if (readingCount > 0) {
                analysis.reading.averagePercentage = readingTotal / readingCount;
                analysis.reading.attempts = readingCount;
                if (readingCount >= 2) {
                    const firstScore = analysis.reading.trend[0].percentage;
                    const latestScore = analysis.reading.trend[readingCount - 1].percentage;
                    analysis.reading.improvement = latestScore - firstScore;
                }
            }

            if (writingCount > 0) {
                analysis.writing.averagePercentage = writingTotal / writingCount;
                analysis.writing.attempts = writingCount;
                if (writingCount >= 2) {
                    const firstScore = analysis.writing.trend[0].percentage;
                    const latestScore = analysis.writing.trend[writingCount - 1].percentage;
                    analysis.writing.improvement = latestScore - firstScore;
                }
            }

            analysis.overall.averagePercentage = overallTotal / submissions.length;
            if (submissions.length >= 2) {
                const firstScore = analysis.overall.trend[0].percentage;
                const latestScore = analysis.overall.trend[submissions.length - 1].percentage;
                analysis.overall.improvement = latestScore - firstScore;
            }
        }

        res.json({ analysis });

    } catch (error) {
        console.error('Section analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/grading/configure-scale
 * Configure grade scale for a course (admin only)
 */
router.post('/configure-scale', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, section, minRaw, maxRaw, minScaled, maxScaled } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify user is admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || (profile.role !== 'admin' && !req.user?.adminId)) {
            return res.status(403).json({ error: 'Only admins can configure grade scales' });
        }

        // Deactivate existing scales for this course/section
        await supabase
            .from('grade_scales')
            .update({ is_active: false })
            .eq('course_id', courseId)
            .eq('section', section);

        // Create new scale
        const { data: scale, error } = await supabase
            .from('grade_scales')
            .insert({
                course_id: courseId,
                section,
                min_raw_score: minRaw,
                max_raw_score: maxRaw,
                min_scaled_score: minScaled,
                max_scaled_score: maxScaled,
                scale_type: 'linear',
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating grade scale:', error);
            return res.status(500).json({ error: 'Failed to create grade scale' });
        }

        res.json({ scale });

    } catch (error) {
        console.error('Configure scale error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/leaderboard/:courseId
 * Get course-specific leaderboard based on BEST weighted score per student
 */
router.get('/leaderboard/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        const currentUserId = req.user?.id;
        console.log(`📡 [Leaderboard] Fetching best weighted scores for course ${courseId}`);

        // 1. Fetch course details
        const { data: course } = await supabase.from('courses').select('name, tutor_type').eq('id', courseId).single();
        const category = getCategory(course?.name, course?.tutor_type);
        const maxScore = (course?.name?.toUpperCase().includes('ENGLISH') || course?.name?.toUpperCase().includes('MATH') || course?.name?.toUpperCase().includes('RW')) ? 800 : 1600;

        // 2. Fetch ALL test submissions for this course
        const { data: allSubmissions, error: subError } = await supabase
            .from('test_submissions')
            .select(`
                user_id,
                scaled_score,
                profiles!inner(id, name, role)
            `)
            .eq('course_id', courseId)
            .eq('profiles.role', 'student');

        if (subError) {
            console.error('Leaderboard fetch error:', subError);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }

        // 3. Group by user and find the BEST scaled_score
        const studentMap = new Map();
        allSubmissions.forEach(sub => {
            const userId = sub.user_id;
            const score = Number(sub.scaled_score) || 0;
            
            if (!studentMap.has(userId)) {
                studentMap.set(userId, {
                    user_id: userId,
                    name: sub.profiles?.name || 'Anonymous Student',
                    score: score,
                    levels_completed: 1
                });
            } else {
                const existing = studentMap.get(userId);
                if (score > existing.score) {
                    existing.score = score;
                }
                existing.levels_completed++;
            }
        });

        // 4. Calculate final ranking
        const allRankings = Array.from(studentMap.values()).sort((a, b) => b.score - a.score);

        // 5. Format results
        const leaderboard = allRankings.slice(0, 50).map(s => ({
            ...s,
            scoreDisplay: `${s.score}`
        }));

        let myRank = null;
        if (currentUserId) {
            const myIndex = allRankings.findIndex(s => s.user_id === currentUserId);
            if (myIndex !== -1) {
                const myData = allRankings[myIndex];
                myRank = {
                    rank: myIndex + 1,
                    score: myData.score,
                    scoreDisplay: `${myData.score}`,
                    name: myData.name,
                    levels_completed: myData.levels_completed
                };
            }
        }

        console.log(`✅ [Leaderboard] Return ${leaderboard.length} rankings for course ${courseId}. My Rank: ${myRank?.rank || 'N/A'}`);
        res.json({ leaderboard, myRank });

    } catch (error) {
        console.error('Leaderboard processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/global-leaderboard
 * Global Rankings based on total SAT score (Math + RW)
 */
router.get('/global-leaderboard', async (req, res) => {
    try {
        const currentUserId = req.user?.id;
        console.log(`📡 [GlobalLeaderboard] Calculating total SAT scores for all students...`);

        // 1. Fetch all test submissions for students
        const { data: allSubmissions, error } = await supabase
            .from('test_submissions')
            .select(`
                user_id,
                scaled_score,
                math_scaled_score,
                reading_scaled_score,
                writing_scaled_score,
                courses!inner(name, tutor_type, category, main_category),
                profiles!inner(id, name, role)
            `)
            .eq('profiles.role', 'student');

        if (error) {
            console.error('Global leaderboard fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch global rankings' });
        }

        // 2. Group by user to calculate super score
        const userGroups = {};
        allSubmissions.forEach(sub => {
            const course = sub.courses;
            // Filter only SAT-related courses
            const isSAT = (course?.name?.toUpperCase().includes('SAT') || 
                          course?.tutor_type?.toUpperCase().includes('SAT') || 
                          course?.category?.toUpperCase().includes('SAT') ||
                          course?.main_category?.toUpperCase().includes('SAT'));
                          
            const isACT = (course?.name?.toUpperCase().includes('ACT') || 
                          course?.tutor_type?.toUpperCase().includes('ACT') || 
                          course?.category?.toUpperCase().includes('ACT') ||
                          course?.main_category?.toUpperCase().includes('ACT'));

            if (!isSAT || isACT) return; // Skip non-SAT tests

            const uid = sub.user_id;
            if (!userGroups[uid]) {
                userGroups[uid] = {
                    user_id: uid,
                    name: sub.profiles?.name || 'Anonymous Student',
                    maxMath: 0,
                    maxRW: 0,
                    submissions_count: 0
                };
            }

            const cat = getCategory(course?.name, course?.tutor_type);
            const userState = userGroups[uid];
            userState.submissions_count++;

            const scaledScore = Number(sub.scaled_score) || 0;
            const mathScaled = Number(sub.math_scaled_score) || 0;
            const readingScaled = Number(sub.reading_scaled_score) || 0;
            const writingScaled = Number(sub.writing_scaled_score) || 0;

            // If it's a full length test with component scores
            if (mathScaled > 0 || readingScaled > 0) {
                if (mathScaled > userState.maxMath) userState.maxMath = mathScaled;
                const totalRW = readingScaled + writingScaled;
                // Sometimes reading_scaled_score includes both, sometimes separate. 
                // Let's use reading_scaled_score if it's the combined RW score.
                const effectiveRW = (readingScaled > 0 && readingScaled <= 400 && writingScaled > 0) ? (readingScaled + writingScaled) : readingScaled;
                if (effectiveRW > userState.maxRW) userState.maxRW = effectiveRW;
            } 
            // If it's a modular test and we only have scaled_score
            else if (cat === 'MATH') {
                if (scaledScore > userState.maxMath) userState.maxMath = scaledScore;
            } else if (cat === 'RW') {
                if (scaledScore > userState.maxRW) userState.maxRW = scaledScore;
            } else {
                // Unknown SAT module type, maybe a full length that only populated scaled_score
                // Distribute evenly or skip if we can't determine (fallback logic)
                if (scaledScore > 800) { 
                    // Assume it's a full test total score
                    const estimatedMath = Math.round(scaledScore / 2);
                    const estimatedRW = scaledScore - estimatedMath;
                    if (estimatedMath > userState.maxMath) userState.maxMath = estimatedMath;
                    if (estimatedRW > userState.maxRW) userState.maxRW = estimatedRW;
                }
            }
        });

        // 3. Calculate scores for each user
        const allRankings = Object.values(userGroups).map(u => {
            const bestMath = Math.min(800, Math.max(200, u.maxMath || 200));
            const bestRW = Math.min(800, Math.max(200, u.maxRW || 200));
            const total = bestMath + bestRW;

            return {
                user_id: u.user_id,
                name: u.name,
                total_points: total, // frontend expects total_points
                scoreDisplay: `${total}`,
                levels_completed: u.submissions_count
            };
        }).sort((a, b) => b.total_points - a.total_points);

        // 4. Final format
        const leaderboard = allRankings.slice(0, 50);

        let myRank = null;
        if (currentUserId) {
            const myIndex = allRankings.findIndex(s => s.user_id === currentUserId);
            if (myIndex !== -1) {
                const myData = allRankings[myIndex];
                myRank = {
                    rank: myIndex + 1,
                    score: myData.total_points,
                    scoreDisplay: myData.scoreDisplay,
                    name: myData.name,
                    levels_completed: myData.levels_completed
                };
            }
        }

        res.json({ leaderboard, myRank });

    } catch (error) {
        console.error('Global leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/universal-leaderboard
 * Shared Leaderboard backend calculation for Student, Tutor, Admin, and Parent
 */
router.get('/universal-leaderboard', async (req, res) => {
    try {
        const currentUserId = req.user?.id;
        const {
            category = 'SAT',
            apCourseId,
            testCourseId,
            groupId,
            tutorId,
            targetStudentId,
            topicName,
            subtopicName
        } = req.query;

        // 1. Fetch available options for AP Courses & Full-Length Tests
        const { data: allCourses } = await supabase
            .from('courses')
            .select('id, name, category, tutor_type, main_category, is_adaptive');

        let apCourses = (allCourses || []).filter(c => classifyCourseForLeaderboard(c).mainCat === 'AP');

        // Resolve candidate Full-Length Test courses using the same reliable classification as
        // everywhere else in this endpoint.
        let candidateTests = (allCourses || []).filter(c => classifyCourseForLeaderboard(c).mainCat === 'FULL_LENGTH');

        // Role-based assignment scoping (Step A: Assignment controls dropdown)
        // req.user is the raw Supabase Auth user (no .role) - the real role lives in `profiles`.
        let fullLengthTests = candidateTests;
        const requestingUser = req.user || {};
        let requestingRole = 'student';
        if (requestingUser.id) {
            const { data: requestingProfile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', requestingUser.id)
                .single();
            requestingRole = requestingProfile?.role || 'student';
        }
        const effectiveStudentUserId = targetStudentId || requestingUser.id;

        if (requestingRole === 'student' && effectiveStudentUserId) {
            const { data: userGroupMembers } = await supabase
                .from('group_members')
                .select('group_id, student_groups(assigned_course_ids)')
                .eq('student_id', effectiveStudentUserId);

            const assignedTestIds = new Set();
            (userGroupMembers || []).forEach(gm => {
                const ids = gm.student_groups?.assigned_course_ids;
                if (Array.isArray(ids)) ids.forEach(cId => assignedTestIds.add(String(cId)));
            });

            const { data: userSubmissions } = await supabase
                .from('test_submissions')
                .select('course_id')
                .eq('user_id', effectiveStudentUserId);
            (userSubmissions || []).forEach(s => {
                if (s.course_id) assignedTestIds.add(String(s.course_id));
            });

            if (assignedTestIds.size > 0) {
                const scopedTests = candidateTests.filter(c => assignedTestIds.has(String(c.id)));
                if (scopedTests.length > 0) {
                    fullLengthTests = scopedTests;
                }
            }
        } else if (requestingRole === 'tutor' && tutorId && tutorId !== 'all') {
            const { data: tutorGroupData } = await supabase
                .from('student_groups')
                .select('id, assigned_course_ids')
                .eq('created_by', tutorId);

            const tutorTestIds = new Set();
            (tutorGroupData || []).forEach(g => {
                if (Array.isArray(g.assigned_course_ids)) {
                    g.assigned_course_ids.forEach(cId => tutorTestIds.add(String(cId)));
                }
            });

            if (tutorTestIds.size > 0) {
                const scopedTests = candidateTests.filter(c => tutorTestIds.has(String(c.id)));
                if (scopedTests.length > 0) {
                    fullLengthTests = scopedTests;
                }
            }
        }

        // Further scope the Full-Length Test / AP Course dropdowns to a specific selected group's assignments
        if (groupId && groupId !== 'all') {
            const { data: selectedGroupRow } = await supabase
                .from('student_groups')
                .select('assigned_course_ids')
                .eq('id', groupId)
                .single();
            const groupCourseIds = new Set((selectedGroupRow?.assigned_course_ids || []).map(String));
            if (groupCourseIds.size > 0) {
                const scopedByGroup = candidateTests.filter(c => groupCourseIds.has(String(c.id)));
                if (scopedByGroup.length > 0) fullLengthTests = scopedByGroup;

                const apScopedByGroup = apCourses.filter(c => groupCourseIds.has(String(c.id)));
                if (apScopedByGroup.length > 0) apCourses = apScopedByGroup;
            }
        }

        // 2. Determine allowed student ids based on Group / Tutor scope
        let allowedStudentIds = null;

        if (groupId && groupId !== 'all') {
            const { data: members } = await supabase
                .from('group_members')
                .select('student_id')
                .eq('group_id', groupId);
            allowedStudentIds = members?.map(m => m.student_id) || [];
        } else if (tutorId && tutorId !== 'all') {
            const { data: tutorGroups } = await supabase
                .from('student_groups')
                .select('id')
                .eq('created_by', tutorId);
            const groupIds = tutorGroups?.map(g => g.id) || [];
            if (groupIds.length > 0) {
                const { data: members } = await supabase
                    .from('group_members')
                    .select('student_id')
                    .in('group_id', groupIds);
                allowedStudentIds = members?.map(m => m.student_id) || [];
            } else {
                allowedStudentIds = [];
            }
        }

        // 2b. Assigned vs Attempted stats for a specifically selected test/course
        const selectedCourseIdForStats = (category === 'Full-Length Test' && testCourseId && testCourseId !== 'all')
            ? testCourseId
            : (category === 'AP' && apCourseId && apCourseId !== 'all')
                ? apCourseId
                : null;

        let assignedCount = null;
        if (selectedCourseIdForStats) {
            let statGroupsQuery = supabase.from('student_groups').select('id, assigned_course_ids');
            if (groupId && groupId !== 'all') {
                statGroupsQuery = statGroupsQuery.eq('id', groupId);
            } else if (tutorId && tutorId !== 'all') {
                statGroupsQuery = statGroupsQuery.eq('created_by', tutorId);
            } else if (requestingRole === 'tutor') {
                statGroupsQuery = statGroupsQuery.eq('created_by', requestingUser.id);
            }
            const { data: statGroups } = await statGroupsQuery;
            const relevantGroupIds = (statGroups || [])
                .filter(g => Array.isArray(g.assigned_course_ids) && g.assigned_course_ids.some(id => String(id) === String(selectedCourseIdForStats)))
                .map(g => g.id);

            if (relevantGroupIds.length > 0) {
                const { data: assignedMembers } = await supabase
                    .from('group_members')
                    .select('student_id')
                    .in('group_id', relevantGroupIds);
                assignedCount = new Set((assignedMembers || []).map(m => m.student_id)).size;
            } else {
                assignedCount = 0;
            }
        }

        // 3. Fetch submissions (completed attempts only)
        let submissionsQuery = supabase
            .from('test_submissions')
            .select(`
                id,
                user_id,
                course_id,
                scaled_score,
                math_scaled_score,
                reading_scaled_score,
                writing_scaled_score,
                raw_score_percentage,
                total_questions,
                correct_questions,
                test_duration_seconds,
                created_at,
                courses(id, name, category, tutor_type, main_category),
                profiles:user_id(id, name, email, role)
            `)
            .eq('is_completed', true);

        if (allowedStudentIds !== null) {
            if (allowedStudentIds.length === 0) {
                return res.json({
                    rankings: [],
                    top5: [],
                    featuredRank: null,
                    apCourses,
                    fullLengthTests,
                    assignedCount,
                    completedCount: selectedCourseIdForStats ? 0 : null,
                    highestScore: null,
                    averageScore: null
                });
            }
            submissionsQuery = submissionsQuery.in('user_id', allowedStudentIds);
        }

        const { data: submissions } = await submissionsQuery;

        // Determine if this is a Topic or Subtopic category request
        const isTopicCategory = category.includes('Topic');
        const isSubtopicCategory = category.includes('Subtopic');

        // Group submissions by student
        const studentMap = {};

        (submissions || []).forEach(sub => {
            const uid = sub.user_id;
            const profile = sub.profiles;
            if (!profile || profile.role !== 'student') return;

            const courseObj = sub.courses || {};
            const classification = classifyCourseForLeaderboard(courseObj);
            const cleanTopic = (classification.topic || '').toLowerCase().trim();
            const cleanSubtopic = (classification.subtopic || '').toLowerCase().trim();

            // Filters for Topic / Subtopic matching against historical attempt data. Matched by
            // exact Topic (courses.category) / Subtopic (courses.name) string, scoped to the
            // correct subject via classifyCourseForLeaderboard - never a loose substring guess
            // that could pull in Full-Length/ACT/other-subject attempts.
            if (isSubtopicCategory && subtopicName) {
                const searchSub = subtopicName.toLowerCase().trim();
                let isMatch = false;

                if (category.startsWith('SAT Math')) {
                    isMatch = classification.mainCat === 'SAT' && classification.subCat === 'SAT Math' && cleanSubtopic === searchSub;
                } else if (category.includes('Reading & Writing')) {
                    isMatch = classification.mainCat === 'SAT' && classification.subCat === 'SAT Reading & Writing' && cleanSubtopic === searchSub;
                } else if (category.startsWith('AP')) {
                    isMatch = classification.mainCat === 'AP' && cleanSubtopic === searchSub &&
                        (!apCourseId || apCourseId === 'all' || String(courseObj.id) === String(apCourseId));
                }

                if (!isMatch) return;
            } else if (isTopicCategory && topicName) {
                const searchTop = topicName.toLowerCase().trim();
                let isMatch = false;

                if (category.startsWith('SAT Math')) {
                    isMatch = classification.mainCat === 'SAT' && classification.subCat === 'SAT Math' && cleanTopic === searchTop;
                } else if (category.includes('Reading & Writing')) {
                    isMatch = classification.mainCat === 'SAT' && classification.subCat === 'SAT Reading & Writing' && cleanTopic === searchTop;
                } else if (category.startsWith('AP')) {
                    isMatch = classification.mainCat === 'AP' && cleanTopic === searchTop &&
                        (!apCourseId || apCourseId === 'all' || String(courseObj.id) === String(apCourseId));
                }

                if (!isMatch) return;
            }

            if (!studentMap[uid]) {
                studentMap[uid] = {
                    student_id: uid,
                    name: profile.name || 'Student',
                    email: profile.email || '',
                    mathScores: [],
                    rwScores: [],
                    mathQuestions: 0, mathCorrect: 0, mathAttempts: 0,
                    rwQuestions: 0, rwCorrect: 0, rwAttempts: 0,
                    courseSubmissions: {},
                    totalQuestions: 0,
                    totalCorrect: 0,
                    completedTests: 0
                };
            }

            const st = studentMap[uid];

            const pct = Number(sub.raw_score_percentage || 0);
            const qCount = Number(sub.total_questions || 0);
            const cCount = Array.isArray(sub.correct_questions) ? sub.correct_questions.length : Math.round((pct / 100) * qCount);

            st.totalQuestions += qCount;
            st.totalCorrect += cCount;
            st.completedTests++;

            // SAT Math / SAT Reading & Writing scores are only ever built from regular SAT Math /
            // SAT Reading & Writing attempts - Full-Length Tests, ACT, and AP submissions never
            // contribute here, regardless of course naming.
            if (classification.mainCat === 'SAT' && classification.subCat === 'SAT Math') {
                const mathVal = sub.math_scaled_score || sub.scaled_score || Math.round(200 + (pct / 100) * 600);
                if (mathVal >= 200 && mathVal <= 800) st.mathScores.push(mathVal);
                st.mathQuestions += qCount;
                st.mathCorrect += cCount;
                st.mathAttempts++;
            } else if (classification.mainCat === 'SAT' && classification.subCat === 'SAT Reading & Writing') {
                const rwVal = sub.reading_scaled_score || sub.scaled_score || Math.round(200 + (pct / 100) * 600);
                if (rwVal >= 200 && rwVal <= 800) st.rwScores.push(rwVal);
                st.rwQuestions += qCount;
                st.rwCorrect += cCount;
                st.rwAttempts++;
            }

            const courseIdKey = String(sub.course_id);
            if (!st.courseSubmissions[courseIdKey]) {
                st.courseSubmissions[courseIdKey] = [];
            }
            const rawScaled = sub.scaled_score || ((sub.math_scaled_score || 0) + (sub.reading_scaled_score || 0)) || Math.round(400 + (pct / 100) * 1200);
            st.courseSubmissions[courseIdKey].push({
                pct,
                scaledScore: rawScaled > 0 ? rawScaled : Math.round(400 + (pct / 100) * 1200),
                qCount,
                cCount
            });
        });

        // When scoped to a group/tutor roster, a member with zero qualifying submissions must
        // still appear on the leaderboard (as an unranked "--" row) rather than silently vanish -
        // otherwise the group's own roster size never matches what's shown. Platform-wide ("All")
        // requests are untouched: allowedStudentIds stays null there, so this backfill never runs.
        if (allowedStudentIds !== null) {
            const missingIds = allowedStudentIds.filter(id => !studentMap[id]);
            if (missingIds.length > 0) {
                const { data: missingProfiles } = await supabase
                    .from('profiles')
                    .select('id, name, email, role')
                    .in('id', missingIds);

                (missingProfiles || []).forEach(profile => {
                    if (profile.role !== 'student') return;
                    studentMap[profile.id] = {
                        student_id: profile.id,
                        name: profile.name || 'Student',
                        email: profile.email || '',
                        mathScores: [], rwScores: [],
                        mathQuestions: 0, mathCorrect: 0, mathAttempts: 0,
                        rwQuestions: 0, rwCorrect: 0, rwAttempts: 0,
                        courseSubmissions: {},
                        totalQuestions: 0,
                        totalCorrect: 0,
                        completedTests: 0
                    };
                });
            }
        }

        // 4. Calculate score & metric per category for each student
        const studentList = Object.values(studentMap).map(st => {
            let primaryScore = 0;
            let scoreDisplay = '0';
            let accuracy = st.totalQuestions > 0 ? Math.round((st.totalCorrect / st.totalQuestions) * 100) : 0;
            // Display totals default to the student's global activity; categories scoped to a
            // specific test/course (AP, Full-Length Test) override these below so unrelated
            // attempts never leak into that test's stats.
            let displayTotalQuestions = st.totalQuestions;
            let displayTotalCorrect = st.totalCorrect;
            let displayCompletedTests = st.completedTests;

            const bestMath = st.mathScores.length > 0 ? Math.max(...st.mathScores) : 0;
            const bestRw = st.rwScores.length > 0 ? Math.max(...st.rwScores) : 0;

            if (isSubtopicCategory || isTopicCategory) {
                // Rank by the real per-topic scaled score already computed and stored by
                // calculate_scaled_score at submission time (not a fabricated percent->scale
                // conversion). Accuracy is kept as the secondary metric, tied to the same
                // best-scoring attempt.
                const allMatchingSubs = Object.values(st.courseSubmissions).flat();
                if (allMatchingSubs.length > 0) {
                    const bestScaled = Math.max(...allMatchingSubs.map(s => s.scaledScore));
                    const bestAttempt = allMatchingSubs.find(s => s.scaledScore === bestScaled) || allMatchingSubs[0];
                    primaryScore = bestScaled;
                    scoreDisplay = `${bestScaled} / 800`;
                    accuracy = bestAttempt.qCount > 0 ? Math.round((bestAttempt.cCount / bestAttempt.qCount) * 100) : 0;
                } else {
                    primaryScore = 0;
                    scoreDisplay = '--';
                    accuracy = 0;
                }
            } else if (category === 'SAT') {
                // SAT Overall = regular SAT Math + regular SAT Reading & Writing ONLY. Never
                // substitute a Full-Length Test score for a missing component - if either half
                // isn't done yet, this student isn't rankable for "SAT Overall" yet (matches the
                // same "don't fabricate an incomplete combined score" rule used for the
                // student-facing combined topic report).
                if (bestMath > 0 && bestRw > 0) {
                    primaryScore = bestMath + bestRw;
                    scoreDisplay = `${primaryScore} / 1600`;
                    displayTotalQuestions = st.mathQuestions + st.rwQuestions;
                    displayTotalCorrect = st.mathCorrect + st.rwCorrect;
                    displayCompletedTests = st.mathAttempts + st.rwAttempts;
                    accuracy = displayTotalQuestions > 0 ? Math.round((displayTotalCorrect / displayTotalQuestions) * 100) : 0;
                } else {
                    primaryScore = 0;
                    scoreDisplay = '--';
                    displayTotalQuestions = 0;
                    displayTotalCorrect = 0;
                    displayCompletedTests = 0;
                }
            } else if (category === 'SAT Math') {
                primaryScore = bestMath;
                scoreDisplay = bestMath > 0 ? `${bestMath} / 800` : '--';
                displayTotalQuestions = st.mathQuestions;
                displayTotalCorrect = st.mathCorrect;
                displayCompletedTests = st.mathAttempts;
                accuracy = displayTotalQuestions > 0 ? Math.round((displayTotalCorrect / displayTotalQuestions) * 100) : 0;
            } else if (category === 'SAT Reading & Writing') {
                primaryScore = bestRw;
                scoreDisplay = bestRw > 0 ? `${bestRw} / 800` : '--';
                displayTotalQuestions = st.rwQuestions;
                displayTotalCorrect = st.rwCorrect;
                displayCompletedTests = st.rwAttempts;
                accuracy = displayTotalQuestions > 0 ? Math.round((displayTotalCorrect / displayTotalQuestions) * 100) : 0;
            } else if (category === 'AP') {
                let targetCourseSubs = [];
                if (apCourseId && apCourseId !== 'all') {
                    targetCourseSubs = st.courseSubmissions[String(apCourseId)] || [];
                } else {
                    apCourses.forEach(c => {
                        const subs = st.courseSubmissions[String(c.id)];
                        if (subs) targetCourseSubs.push(...subs);
                    });
                }

                displayTotalQuestions = targetCourseSubs.reduce((s, x) => s + x.qCount, 0);
                displayTotalCorrect = targetCourseSubs.reduce((s, x) => s + x.cCount, 0);
                displayCompletedTests = targetCourseSubs.length;
                accuracy = displayTotalQuestions > 0 ? Math.round((displayTotalCorrect / displayTotalQuestions) * 100) : 0;

                const bestPct = targetCourseSubs.length > 0 ? Math.max(...targetCourseSubs.map(s => s.pct)) : 0;
                primaryScore = bestPct;
                scoreDisplay = targetCourseSubs.length > 0 ? `${bestPct}%` : '--';
            } else if (category === 'Full-Length Test') {
                let targetCourseSubs = [];

                if (testCourseId && testCourseId !== 'all') {
                    targetCourseSubs = st.courseSubmissions[String(testCourseId)] || [];
                } else {
                    fullLengthTests.forEach(c => {
                        const subs = st.courseSubmissions[String(c.id)];
                        if (subs) targetCourseSubs.push(...subs);
                    });
                }

                displayTotalQuestions = targetCourseSubs.reduce((s, x) => s + x.qCount, 0);
                displayTotalCorrect = targetCourseSubs.reduce((s, x) => s + x.cCount, 0);
                displayCompletedTests = targetCourseSubs.length;

                if (targetCourseSubs.length > 0) {
                    const bestScaled = Math.max(...targetCourseSubs.map(s => s.scaledScore));
                    const bestAttempt = targetCourseSubs.find(s => s.scaledScore === bestScaled) || targetCourseSubs[0];

                    primaryScore = bestScaled;
                    scoreDisplay = `${bestScaled} / 1600`;
                    accuracy = bestAttempt.qCount > 0 ? Math.round((bestAttempt.cCount / bestAttempt.qCount) * 100) : 0;
                } else {
                    primaryScore = 0;
                    scoreDisplay = '--';
                    accuracy = 0;
                }
            }

            return {
                student_id: st.student_id,
                name: st.name,
                email: st.email,
                primaryScore,
                scoreDisplay,
                accuracy,
                totalCorrect: displayTotalCorrect,
                totalQuestions: displayTotalQuestions,
                completedTests: displayCompletedTests
            };
        }).filter(st => st.totalQuestions > 0 || st.primaryScore > 0 || allowedStudentIds !== null);

        // Sort descending by primaryScore, then totalCorrect
        studentList.sort((a, b) => {
            if (b.primaryScore !== a.primaryScore) return b.primaryScore - a.primaryScore;
            if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
            return b.totalQuestions - a.totalQuestions;
        });

        // 5. Apply Competition Tie-Ranking Algorithm (1, 2, 2, 4)
        let currentRank = 1;
        const rankings = studentList.map((st, index) => {
            if (index > 0 && st.primaryScore < studentList[index - 1].primaryScore) {
                currentRank = index + 1;
            }
            return {
                ...st,
                rank: currentRank
            };
        });

        // 6. Top 5 Podium
        const top5 = rankings.slice(0, 5);

        // 7. Featured Rank (for studentId or targetStudentId)
        const checkStudentId = targetStudentId || currentUserId;
        const featuredRank = rankings.find(r => r.student_id === checkStudentId) || null;

        // 8. Highest / Average score across all ranked students
        const highestScoreDisplay = rankings.length > 0 ? rankings[0].scoreDisplay : null;
        const averageScore = rankings.length > 0
            ? Math.round(rankings.reduce((sum, r) => sum + r.primaryScore, 0) / rankings.length)
            : null;

        res.json({
            rankings,
            top5,
            featuredRank,
            apCourses,
            fullLengthTests,
            assignedCount,
            completedCount: selectedCourseIdForStats ? rankings.length : null,
            highestScore: highestScoreDisplay,
            averageScore
        });
    } catch (err) {
        console.error('Universal Leaderboard error:', err);
        res.status(500).json({ error: 'Failed to calculate leaderboard' });
    }
});

/**
 * GET /api/grading/scales/:courseId
 * Get grade scales for a course
 */
router.get('/scales/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;

        const { data: scales, error } = await supabase
            .from('grade_scales')
            .select('*')
            .eq('course_id', courseId)
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching grade scales:', error);
            return res.status(500).json({ error: 'Failed to fetch grade scales' });
        }

        res.json({ scales: scales || [] });

    } catch (error) {
        console.error('Get scales error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/grading/weak-topics
 * Automatically detect weak topics based on recent test performance
 * Uses student_progress (score-based) as primary source since test_responses
 * may not be populated. Falls back to course-level low scores.
 */
router.get('/weak-topics', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // 1. Get all test submissions for this student (no is_practice filter - include all courses)
        const { data: submissions, error: subError } = await supabase
            .from('test_submissions')
            .select('id, course_id, level, raw_score, total_questions, raw_score_percentage, courses(id, name, is_practice)')
            .eq('user_id', userId)
            .order('test_date', { ascending: false })
            .limit(10);

        // 2. Try to get question-level responses for deeper analysis
        let responseBasedTopics = [];
        if (!subError && submissions?.length) {
            const subIds = submissions.map(s => s.id);
            const { data: responses } = await supabase
                .from('test_responses')
                .select('is_correct, question:questions(id, section, topic, level)')
                .in('submission_id', subIds);

            if (responses?.length) {
                const topicStats = {};
                responses.forEach(r => {
                    if (!r.question) return;
                    const topic = r.question.topic || 'General';
                    const section = r.question.section || 'general';
                    const key = `${section}:${topic}`;
                    if (!topicStats[key]) {
                        topicStats[key] = { topic, section, correct: 0, total: 0, level: r.question.level };
                    }
                    topicStats[key].total++;
                    if (r.is_correct) topicStats[key].correct++;
                });

                responseBasedTopics = Object.values(topicStats)
                    .filter(s => {
                        const acc = (s.correct / s.total) * 100;
                        return acc < 70 && (s.total - s.correct) >= 1;
                    })
                    .map(stats => {
                        const wrongCount = stats.total - stats.correct;
                        const sec = (stats.section || '').toLowerCase();
                        const top = (stats.topic || '').toLowerCase();
                        const subject = classifySubject(sec, top, submissions.find(s => s.id)?.courses?.name);
                        return {
                            topic: stats.topic,
                            subject,
                            reason: `Missed ${wrongCount} questions in recent tests`,
                            priority: wrongCount > 2 ? 'Critical' : 'High',
                            level: stats.level
                        };
                    })
                    .filter(wt => wt.subject === 'Math' || wt.subject === 'English');
            }
        }

        // 3. If we have question-level data, use it
        if (responseBasedTopics.length > 0) {
            return res.json({ weakTopics: responseBasedTopics });
        }

        // 4. Fallback: Use course-level score data from test_submissions
        //    Treat low-scoring tests (<= 50%) as weak areas, using the course name as topic
        if (!subError && submissions?.length) {
            const scoreBasedTopics = [];
            const seenCourses = new Set();

            for (const sub of submissions) {
                const percentage = sub.raw_score_percentage || ((sub.raw_score / sub.total_questions) * 100);
                if (percentage <= 50) {
                    const courseName = sub.courses?.name || 'General';
                    const courseKey = `${courseName}:${sub.level}`;
                    if (seenCourses.has(courseKey)) continue;
                    seenCourses.add(courseKey);

                    const subject = classifySubject('', '', courseName);
                    if (subject !== 'Math' && subject !== 'English') continue;

                    scoreBasedTopics.push({
                        topic: `${courseName} – ${sub.level} Level`,
                        subject,
                        reason: `Low accuracy (${Math.round(percentage)}%) on ${sub.level} test`,
                        priority: percentage < 30 ? 'Critical' : 'High',
                        level: sub.level
                    });
                }
            }

            if (scoreBasedTopics.length > 0) {
                return res.json({ weakTopics: scoreBasedTopics });
            }
        }

        // 5. Nothing found
        res.json({ weakTopics: [] });

    } catch (error) {
        console.error('Weak topics detection error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Classify a topic into Math or English based on topic name, section, and course name.
 * Priority: topic > section > courseName (to avoid course name polluting topic-level classification)
 */
function classifySubject(section, topic, courseName) {
    const s = (section || '').toLowerCase();
    const t = (topic || '').toLowerCase();
    const c = (courseName || '').toLowerCase();

    // Expanded Math keywords — covers all SAT Math topic categories
    const mathTopicKeywords = [
        // General math
        'math', 'sat math', 'algebra', 'arithmetic', 'calculus',
        // Geometry & Trig
        'geometry', 'trig', 'triangle', 'angle', 'circle', 'line', 'polygon', 'sine', 'cosine',
        'right triangle', 'pythagor', 'coordinate', 'slope', 'parallell', 'perpendicular',
        // Algebra
        'linear', 'equation', 'inequalit', 'expression', 'equivalent', 'quadratic',
        'polynomial', 'function', 'variable', 'system of equation', 'exponent', 'radical',
        // Statistics & Data
        'statistic', 'data', 'probability', 'ratio', 'proportion', 'percent', 'rate',
        'average', 'mean', 'median', 'mode', 'spread', 'distribution',
        // Numbers & Operations
        'number', 'integer', 'fraction', 'decimal', 'prime', 'factor', 'multiple',
        'arithmetic operation', 'absolute value', 'complex number',
        // SAT Math specific topics
        'area', 'volume', 'perimeter', 'surface area', 'unit', 'conversion',
        'scatterplot', 'two-way table', 'inference', 'sample', 'margin of error',
        'nonlinear', 'parabola', 'vertex', 'modeling', 'word problem',
        'heart of algebra', 'passport to advanced math', 'problem solving',
        'full length', 'test', 'practice test'
    ];

    // English keywords — covers all SAT Reading & Writing topic categories
    const engTopicKeywords = [
        // General
        'english', 'reading', 'writing', 'sat english', 'reading & writing',
        // Craft & Structure
        'craft', 'structure', 'words in context', 'text structure', 'rhetoric',
        'purpose', 'point of view', 'author', 'tone', 'diction', 'word choice',
        // Information & Ideas
        'information', 'ideas', 'central idea', 'command of evidence', 'detail',
        'summary', 'argument', 'claim', 'support', 'conclusion', 'inference',
        // Standard English Conventions
        'grammar', 'convention', 'punctuation', 'sentence', 'clause', 'modifier',
        'subject-verb', 'pronoun', 'agreement', 'tense', 'parallel', 'transition',
        // Expression of Ideas
        'expression', 'development', 'organization', 'style', 'cohesion', 'vocabulary',
        'literature', 'passage', 'comprehension', 'evidence', 'synthesis',
        'full length', 'test', 'practice test'
    ];

    // Step 1: Check topic and section FIRST (never use courseName at this stage)
    const topicIsMatch = (keywords) => keywords.some(k => t.includes(k));
    const sectionIsMatch = (keywords) => keywords.some(k => s.includes(k));

    if (topicIsMatch(mathTopicKeywords)) return 'Math';
    if (topicIsMatch(engTopicKeywords)) return 'English';
    if (sectionIsMatch(mathTopicKeywords)) return 'Math';
    if (sectionIsMatch(engTopicKeywords)) return 'English';

    // Step 2: Only fall back to courseName when topic/section give no signal
    if (mathTopicKeywords.some(k => c.includes(k))) return 'Math';
    if (engTopicKeywords.some(k => c.includes(k))) return 'English';

    return 'Other Subjects';
}

/**
 * GET /api/grading/topic-report/:courseId
 * Get a combined Topic Report (Easy + Medium + Hard) for the authenticated student.
 */
router.get('/topic-report/:courseId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const data = await analyticsService.getTopicCombinedReport(null, userId, parseInt(courseId));
        res.json(data);
    } catch (error) {
        console.error('Topic report error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

export default router;

