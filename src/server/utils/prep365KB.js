// ============================================================
//  24/7 AI PREP365 KNOWLEDGE BASE SEARCH
//  Exact content retrieval without AI generation or rewriting
// ============================================================

import supabase from '../../supabase/supabaseAdmin.js';

// ============================================================
//  TOPIC MATCHING ENGINE
// ============================================================

/**
 * Matches user topic to KB file names and content exactly
 * Follows the rule: User topic must match KB file name or content
 * Example: "One-variable data Distributions" matches files with that exact topic
 */
const matchTopicToKB = async (userTopic) => {
    const topicLower = userTopic.toLowerCase().trim();
    
    try {
        // Step 1: Get all available topics from KB
        const { data: allTopics, error: topicsError } = await supabase
            .from('questions')
            .select('topic, source, level')
            .not('topic', 'is', null);
        
        if (topicsError || !allTopics || allTopics.length === 0) {
            console.log('❌ No topics found in Knowledge Base');
            return null;
        }

        // Step 2: Extract unique topics and sources
        const uniqueTopics = [...new Set(allTopics.map(item => item.topic))];
        const uniqueSources = [...new Set(allTopics.map(item => item.source))];

        console.log(`🔍 [KB Search] User Topic: "${userTopic}"`);
        console.log(`📚 [KB Search] Available Topics: ${uniqueTopics.slice(0, 10).join(', ')}...`);

        // Step 3: Exact matching algorithm
        let bestMatch = null;
        let bestScore = -1;

        // Rule 1: Exact topic match (highest priority) - Check for complete topic matches first
        for (const topic of uniqueTopics) {
            const topicLowerItem = topic.toLowerCase();
            const userTopicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
            
            // Check for exact match or if user topic is contained in KB topic
            if (topicLowerItem === topicLower || 
                topicLowerItem.includes(topicLower) || 
                topicLower.includes(topicLowerItem) ||
                // Check if all significant words from user topic are in KB topic
                userTopicWords.every(word => topicLowerItem.includes(word))) {
                const score = topicLowerItem === topicLower ? 100 : 90;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { type: 'topic', value: topic };
                }
            }
        }

        // Rule 2: Exact file name match (medium priority) - Only if no topic match found
        if (bestScore < 90) {
            for (const source of uniqueSources) {
                const sourceLower = source.toLowerCase();
                if (sourceLower.includes(topicLower) || topicLower.includes(sourceLower)) {
                    const score = Math.max(sourceLower.length, topicLower.length);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = { type: 'filename', value: source };
                    }
                }
            }
        }

        // Rule 3: Partial matching with word boundaries (medium priority)
        if (bestScore < 50) {
            const topicWords = topicLower.split(/\s+/);
            for (const topic of uniqueTopics) {
                const topicLowerItem = topic.toLowerCase();
                const topicWords = topicLowerItem.split(/\s+/);
                
                let matchCount = 0;
                for (const userWord of topicWords) {
                    if (topicWords.some(topicWord => 
                        topicWord.includes(userWord) || userWord.includes(topicWord)
                    )) {
                        matchCount++;
                    }
                }
                
                const score = (matchCount / Math.max(topicWords.length, topicWords.length)) * 50;
                if (score > bestScore && matchCount > 0) {
                    bestScore = score;
                    bestMatch = { type: 'partial', value: topic };
                }
            }
        }

        if (bestMatch) {
            console.log(`✅ [KB Match] Found: "${bestMatch.value}" (Type: ${bestMatch.type}, Score: ${bestScore})`);
            return bestMatch.value;
        }

        console.log(`❌ [KB Match] No match found for "${userTopic}"`);
        return null;

    } catch (error) {
        console.error('❌ [KB Match] Error:', error);
        return null;
    }
};

// ============================================================
//  DIFFICULTY FILTERING
// ============================================================

/**
 * Applies difficulty filtering according to the rules:
 * - Match: topic + difficulty (Easy/Medium/Hard)
 * - If level not specified → return mixed from same topic only
 */
const filterByDifficulty = async (topic, difficulty) => {
    try {
        let query = supabase
            .from('questions')
            .select('*')
            .eq('topic', topic);

        // Apply difficulty filter if specified
        if (difficulty && difficulty !== 'Mixed') {
            const diffCapitalized = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
            query = query.eq('level', diffCapitalized);
            console.log(`🎯 [KB Filter] Topic: "${topic}" | Difficulty: ${diffCapitalized}`);
        } else {
            console.log(`🎯 [KB Filter] Topic: "${topic}" | Difficulty: Mixed (all levels)`);
        }

        const { data: questions, error } = await query.orderBy('created_at', { ascending: false }).limit(50);

        if (error) {
            console.error('❌ [KB Filter] Database error:', error);
            return [];
        }

        console.log(`📊 [KB Filter] Found ${questions?.length || 0} questions from exact topic: "${topic}"`);
        return questions || [];

    } catch (error) {
        console.error('❌ [KB Filter] Error:', error);
        return [];
    }
};

