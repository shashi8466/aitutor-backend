/**
 * Grading Routes
 * Endpoints for advanced grading system
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import { calculateSessionScore, getCategory, calculateTotalSATScore, calculateSatScore } from '../utils/scoreCalculator.js';
import { enqueueNotification, processOutboxOnce } from '../utils/notificationOutbox.js';
import notificationMiddleware from '../middleware/notificationMiddleware.js';

const router = express.Router();

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
            return res.status(401).json({ error: 'Unauthorized' });
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
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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
router.post('/submit-test', notificationMiddleware.triggerTestCompletionNotification, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, level, questionIds, answers, duration } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!courseId || !level || !questionIds || !answers) {
            return res.status(400).json({ error: 'Missing required fields' });
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
                    passed: (result.raw_percentage >= 40),
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
            await notificationMiddleware.scheduler.triggerTestCompletionNotification(result.submission_id, userId);
        } catch (noteError) {
            console.error('⚠️ [Trigger] Failed to enqueue notification:', noteError.message);
        }

        res.json({
            submissionId: result.submission_id,
            rawScore: result.raw_score,
            rawPercentage: result.raw_percentage,
            scaledScore: result.scaled_score,
            sectionScores: result.section_scores
        });

    } catch (error) {
        console.error('Submit test error:', error);
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
            return res.status(500).json({ error: 'Submission not found' });
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

            const isAdmin = profile?.role === 'admin';
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

        const sid = parseInt(submissionId);
        console.log(`🔍 [GRADING] Fetching incorrect responses for submission: ${sid}`);

        // 1. Try to fetch from test_responses (new system)
        const { data: responses, error: responsesError } = await supabase
            .from('test_responses')
            .select(`
                selected_answer,
                is_correct,
                question:questions(id, question, correct_answer, explanation, topic)
            `)
            .eq('submission_id', sid);

        submission.incorrect_responses = [];
        submission.correct_responses = [];

        if (!responsesError && responses && responses.length > 0) {
            console.log(`✅ [GRADING] Found ${responses.length} total responses in test_responses for submission ${sid}`);

            submission.incorrect_responses = responses
                .filter(r => !r.is_correct)
                .map(r => ({
                    selected_answer: r.selected_answer,
                    question_text: r.question?.question,
                    correct_answer: r.question?.correct_answer,
                    explanation: r.question?.explanation,
                    subject: r.question?.topic,
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
                    subject: r.question?.topic,
                    topic: r.question?.topic,
                    question: r.question // Keep full question object for frontend
                }));
        } else if (responsesError) {
            console.error(`❌ [GRADING] Error fetching responses for sub ${sid}:`, responsesError);
        }


        // 2. Supplement/Fallback: If any responses are missing, fetch from questions table
        const missingIncorrect = (submission.incorrect_questions?.length || 0) > submission.incorrect_responses.length;
        const missingCorrect = (submission.correct_questions?.length || 0) > submission.correct_responses.length;

        if (missingIncorrect || missingCorrect) {
            console.log(`⚠️ [GRADING] Supplementing missing responses from questions table. Missing incorrect: ${missingIncorrect}, Missing correct: ${missingCorrect}`);

            if (missingIncorrect) {
                const existingIds = responses?.filter(r => !r.is_correct).map(r => r.question.id) || [];
                const missingIds = (submission.incorrect_questions || []).filter(id => !existingIds.includes(parseInt(id)));

                if (missingIds.length > 0) {
                    const { data: fallback } = await supabase
                        .from('questions')
                        .select('id, question, correct_answer, explanation, topic')
                        .in('id', missingIds);

                    if (fallback) {
                        submission.incorrect_responses = [
                            ...submission.incorrect_responses,
                            ...fallback.map(q => ({
                                selected_answer: 'Not recorded',
                                question_text: q.question,
                                correct_answer: q.correct_answer,
                                explanation: q.explanation,
                                subject: q.topic
                            }))
                        ];
                    }
                }
            }

            if (missingCorrect) {
                const existingIds = responses?.filter(r => r.is_correct).map(r => r.question.id) || [];
                const missingIds = (submission.correct_questions || []).filter(id => !existingIds.includes(parseInt(id)));

                if (missingIds.length > 0) {
                    const { data: fallback } = await supabase
                        .from('questions')
                        .select('id, question, correct_answer, explanation, topic')
                        .in('id', missingIds);

                    if (fallback) {
                        submission.correct_responses = [
                            ...submission.correct_responses,
                            ...fallback.map(q => ({
                                selected_answer: q.correct_answer, // Since it's correct, selected must be correct_answer
                                question_text: q.question,
                                correct_answer: q.correct_answer,
                                explanation: q.explanation,
                                subject: q.topic
                            }))
                        ];
                    }
                }
            }
        }

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
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: submissions, error } = await supabase
            .from('test_submissions')
            .select('*, courses(*)')
            .eq('user_id', userId)
            .order('test_date', { ascending: false });

        if (error) {
            console.error('Error fetching all scores:', error);
            return res.status(500).json({ error: 'Failed to fetch scores' });
        }

        res.json({ submissions: submissions || [] });

    } catch (error) {
        console.error('Get all scores error:', error);
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

        if (!profile || profile.role !== 'admin') {
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

        // 2. Fetch ALL progress for this course
        const { data: allProgress, error: progressError } = await supabase
            .from('student_progress')
            .select(`
                user_id,
                score,
                level,
                profiles!user_id(id, name)
            `)
            .eq('course_id', courseId);

        if (progressError) {
            console.error('Leaderboard fetch error:', progressError);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }

        // 3. Group by user and calculate WEIGHTED aggregate score
        const studentMap = new Map();
        allProgress.forEach(p => {
            const userId = p.user_id;
            const level = p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase() : 'Medium';
            
            if (!studentMap.has(userId)) {
                studentMap.set(userId, {
                    user_id: userId,
                    name: p.profiles?.name || 'Anonymous Student',
                    accuracies: { Easy: 0, Medium: 0, Hard: 0 },
                    levels_completed: 0
                });
            }
            
            const existing = studentMap.get(userId);
            if (p.score > existing.accuracies[level]) {
                existing.accuracies[level] = p.score;
                existing.levels_completed++;
            }
        });

        // Calculate final weighted score for each student using SAT-style formula
        const allRankings = Array.from(studentMap.values()).map(s => {
            const weightedScore = calculateSatScore(s.accuracies.Easy, s.accuracies.Medium, s.accuracies.Hard);
            return {
                user_id: s.user_id,
                name: s.name,
                score: weightedScore,
                levels_completed: s.levels_completed
            };
        }).sort((a, b) => b.score - a.score);

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

        // 1. Fetch all students' progress and course info
        const { data: allProgress, error } = await supabase
            .from('student_progress')
            .select(`
                user_id,
                score,
                level,
                courses(name, tutor_type),
                profiles!user_id(id, name)
            `)
            .eq('profiles.role', 'student');

        if (error) {
            console.error('Global leaderboard fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch global rankings' });
        }

        // 2. Group by user
        const userGroups = {};
        allProgress.forEach(p => {
            const uid = p.user_id;
            if (!userGroups[uid]) {
                userGroups[uid] = {
                    user_id: uid,
                    name: p.profiles?.name || 'Anonymous Student',
                    entries: []
                };
            }
            userGroups[uid].entries.push(p);
        });

        // 3. Calculate scores for each user
        const allRankings = Object.values(userGroups).map(u => {
            const scores = calculateTotalSATScore(u.entries);
            return {
                user_id: u.user_id,
                name: u.name,
                total_points: scores.total, // frontend expects total_points
                scoreDisplay: `${scores.total}`,
                levels_completed: u.entries.length
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



export default router;

