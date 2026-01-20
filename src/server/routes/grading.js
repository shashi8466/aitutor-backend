/**
 * Grading Routes
 * Endpoints for advanced grading system
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * POST /api/grading/submit-test
 * Submit and grade a test
 */
router.post('/submit-test', async (req, res) => {
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

        // Verify access (own submission, or admin, or tutor)
        if (submission.user_id !== userId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, assigned_courses, tutor_approved')
                .eq('id', userId)
                .single();

            const isAdmin = profile?.role === 'admin';
            const assigned = (profile?.assigned_courses || []).map(Number);
            const isTutorWithAccess = profile?.role === 'tutor' &&
                profile?.tutor_approved &&
                assigned.includes(Number(submission.course_id));

            if (!isAdmin && !isTutorWithAccess) {
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
                question:questions(question, correct_answer, explanation)
            `)
            .eq('submission_id', sid)
            .eq('is_correct', false);

        if (!responsesError && responses && responses.length > 0) {
            console.log(`✅ [GRADING] Found ${responses.length} detailed responses in test_responses for submission ${sid}`);
            submission.incorrect_responses = responses.map(r => ({
                selected_answer: r.selected_answer,
                question_text: r.question?.question,
                correct_answer: r.question?.correct_answer,
                explanation: r.question?.explanation
            }));
        } else {
            // 2. Fallback: If no responses found (older submission), fetch questions directly using incorrect_questions array
            console.log(`⚠️ [GRADING] No test_responses found for submission ${sid}. Falling back to questions table.`);
            const { data: fallbackQuestions, error: fallbackError } = await supabase
                .from('questions')
                .select('id, question, correct_answer, explanation')
                .in('id', submission.incorrect_questions || []);

            if (fallbackError) {
                console.error('❌ [GRADING] Fallback fetch failed:', fallbackError);
            } else {
                console.log(`✅ [GRADING] Fallback successful. Found ${fallbackQuestions?.length || 0} questions.`);
                // Note: We don't have the student's selected_answer in the fallback case (not stored separately before)
                submission.incorrect_responses = (fallbackQuestions || []).map(q => ({
                    selected_answer: 'Not recorded (Old Submission)',
                    question_text: q.question,
                    correct_answer: q.correct_answer,
                    explanation: q.explanation
                }));
            }
        }

        res.json({ submission });

    } catch (error) {
        console.error('Get submission error:', error);
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

export default router;