// ============================================================
//  MAIN SEARCH FUNCTION
// ============================================================

/**
 * Main search function for 24/7 AI Prep365 Chat
 * Returns exact KB questions only - no AI generation
 */
export const searchExactKBQuestions = async (userTopic, difficulty = null, count = null) => {
    try {
        console.log(`🚀 [Prep365 KB] Search initiated for: "${userTopic}" | Difficulty: ${difficulty || 'Mixed'}`);

        // Step 1: Match topic to KB
        const matchedTopic = await matchTopicToKB(userTopic);
        console.log(`🎯 [Prep365 KB] Topic match result:`, matchedTopic);
        
        if (!matchedTopic) {
            console.log(`❌ [Prep365 KB] No topic match found for: "${userTopic}"`);
            return [];
        }

        // Step 2: Filter by difficulty with count limit
        const questions = await filterByDifficulty(matchedTopic, difficulty);

        // Step 3: Enforce question count limit
        const limitedQuestions = questions.slice(0, count || 5);

        // Step 4: Preserve exact content formatting
        const formattedQuestions = limitedQuestions.map(q => ({
            id: q.id,
            topic: q.topic,
            difficulty: q.level,
            text: q.text || q.question, // Exact text as stored
            options: q.options || [], // Exact options as stored
            correctAnswer: q.correct_answer, // Exact answer as stored
            explanation: q.explanation || '', // Exact explanation as stored
            source: q.source, // Source file name
            createdAt: q.created_at,
            // Preserve any additional formatting or metadata
            images: q.images || [],
            tables: q.tables || [],
            formulas: q.formulas || [],
            formatting: q.formatting || {}
        }));

        // Step 5: Validate strict KB compliance
        const validation = validateKBQuizCompliance(userTopic, difficulty, count, matchedTopic, limitedQuestions.length);
        
        if (!validation.isCompliant) {
            console.error('❌ [KB Compliance Violation]:', validation.violations.join(', '));
            return [];
        }

        if (validation.warnings.length > 0) {
            console.warn('⚠️ [KB Compliance Warnings]:', validation.warnings.join(', '));
        }

        console.log(`✅ [Prep365 KB] Successfully validated: Returning ${limitedQuestions.length} exact questions from: "${matchedTopic}"`);
        console.log(`🔒 [KB Compliance] Strict KB-only: No AI generation, no topic mixing, no content modification`);
        return formattedQuestions;

    } catch (error) {
        console.error('❌ [Prep365 KB] Search error:', error);
        return [];
    }
};

// ============================================================
//  TOPIC SUGGESTIONS
// ============================================================

/**
 * Get available topics for user suggestions
 */
export const getAvailableTopics = async () => {
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('topic')
            .not('topic', 'is', null);

        if (error) {
            console.error('❌ [KB Topics] Error:', error);
            return [];
        }

        const uniqueTopics = [...new Set(data?.map(item => item.topic) || [])];
        return uniqueTopics.sort();

    } catch (error) {
        console.error('❌ [KB Topics] Error:', error);
        return [];
    }
};

// ============================================================
//  VALIDATION
// ============================================================

/**
 * Validate if topic exists in KB
 */
export const validateTopic = async (topic) => {
    const matchedTopic = await matchTopicToKB(topic);
    return matchedTopic !== null;
};

/**
 * Strict validation for KB-only quiz generation
 * Ensures no AI generation, no topic mixing, no content modification
 */
export const validateKBQuizCompliance = (userTopic, difficulty, count, matchedTopic, questionsFound) => {
    const validation = {
        isCompliant: true,
        violations: [],
        warnings: []
    };

    // Check 1: Topic must match exactly (no AI generation)
    if (!matchedTopic || matchedTopic.toLowerCase() !== userTopic.toLowerCase()) {
        validation.isCompliant = false;
        validation.violations.push(`Topic mismatch: Requested "${userTopic}" vs Matched "${matchedTopic}"`);
    }

    // Check 2: Questions must come from KB (no mixing)
    if (questionsFound === 0) {
        validation.isCompliant = false;
        validation.violations.push(`No KB questions found for topic: "${userTopic}"`);
    }

    // Check 3: Count must be respected (exact number requested)
    if (count && questionsFound < count) {
        validation.warnings.push(`Only ${questionsFound} questions available for "${userTopic}" (requested ${count})`);
    }

    // Check 4: Difficulty must be applied strictly
    if (difficulty && difficulty !== 'Mixed') {
        validation.difficultyApplied = difficulty;
    }

    return validation;
};
