/**
 * Weakness Analysis Service
 * Analyzes student performance across all test types to identify weaknesses and generate personalized drills
 */

class WeaknessAnalysisService {
    constructor() {
        this.weaknessThresholds = {
            topicAccuracy: 60, // Below 60% accuracy in a topic
            difficultyStruggle: 50, // Below 50% accuracy in a difficulty level
            repeatedMistakes: 3, // 3+ mistakes in same concept
            slowIncorrectThreshold: 30, // Taking too long on incorrect answers (seconds)
            fastIncorrectThreshold: 5 // Rushing incorrect answers (seconds)
        };
    }

    /**
     * Analyze student performance from test submission data
     */
    async analyzePerformance(submission, responses = []) {
        console.log(`🔍 [Weakness] Analyzing performance for submission ${submission.id}`);
        
        const analysis = {
            submissionId: submission.id,
            userId: submission.user_id,
            courseId: submission.course_id,
            testType: this.getTestType(submission),
            overallScore: {
                accuracy: submission.raw_score_percentage || 0,
                scaledScore: submission.scaled_score || 0,
                totalQuestions: submission.total_questions || 0,
                correctAnswers: submission.raw_score || 0
            },
            weaknesses: [],
            strengths: [],
            patterns: [],
            recommendations: []
        };

        // Analyze responses if available
        if (responses.length > 0) {
            analysis.topicPerformance = this.analyzeTopicPerformance(responses);
            analysis.difficultyPerformance = this.analyzeDifficultyPerformance(responses);
            analysis.timingPatterns = this.analyzeTimingPatterns(responses);
            analysis.conceptMistakes = this.analyzeConceptMistakes(responses);
            
            // Identify weaknesses
            analysis.weaknesses = this.identifyWeaknesses(analysis);
            analysis.strengths = this.identifyStrengths(analysis);
            analysis.patterns = this.identifyPatterns(analysis);
            analysis.recommendations = this.generateRecommendations(analysis);
        } else {
            // Fallback analysis for score-only submissions
            analysis.weaknesses = this.generateScoreBasedWeaknesses(analysis.overallScore);
            analysis.recommendations = this.generateScoreBasedRecommendations(analysis.overallScore);
        }

        console.log(`✅ [Weakness] Analysis complete. Found ${analysis.weaknesses.length} weaknesses`);
        return analysis;
    }

    /**
     * Analyze global performance across all tests for a user
     */
    async analyzeGlobalPerformance(userId, supabase) {
        console.log(`🌐 [Weakness] Performing global analysis for user ${userId}`);

        // 1. Fetch all submissions to get the big picture
        const { data: submissions, error: subError } = await supabase
            .from('test_submissions')
            .select('*, courses(id, name, tutor_type)')
            .eq('user_id', userId)
            .eq('is_completed', true)
            .order('test_date', { ascending: false });

        if (subError || !submissions || submissions.length === 0) {
            console.warn('⚠️ [Weakness] No submissions found for global analysis');
            return null;
        }

        // 2. Fetch all detailed responses across all submissions
        // This is where the real pattern detection happens
        const { data: allResponses, error: respError } = await supabase
            .from('test_responses')
            .select(`
                selected_answer,
                is_correct,
                time_spent,
                question:questions(id, question, correct_answer, explanation, topic, section, difficulty, concept)
            `)
            .in('submission_id', submissions.map(s => s.id));

        if (respError || !allResponses || allResponses.length === 0) {
            console.warn('⚠️ [Weakness] No detailed responses found for global analysis');
            return null;
        }

        const analysis = {
            userId,
            totalSubmissions: submissions.length,
            totalQuestions: allResponses.length,
            averageAccuracy: Math.round((allResponses.filter(r => r.is_correct).length / allResponses.length) * 100),
            testTypes: [...new Set(submissions.map(s => this.getTestType(s)))],
            weaknesses: [],
            strengths: [],
            patterns: [],
            recommendations: []
        };

        // Perform multi-test analysis
        analysis.topicPerformance = this.analyzeTopicPerformance(allResponses);
        analysis.difficultyPerformance = this.analyzeDifficultyPerformance(allResponses);
        analysis.timingPatterns = this.analyzeTimingPatterns(allResponses);
        analysis.conceptMistakes = this.analyzeConceptMistakes(allResponses);

        // Enhanced identification logic for global patterns
        analysis.weaknesses = this.identifyWeaknesses(analysis);
        analysis.strengths = this.identifyStrengths(analysis);
        analysis.patterns = this.identifyPatterns(analysis);
        analysis.recommendations = this.generateRecommendations(analysis);

        // Add special global insights
        if (submissions.length > 3) {
            const recentSubmissions = submissions.slice(0, 3);
            const olderSubmissions = submissions.slice(3);
            
            if (olderSubmissions.length > 0) {
                const recentAccuracy = Math.round((recentSubmissions.reduce((acc, s) => acc + (s.raw_score_percentage || 0), 0)) / recentSubmissions.length);
                const olderAccuracy = Math.round((olderSubmissions.reduce((acc, s) => acc + (s.raw_score_percentage || 0), 0)) / olderSubmissions.length);
                
                analysis.trend = recentAccuracy >= olderAccuracy ? 'improving' : 'declining';
            }
        }

        return analysis;
    }

