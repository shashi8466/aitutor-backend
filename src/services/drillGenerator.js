/**
 * Drill Generation Service
 * Generates personalized practice drills based on weakness analysis
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: false
    }
});

class DrillGeneratorService {
    constructor() {
        this.drillConfigurations = {
            topicDrill: {
                questionCount: 10,
                timeLimit: 15, // minutes
                difficultyMix: [0.2, 0.6, 0.2] // easy, medium, hard
            },
            difficultyDrill: {
                questionCount: 12,
                timeLimit: 20,
                targetDifficulty: 'medium'
            },
            conceptReview: {
                questionCount: 8,
                timeLimit: 12,
                difficultyMix: [0.3, 0.5, 0.2]
            },
            comprehensiveDrill: {
                questionCount: 15,
                timeLimit: 25,
                difficultyMix: [0.25, 0.5, 0.25]
            }
        };
    }

    /**
     * Generate personalized drill based on weakness analysis
     */
    async generateDrill(weaknessAnalysis, userId, courseId) {
        console.log(`🔧 [Drill] Generating drill for user ${userId} based on ${weaknessAnalysis.weaknesses.length} weaknesses`);

        const primaryWeakness = weaknessAnalysis.weaknesses[0]; // Most severe weakness
        if (!primaryWeakness) {
            return this.generateGeneralDrill(weaknessAnalysis, userId, courseId);
        }

        let drill;
        
        switch (primaryWeakness.type) {
            case 'topic':
                drill = await this.generateTopicDrill(primaryWeakness, weaknessAnalysis, userId, courseId);
                break;
            case 'difficulty':
                drill = await this.generateDifficultyDrill(primaryWeakness, weaknessAnalysis, userId, courseId);
                break;
            case 'concept':
                drill = await this.generateConceptDrill(primaryWeakness, weaknessAnalysis, userId, courseId);
                break;
            case 'timing':
                drill = await this.generatePaceDrill(primaryWeakness, weaknessAnalysis, userId, courseId);
                break;
            default:
                drill = await this.generateGeneralDrill(weaknessAnalysis, userId, courseId);
        }

        // Save the drill to database
        if (drill) {
            await this.saveDrill(drill, userId, courseId, weaknessAnalysis.submissionId);
        }

        return drill;
    }

    /**
     * Generate topic-specific drill
     */
    async generateTopicDrill(weakness, analysis, userId, courseId) {
        const topic = weakness.topic;
        const config = this.drillConfigurations.topicDrill;

        console.log(`🎯 [Drill] Generating topic drill for: ${topic}`);

        // Fetch questions for the specific topic
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('course_id', courseId)
            .eq('topic', topic)
            .neq('id', analysis.submissionId) // Avoid recently seen questions
            .limit(config.questionCount * 2); // Get extra for selection

        if (error || !questions || questions.length === 0) {
            console.warn(`⚠️ [Drill] No questions found for topic: ${topic}`);
            return null;
        }

        // Select questions with appropriate difficulty mix
        const selectedQuestions = this.selectQuestionsByDifficulty(questions, config.difficultyMix, config.questionCount);

        return {
            type: 'topic_drill',
            title: `${topic} Practice Drill`,
            subtitle: `Focus on improving ${topic} accuracy`,
            targetTopic: topic,
            targetDifficulty: 'mixed',
            questions: selectedQuestions,
            timeLimit: config.timeLimit,
            estimatedTime: `${config.timeLimit} minutes`,
            difficulty: 'adaptive',
            questionCount: selectedQuestions.length,
            purpose: `Improve accuracy in ${topic} (current: ${weakness.accuracy}%)`,
            recommendations: [
                'Take your time to understand each question',
                'Review explanations for incorrect answers',
                'Focus on the specific concepts tested'
            ],
            metadata: {
                basedOnWeakness: weakness,
                originalAccuracy: weakness.accuracy,
                targetAccuracy: Math.min(95, weakness.accuracy + 20)
            }
        };
    }

    /**
     * Generate difficulty-specific drill
     */
    async generateDifficultyDrill(weakness, analysis, userId, courseId) {
        const difficulty = weakness.difficulty;
        const config = this.drillConfigurations.difficultyDrill;

        console.log(`🎯 [Drill] Generating difficulty drill for: ${difficulty}`);

        // Fetch questions for the specific difficulty
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('course_id', courseId)
            .eq('difficulty', difficulty)
            .neq('id', analysis.submissionId)
            .limit(config.questionCount * 2);

        if (error || !questions || questions.length === 0) {
            console.warn(`⚠️ [Drill] No questions found for difficulty: ${difficulty}`);
            return null;
        }

        // Select questions (all same difficulty)
        const selectedQuestions = questions.slice(0, config.questionCount);

        return {
            type: 'difficulty_drill',
            title: `${difficulty} Questions Practice`,
            subtitle: `Build confidence with ${difficulty} problems`,
            targetTopic: 'mixed',
            targetDifficulty: difficulty,
            questions: selectedQuestions,
            timeLimit: config.timeLimit,
            estimatedTime: `${config.timeLimit} minutes`,
            difficulty: difficulty,
            questionCount: selectedQuestions.length,
            purpose: `Master ${difficulty} questions (current: ${weakness.accuracy}% accuracy)`,
            recommendations: [
                difficulty === 'Easy' ? 'Focus on speed and accuracy' :
                difficulty === 'Medium' ? 'Take time to think through each step' :
                'Break down complex problems into smaller parts',
                'Review each answer choice carefully',
                'Use process of elimination when stuck'
            ],
            metadata: {
                basedOnWeakness: weakness,
                originalAccuracy: weakness.accuracy,
                targetAccuracy: Math.min(90, weakness.accuracy + 15)
            }
        };
    }

    /**
     * Generate concept-specific drill
     */
    async generateConceptDrill(weakness, analysis, userId, courseId) {
        const concept = weakness.concept;
        const config = this.drillConfigurations.conceptReview;

        console.log(`🎯 [Drill] Generating concept drill for: ${concept}`);

        // Fetch questions related to the concept (using topic as proxy)
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('course_id', courseId)
            .eq('topic', concept)
            .neq('id', analysis.submissionId)
            .limit(config.questionCount * 2);

        if (error || !questions || questions.length === 0) {
            console.warn(`⚠️ [Drill] No questions found for concept: ${concept}`);
            return null;
        }

        // Select questions with easier difficulty for concept review
        const selectedQuestions = this.selectQuestionsByDifficulty(questions, config.difficultyMix, config.questionCount);

        return {
            type: 'concept_review',
            title: `${concept} Concept Review`,
            subtitle: `Strengthen understanding of ${concept}`,
            targetTopic: concept,
            targetDifficulty: 'mixed',
            questions: selectedQuestions,
            timeLimit: config.timeLimit,
            estimatedTime: `${config.timeLimit} minutes`,
            difficulty: 'adaptive',
            questionCount: selectedQuestions.length,
            purpose: `Master ${concept} concepts (${weakness.mistakeCount} previous mistakes)`,
            recommendations: [
                'Study the concept before attempting questions',
                'Focus on understanding the underlying principles',
                'Review explanations for similar question types',
                'Practice with easier questions first'
            ],
            metadata: {
                basedOnWeakness: weakness,
                mistakeCount: weakness.mistakeCount,
                examples: weakness.examples,
                targetAccuracy: 85
            }
        };
    }

    /**
     * Generate pace/timing drill
     */
    async generatePaceDrill(weakness, analysis, userId, courseId) {
        const config = this.drillConfigurations.comprehensiveDrill;

        console.log(`🎯 [Drill] Generating pace drill for: ${weakness.pattern}`);

        // Fetch mixed difficulty questions
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('course_id', courseId)
            .neq('id', analysis.submissionId)
            .limit(config.questionCount * 2);

        if (error || !questions || questions.length === 0) {
            console.warn(`⚠️ [Drill] No questions found for pace drill`);
            return null;
        }

        const selectedQuestions = this.selectQuestionsByDifficulty(questions, config.difficultyMix, config.questionCount);

        const timePerQuestion = weakness.pattern === 'slow_incorrect' ? 90 : 45; // seconds

        return {
            type: 'pace_drill',
            title: 'Pace & Timing Practice',
            subtitle: weakness.pattern === 'slow_incorrect' ? 'Practice moving on from difficult questions' : 'Practice careful, deliberate answering',
            targetTopic: 'mixed',
            targetDifficulty: 'mixed',
            questions: selectedQuestions,
            timeLimit: config.timeLimit,
            timePerQuestion: timePerQuestion,
            estimatedTime: `${config.timeLimit} minutes`,
            difficulty: 'adaptive',
            questionCount: selectedQuestions.length,
            purpose: 'Improve timing and pacing strategy',
            recommendations: weakness.pattern === 'slow_incorrect' ? [
                'Set a timer for each question',
                'If stuck after 60 seconds, make your best guess and move on',
                'Remember that all questions are worth the same points',
                'Practice recognizing when you\'re spending too much time'
            ] : [
                'Take at least 30 seconds per question',
                'Read each question and answer choice carefully',
                'Double-check your work before submitting',
                'Practice working through problems methodically'
            ],
            metadata: {
                basedOnWeakness: weakness,
                pattern: weakness.pattern,
                targetPace: timePerQuestion
            }
        };
    }

    /**
     * Generate general drill when no specific weaknesses
     */
    async generateGeneralDrill(analysis, userId, courseId) {
        const config = this.drillConfigurations.comprehensiveDrill;

        console.log(`🎯 [Drill] Generating general practice drill`);

        // Fetch mixed questions
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('course_id', courseId)
            .neq('id', analysis.submissionId)
            .limit(config.questionCount * 2);

        if (error || !questions || questions.length === 0) {
            console.warn(`⚠️ [Drill] No questions found for general drill`);
            return null;
        }

        const selectedQuestions = this.selectQuestionsByDifficulty(questions, config.difficultyMix, config.questionCount);

        return {
            type: 'general_practice',
            title: 'General Practice Drill',
            subtitle: 'Comprehensive practice across all topics',
            targetTopic: 'mixed',
            targetDifficulty: 'mixed',
            questions: selectedQuestions,
            timeLimit: config.timeLimit,
            estimatedTime: `${config.timeLimit} minutes`,
            difficulty: 'adaptive',
            questionCount: selectedQuestions.length,
            purpose: 'Maintain and improve overall performance',
            recommendations: [
                'Focus on accuracy first, then speed',
                'Review explanations for any incorrect answers',
                'Practice time management',
                'Identify any patterns in your mistakes'
            ],
            metadata: {
                basedOnAnalysis: analysis,
                overallAccuracy: analysis.overallScore.accuracy
            }
        };
    }

    /**
     * Select questions with specific difficulty distribution
     */
    selectQuestionsByDifficulty(questions, difficultyMix, targetCount) {
        const easy = questions.filter(q => q.difficulty === 'Easy');
        const medium = questions.filter(q => q.difficulty === 'Medium');
        const hard = questions.filter(q => q.difficulty === 'Hard');

        const [easyRatio, mediumRatio, hardRatio] = difficultyMix;
        const easyCount = Math.floor(targetCount * easyRatio);
        const mediumCount = Math.floor(targetCount * mediumRatio);
        const hardCount = targetCount - easyCount - mediumCount;

        const selected = [
            ...this.shuffleArray(easy).slice(0, easyCount),
            ...this.shuffleArray(medium).slice(0, mediumCount),
            ...this.shuffleArray(hard).slice(0, hardCount)
        ];

        // If we don't have enough, fill with remaining questions
        if (selected.length < targetCount) {
            const remaining = questions.filter(q => !selected.includes(q));
            selected.push(...remaining.slice(0, targetCount - selected.length));
        }

        return this.shuffleArray(selected.slice(0, targetCount));
    }

    /**
     * Shuffle array randomly
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Save generated drill to database
     */
    async saveDrill(drill, userId, courseId, submissionId) {
        try {
            const { data, error } = await supabase
                .from('weakness_drills')
                .insert({
                    user_id: userId,
                    course_id: courseId,
                    submission_id: submissionId,
                    drill_type: drill.type,
                    title: drill.title,
                    subtitle: drill.subtitle,
                    target_topic: drill.targetTopic,
                    target_difficulty: drill.targetDifficulty,
                    questions: drill.questions.map(q => q.id),
                    time_limit: drill.timeLimit,
                    time_per_question: drill.timePerQuestion || null,
                    difficulty: drill.difficulty,
                    question_count: drill.questionCount,
                    purpose: drill.purpose,
                    recommendations: drill.recommendations,
                    metadata: drill.metadata,
                    is_completed: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('❌ [Drill] Failed to save drill:', error);
                return null;
            }

            drill.id = data.id;
            console.log(`✅ [Drill] Saved drill with ID: ${data.id}`);
            return data;
        } catch (error) {
            console.error('❌ [Drill] Error saving drill:', error);
            return null;
        }
    }

    /**
     * Get user's weakness drills
     */
    async getUserDrills(userId, limit = 10) {
        try {
            const { data, error } = await supabase
                .from('weakness_drills')
                .select('*')
                .eq('user_id', userId)
                .eq('is_completed', false)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ [Drill] Failed to fetch user drills:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ [Drill] Error fetching user drills:', error);
            return [];
        }
    }

    /**
     * Get drill details with full question data
     */
    async getDrillDetails(drillId) {
        try {
            // Get drill info
            const { data: drill, error: drillError } = await supabase
                .from('weakness_drills')
                .select('*')
                .eq('id', drillId)
                .single();

            if (drillError || !drill) {
                console.error('❌ [Drill] Failed to fetch drill:', drillError);
                return null;
            }

            // Get question details
            const { data: questions, error: questionError } = await supabase
                .from('questions')
                .select('*')
                .in('id', drill.questions);

            if (questionError) {
                console.error('❌ [Drill] Failed to fetch drill questions:', questionError);
                return null;
            }

            return {
                ...drill,
                questions: questions || []
            };
        } catch (error) {
            console.error('❌ [Drill] Error fetching drill details:', error);
            return null;
        }
    }

    /**
     * Mark drill as completed
     */
    async completeDrill(drillId, score, timeSpent, responses) {
        try {
            const { error } = await supabase
                .from('weakness_drills')
                .update({
                    is_completed: true,
                    completed_at: new Date().toISOString(),
                    score: score,
                    time_spent: timeSpent,
                    responses: responses
                })
                .eq('id', drillId);

            if (error) {
                console.error('❌ [Drill] Failed to complete drill:', error);
                return false;
            }

            console.log(`✅ [Drill] Completed drill: ${drillId}`);
            return true;
        } catch (error) {
            console.error('❌ [Drill] Error completing drill:', error);
            return false;
        }
    }
}

export default new DrillGeneratorService();