    /**
     * Get test type from submission data
     */
    getTestType(submission) {
        if (submission.course?.tutor_type === 'Full-Length SAT Test') return 'Full Length SAT';
        if (submission.level === 'Adaptive') return 'Adaptive Test';
        if (submission.level === 'Practice') return 'Practice Test';
        return submission.level || 'Unknown';
    }

    /**
     * Analyze performance by topic
     */
    analyzeTopicPerformance(responses) {
        const topicStats = {};
        
        responses.forEach(response => {
            const topic = response.topic || response.question?.topic || 'Unknown';
            const isCorrect = response.is_correct;
            
            if (!topicStats[topic]) {
                topicStats[topic] = {
                    topic,
                    total: 0,
                    correct: 0,
                    incorrect: 0,
                    accuracy: 0,
                    questions: []
                };
            }
            
            topicStats[topic].total++;
            topicStats[topic].questions.push({
                questionId: response.question?.id,
                isCorrect,
                timeSpent: response.time_spent,
                difficulty: response.difficulty || response.question?.difficulty
            });
            
            if (isCorrect) {
                topicStats[topic].correct++;
            } else {
                topicStats[topic].incorrect++;
            }
        });

        // Calculate accuracy for each topic
        Object.values(topicStats).forEach(stat => {
            stat.accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        });

        return Object.values(topicStats).sort((a, b) => a.accuracy - b.accuracy);
    }

    /**
     * Analyze performance by difficulty level
     */
    analyzeDifficultyPerformance(responses) {
        const difficultyStats = {};
        
        responses.forEach(response => {
            const difficulty = response.difficulty || response.question?.difficulty || 'Medium';
            const isCorrect = response.is_correct;
            
            if (!difficultyStats[difficulty]) {
                difficultyStats[difficulty] = {
                    difficulty,
                    total: 0,
                    correct: 0,
                    incorrect: 0,
                    accuracy: 0,
                    avgTimeSpent: 0,
                    totalTimeSpent: 0
                };
            }
            
            difficultyStats[difficulty].total++;
            difficultyStats[difficulty].totalTimeSpent += response.time_spent || 0;
            
            if (isCorrect) {
                difficultyStats[difficulty].correct++;
            } else {
                difficultyStats[difficulty].incorrect++;
            }
        });

        // Calculate accuracy and average time
        Object.values(difficultyStats).forEach(stat => {
            stat.accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
            stat.avgTimeSpent = stat.total > 0 ? Math.round(stat.totalTimeSpent / stat.total) : 0;
        });

        return Object.values(difficultyStats);
    }

    /**
     * Analyze timing patterns
     */
    analyzeTimingPatterns(responses) {
        const timingPatterns = {
            slowIncorrect: [],
            fastIncorrect: [],
            slowCorrect: [],
            fastCorrect: [],
            avgTimePerQuestion: 0
        };

        let totalTime = 0;
        let responseCount = 0;

        responses.forEach(response => {
            const timeSpent = response.time_spent || 0;
            const isCorrect = response.is_correct;
            
            if (timeSpent > 0) {
                totalTime += timeSpent;
                responseCount++;

                if (isCorrect) {
                    if (timeSpent > 30) timingPatterns.slowCorrect.push(response);
                    else if (timeSpent < 5) timingPatterns.fastCorrect.push(response);
                } else {
                    if (timeSpent > 30) timingPatterns.slowIncorrect.push(response);
                    else if (timeSpent < 5) timingPatterns.fastIncorrect.push(response);
                }
            }
        });

        timingPatterns.avgTimePerQuestion = responseCount > 0 ? Math.round(totalTime / responseCount) : 0;

        return timingPatterns;
    }

    /**
     * Analyze concept mistakes and repeated patterns
     */
    analyzeConceptMistakes(responses) {
        const conceptMistakes = {};
        const incorrectResponses = responses.filter(r => !r.is_correct);
        
        incorrectResponses.forEach(response => {
            const concept = response.concept || response.question?.concept || response.topic || 'Unknown';
            const questionId = response.question?.id;
            
            if (!conceptMistakes[concept]) {
                conceptMistakes[concept] = {
                    concept,
                    mistakeCount: 0,
                    questionIds: [],
                    examples: []
                };
            }
            
            conceptMistakes[concept].mistakeCount++;
            if (questionId) conceptMistakes[concept].questionIds.push(questionId);
            
            // Store example question (limit to 3 per concept)
            if (conceptMistakes[concept].examples.length < 3) {
                conceptMistakes[concept].examples.push({
                    questionId,
                    questionText: response.question_text || response.question?.question,
                    selectedAnswer: response.selected_answer,
                    correctAnswer: response.correct_answer || response.question?.correct_answer
                });
            }
        });

        return Object.values(conceptMistakes).sort((a, b) => b.mistakeCount - a.mistakeCount);
    }

    /**
     * Identify specific weaknesses from analysis
     */
    identifyWeaknesses(analysis) {
        const weaknesses = [];

        // Topic weaknesses
        if (analysis.topicPerformance) {
            analysis.topicPerformance.forEach(topic => {
                if (topic.accuracy < this.weaknessThresholds.topicAccuracy && topic.total >= 3) {
                    weaknesses.push({
                        type: 'topic',
                        severity: topic.accuracy < 40 ? 'high' : 'medium',
                        topic: topic.topic,
                        accuracy: topic.accuracy,
                        totalQuestions: topic.total,
                        description: `Low accuracy (${topic.accuracy}%) in ${topic.topic}`
                    });
                }
            });
        }

        // Difficulty weaknesses
        if (analysis.difficultyPerformance) {
            analysis.difficultyPerformance.forEach(difficulty => {
                if (difficulty.accuracy < this.weaknessThresholds.difficultyStruggle && difficulty.total >= 3) {
                    weaknesses.push({
                        type: 'difficulty',
                        severity: difficulty.accuracy < 30 ? 'high' : 'medium',
                        difficulty: difficulty.difficulty,
                        accuracy: difficulty.accuracy,
                        totalQuestions: difficulty.total,
                        description: `Struggles with ${difficulty.difficulty} questions (${difficulty.accuracy}% accuracy)`
                    });
                }
            });
        }

        // Timing weaknesses
        if (analysis.timingPatterns) {
            if (analysis.timingPatterns.slowIncorrect.length >= 3) {
                weaknesses.push({
                    type: 'timing',
                    severity: 'medium',
                    pattern: 'slow_incorrect',
                    count: analysis.timingPatterns.slowIncorrect.length,
                    description: `Takes too long on incorrect answers (${analysis.timingPatterns.slowIncorrect.length} cases)`
                });
            }

            if (analysis.timingPatterns.fastIncorrect.length >= 3) {
                weaknesses.push({
                    type: 'timing',
                    severity: 'medium',
                    pattern: 'fast_incorrect',
                    count: analysis.timingPatterns.fastIncorrect.length,
                    description: `Rushes through questions (${analysis.timingPatterns.fastIncorrect.length} incorrect answers under 5 seconds)`
                });
            }
        }

        // Concept weaknesses
        if (analysis.conceptMistakes) {
            analysis.conceptMistakes.forEach(concept => {
                if (concept.mistakeCount >= this.weaknessThresholds.repeatedMistakes) {
                    weaknesses.push({
                        type: 'concept',
                        severity: concept.mistakeCount >= 5 ? 'high' : 'medium',
                        concept: concept.concept,
                        mistakeCount: concept.mistakeCount,
                        examples: concept.examples,
                        description: `Repeated mistakes in ${concept.concept} (${concept.mistakeCount} mistakes)`
                    });
                }
            });
        }

        return weaknesses.sort((a, b) => {
            const severityOrder = { high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    /**
     * Identify strengths from analysis
     */
    identifyStrengths(analysis) {
        const strengths = [];

        // Topic strengths
        if (analysis.topicPerformance) {
            analysis.topicPerformance.forEach(topic => {
                if (topic.accuracy >= 80 && topic.total >= 3) {
                    strengths.push({
                        type: 'topic',
                        topic: topic.topic,
                        accuracy: topic.accuracy,
                        totalQuestions: topic.total,
                        description: `Strong performance in ${topic.topic} (${topic.accuracy}% accuracy)`
                    });
                }
            });
        }

        // Difficulty strengths
        if (analysis.difficultyPerformance) {
            analysis.difficultyPerformance.forEach(difficulty => {
                if (difficulty.accuracy >= 75 && difficulty.total >= 3) {
                    strengths.push({
                        type: 'difficulty',
                        difficulty: difficulty.difficulty,
                        accuracy: difficulty.accuracy,
                        totalQuestions: difficulty.total,
                        description: `Handles ${difficulty.difficulty} questions well (${difficulty.accuracy}% accuracy)`
                    });
                }
            });
        }

        return strengths;
    }

    /**
     * Identify learning patterns
     */
    identifyPatterns(analysis) {
        const patterns = [];

        if (analysis.timingPatterns) {
            if (analysis.timingPatterns.avgTimePerQuestion > 45) {
                patterns.push({
                    type: 'pace',
                    description: 'Takes longer than average on questions',
                    recommendation: 'Practice time management and quicker decision making'
                });
            }

            if (analysis.timingPatterns.avgTimePerQuestion < 10) {
                patterns.push({
                    type: 'pace',
                    description: 'Answers questions very quickly',
                    recommendation: 'Consider taking more time to avoid careless mistakes'
                });
            }
        }

        return patterns;
    }

    /**
     * Generate personalized recommendations
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        analysis.weaknesses.forEach(weakness => {
            switch (weakness.type) {
                case 'topic':
                    recommendations.push({
                        type: 'drill',
                        priority: weakness.severity === 'high' ? 'urgent' : 'normal',
                        topic: weakness.topic,
                        difficulty: 'mixed',
                        description: `Practice ${weakness.topic} questions to improve accuracy`,
                        estimatedTime: '15-20 minutes'
                    });
                    break;
                case 'difficulty':
                    recommendations.push({
                        type: 'drill',
                        priority: weakness.severity === 'high' ? 'urgent' : 'normal',
                        topic: 'mixed',
                        difficulty: weakness.difficulty,
                        description: `Focus on ${weakness.difficulty} questions to build confidence`,
                        estimatedTime: '20-25 minutes'
                    });
                    break;
                case 'concept':
                    recommendations.push({
                        type: 'review',
                        priority: weakness.severity === 'high' ? 'urgent' : 'normal',
                        concept: weakness.concept,
                        description: `Review ${weakness.concept} concepts and practice related questions`,
                        estimatedTime: '25-30 minutes'
                    });
                    break;
                case 'timing':
                    recommendations.push({
                        type: 'strategy',
                        priority: 'normal',
                        description: weakness.pattern === 'slow_incorrect' 
                            ? 'Practice recognizing when to move on from difficult questions'
                            : 'Practice slowing down and reading questions carefully',
                        estimatedTime: '10-15 minutes'
                    });
                    break;
            }
        });

        return recommendations;
    }

    /**
     * Generate weaknesses for score-only submissions
     */
    generateScoreBasedWeaknesses(score) {
        const weaknesses = [];
        
        if (score.accuracy < 50) {
            weaknesses.push({
                type: 'overall',
                severity: 'high',
                description: `Low overall accuracy (${score.accuracy}%)`
            });
        } else if (score.accuracy < 70) {
            weaknesses.push({
                type: 'overall',
                severity: 'medium',
                description: `Room for improvement in accuracy (${score.accuracy}%)`
            });
        }

        if (score.scaledScore > 0 && score.scaledScore < 1000) {
            weaknesses.push({
                type: 'sat_score',
                severity: 'high',
                description: `SAT score needs improvement (${score.scaledScore})`
            });
        }

        return weaknesses;
    }

    /**
     * Generate recommendations for score-only submissions
     */
    generateScoreBasedRecommendations(score) {
        const recommendations = [];

        if (score.accuracy < 60) {
            recommendations.push({
                type: 'comprehensive',
                priority: 'urgent',
                description: 'Focus on fundamental concepts across all topics',
                estimatedTime: '30-45 minutes'
            });
        } else if (score.accuracy < 80) {
            recommendations.push({
                type: 'targeted',
                priority: 'normal',
                description: 'Practice mixed difficulty questions to improve consistency',
                estimatedTime: '20-30 minutes'
            });
        }

        return recommendations;
    }
}

export default new WeaknessAnalysisService();
