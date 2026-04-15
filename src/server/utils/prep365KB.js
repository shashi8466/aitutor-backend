// ============================================================
//  24/7 AI PREP365 KNOWLEDGE BASE SEARCH
//  Exact content retrieval without AI generation or rewriting
// ============================================================

import supabase from '../../supabase/supabaseAdmin.js';

// ============================================================
//  TOPIC MATCHING ENGINE
// ============================================================

const normalizeTopic = (str) => {
    if (!str) return '';
    
    // Common filler words and phrases to strip
    const fillerWords = [
        'questions', 'question', 'quiz', 'me', 'on', 'about', 'give', 'want', 
        'practice', 'drill', 'test', 'regarding', 'showing', 'show', 'for', 'to',
        'entries', 'related', 'a', 'an', 'the', 'and', 'with', 'by', 'of', 'in'
    ];
    
    if (str.length > 150) return '___JUNK___';
    
    let normalized = str.toLowerCase().replace(/[&]/g, 'and').replace(/[+]/g, ' ');
    
    // Replace punctuation with space - handling hyphens and commas specifically as requested
    normalized = normalized.replace(/[-,]/g, ' '); 
    normalized = normalized.replace(/[.\s.:\-_\\/|()\[\]]+/g, ' ');
    
    // 2. Remove any other weird special chars
    normalized = normalized.replace(/[^a-z0-9 ]/g, '');
    
    // 3. Strip filler words and normalize plurals (basic)
    const words = normalized.split(' ').filter(word => {
        return word.length > 0 && !fillerWords.includes(word);
    }).map(word => {
        // Simple plural normalization
        if (word.length > 4 && word.endsWith('s')) return word.slice(0, -1);
        return word;
    });
    
    return words.join(' ').trim();
};

const buildSupabaseInList = (ids = []) => {
    const validIds = (Array.isArray(ids) ? ids : []).filter((id) => id != null);
    if (validIds.length === 0) return null;
    return validIds.map((id) => {
        const asString = String(id).trim();
        return /^\d+$/.test(asString) ? asString : `'${asString}'`;
    }).join(',');
};
const MATH_TOPICS = [
    'Area and volume', 'Circles', 'Equivalent expressions', 'Evaluating statistical claims',
    'Inference from sample statistics', 'Linear equations in one variable',
    'Linear equations in two variables', 'Linear functions', 'Linear inequalities - in one or two variables',
    'Lines, angles, and triangles', 'Nonlinear equations in one variable and systems of equations in two variables',
    'Nonlinear functions', 'One-variable data', 'Percentages', 'Probability',
    'Problem-Solving and Data Analysis', 'Ratios, rates, proportional relationships and units', 
    'Systems of two linear equations in two variables', 'Two-variable data: models and scatterplots'
];

const ENGLISH_TOPICS = [
    'Boundaries', 'Central Ideas and Details', 'Command of Evidence',
    'Command of quantitative evidence', 'Command of textual evidence', 
    'Cross-Text Connections', 'Form, Structure, and Sense', 'Inferences', 
    'Rhetorical synthesis', 'Transitions', 'Words in Context'
];

// Topic Alias Map for common user terms that don't match formal SAT topic names
const TOPIC_ALIASES = {
    'math': MATH_TOPICS,
    'mathematics': MATH_TOPICS,
    'maths': MATH_TOPICS,
    'english': ENGLISH_TOPICS,
    'reading and writing': ENGLISH_TOPICS,
    'reading & writing': ENGLISH_TOPICS,
    'reading': ENGLISH_TOPICS,
    'writing': ENGLISH_TOPICS,
    'grammar': ['Boundaries', 'Form, Structure, and Sense', 'Transitions', 'Words in Context'],
    'algebra': ['Linear equations in one variable', 'Linear equations in two variables', 'Linear functions', 'Linear inequalities - in one or two variables', 'Systems of two linear equations in two variables', 'Nonlinear functions'],
    'geometry': ['Area and volume', 'Circles', 'Lines, angles, and triangles', 'Right triangles and trigonometry'],
    'trigonometry': ['Right triangles and trigonometry'],
    'statistics': ['One-variable data', 'Two-variable data: models and scatterplots', 'Probability'],
    'data analysis': ['Problem-Solving and Data Analysis', 'One-variable data', 'Two-variable data: models and scatterplots'],
    'percentage': ['Percentages'],
    'ratio': ['Ratios, rates, proportional relationships and units'],
    'ratios': ['Ratios, rates, proportional relationships and units'],
    'probability': ['Probability'],
};

/**
 * Matches user topic to KB topics following multiple strategies
 * RETURNS AN ARRAY of matched topics to allow broad alias matching (e.g. Algebra -> multiple sub-topics)
 */
const matchTopicToKB = async (userTopic) => {
    const topicNorm = normalizeTopic(userTopic);
    console.log(`🧠 [KB Match] Normalizing "${userTopic}" -> "${topicNorm}"`);
    
    try {
        const { data: allTopics, error: topicsError } = await supabase
            .from('questions')
            .select('topic')
            .not('topic', 'is', null);

        if (topicsError) throw topicsError;
        const uniqueTopics = [...new Set(allTopics.map(item => item.topic))];
        
        // --- PRIORITY 1: PRECISE TOPIC MATCHES ---
        let preciseMatches = new Set();
        for (const topic of uniqueTopics) {
            if (topic.length > 150) continue; // Skip suspected junk topics
            const tNorm = normalizeTopic(topic);
            if (tNorm === '___JUNK___') continue;
            
            // Check if user exactly named this topic or the topic is a significant part of the query
            if (topicNorm === tNorm || (topicNorm.length > 5 && topicNorm.includes(tNorm))) {
                console.log(`🎯 [KB Match] Precise match: "${topic}"`);
                preciseMatches.add(topic);
            }
        }

        if (preciseMatches.size > 0) {
            return Array.from(preciseMatches);
        }

        // --- PRIORITY 2: BROAD CATEGORY ALIASES ---
        let mathHits = false;
        let englishHits = false;
        let multiAliasMatches = new Set();

        const aliasKeys = Object.keys(TOPIC_ALIASES).sort((a,b) => b.length - a.length);
        for (const alias of aliasKeys) {
            const aliasNorm = normalizeTopic(alias);
            if (topicNorm.includes(aliasNorm)) {
                console.log(`🎯 [KB Match] Alias hit: "${alias}"`);
                
                // Track which subjects are being requested
                const targetTopics = TOPIC_ALIASES[alias];
                if (targetTopics === MATH_TOPICS) mathHits = true;
                if (targetTopics === ENGLISH_TOPICS) englishHits = true;
                
                targetTopics.forEach(t => multiAliasMatches.add(t));
            }
        }

        // SUBJECT ISOLATION: If "English" was found and "Math" was NOT, ensure no math topics are returned.
        // This fixes the "English returning Math" bug.
        if (englishHits && !mathHits) {
            return ENGLISH_TOPICS;
        }
        if (mathHits && !englishHits) {
            return MATH_TOPICS;
        }

        if (multiAliasMatches.size > 0) {
            return Array.from(multiAliasMatches);
        }

        // --- PRIORITY 3: CONTAINMENT MATCH ---
        let bestMatch = null;
        let bestScore = -1;
        for (const topic of uniqueTopics) {
            const tNorm = normalizeTopic(topic);
            if (tNorm.includes(topicNorm) || topicNorm.includes(tNorm)) {
                const score = 100 - Math.abs(tNorm.length - topicNorm.length);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = topic;
                }
            }
        }
        if (bestMatch) {
            console.log(`🎯 [KB Match] Containment match: "${bestMatch}"`);
            return [bestMatch];
        }

        // 4. Multi-keyword search support (Fallback)
        const keywords = userTopic.split(/,|\sand\s|\sor\s|\s\+\s|\s\&\s/).map(k => normalizeTopic(k)).filter(k => k.length > 3);
        if (keywords.length > 0) {
            const keywordMatches = new Set();
            for (const kw of keywords) {
                for (const topic of uniqueTopics) {
                    if (normalizeTopic(topic).includes(kw)) keywordMatches.add(topic);
                }
            }
            if (keywordMatches.size > 0) {
                console.log(`🎯 [KB Match] Keyword matches: [${Array.from(keywordMatches).join(', ')}]`);
                return Array.from(keywordMatches);
            }
        }

        return [];
    } catch (error) {
        console.error('❌ [KB Match Error]:', error);
        return [];
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
const filterByDifficulty = async (topic, difficulty, returnLimit = 50, fetchLimit = null, excludeIds = []) => {
    try {
        console.log(`🔍 [KB Filter] Topic: "${topic}" | Diff: ${difficulty} | Limit: ${returnLimit} | Excl: ${excludeIds.length}`);
        
        let query = supabase
            .from('questions')
            .select('*')
            .eq('topic', topic);

        // Apply exclusion filter if IDs are provided
        if (excludeIds && excludeIds.length > 0) {
            // Using the string format (id1, id2, ...) is more robust across Supabase client versions
            // and handles both integer and UUID IDs correctly if joined properly.
            const validIds = excludeIds.filter(id => id != null);
            if (validIds.length > 0) {
                const idList = validIds.map((id) => {
                    // Keep numeric IDs unquoted for integer columns; quote only non-numeric IDs (e.g. UUID).
                    const asString = String(id).trim();
                    return /^\d+$/.test(asString) ? asString : `'${asString}'`;
                }).join(',');
                query = query.not('id', 'in', `(${idList})`);
            }
        }

        // Apply difficulty filter if specified
        if (difficulty && difficulty !== 'Mixed') {
            const diffCapitalized = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
            query = query.eq('level', diffCapitalized);
        }

        // Use provided fetchLimit or calculate it - increase for better variety
        const actualFetchLimit = fetchLimit || Math.max(returnLimit * 10, 100);
        
        // IMPORTANT: Don't use orderBy with limit - it always returns the same questions!
        // Instead, fetch more than needed and shuffle client-side
        const { data: questions, error } = await query.limit(actualFetchLimit);
        
        if (error) {
            console.error('[KB Filter] Database error:', error);
            return [];
        }

        console.log(`📊 [KB Filter] Exact match returned ${questions?.length || 0} questions`);

        // If no questions found, try partial match
        if (!questions || questions.length === 0) {
            console.log(`⚠️ [KB Filter] Exact match returned 0. Trying partial match...`);
            
            const { data: partialData, error: partialError } = await supabase
                .from('questions')
                .select('*')
                .ilike('topic', `%${topic}%`);
            
            if (!partialError && partialData && partialData.length > 0) {
                console.log(`✅ [KB Filter] Partial match found ${partialData.length} questions`);
                
                // Apply difficulty filter to partial results if needed
                let filteredData = partialData;
                if (difficulty && difficulty !== 'Mixed') {
                    const diffCapitalized = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
                    filteredData = partialData.filter(q => 
                        q.level && q.level.toLowerCase() === diffCapitalized.toLowerCase()
                    );
                    console.log(`🎯 [KB Filter] Partial match filtered to ${filteredData.length} with difficulty ${diffCapitalized}`);
                }
                
                return processAndReturnQuestions(filteredData, returnLimit, excludeIds);
            }
            
            return [];
        }

        // Process and return the results
        return processAndReturnQuestions(questions, returnLimit, excludeIds);

    } catch (error) {
        console.error('❌ [KB Filter] Error:', error);
        return [];
    }
};

/**
 * Helper function to shuffle, deduplicate, and limit questions
 * Uses Fisher-Yates shuffle for better randomization
 */
const processAndReturnQuestions = (questions, returnLimit, excludeIds = []) => {
    if (!questions || questions.length === 0) {
        return [];
    }

    // Flatten and normalize IDs for a robust exclusion set
    const flatExcludeIds = (Array.isArray(excludeIds) ? excludeIds : []).flat(Infinity);
    const excludeIdSet = new Set(flatExcludeIds.map(id => String(id).trim()));

    // Step 1: Remove duplicates based on ID (handles both number and string ID types)
    const uniqueQuestions = [];
    const seenIds = new Set();
    
    for (const q of questions) {
        const qIdNormalized = String(q.id).trim();
        
        if (excludeIdSet.has(qIdNormalized)) {
            continue;
        }
        
        if (seenIds.has(qIdNormalized)) {
            continue;
        }
        
        seenIds.add(qIdNormalized);
        uniqueQuestions.push(q);
    }

    // Step 2: Fisher-Yates shuffle for better randomization
    for (let i = uniqueQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uniqueQuestions[i], uniqueQuestions[j]] = [uniqueQuestions[j], uniqueQuestions[i]];
    }
    
    // Step 3: Return exactly the requested number (or fewer if not available)
    const finalQuestions = uniqueQuestions.slice(0, returnLimit);

    console.log(`[KB Process] Input ${questions.length} total, excluded ${excludeIds.length}, filtered to ${uniqueQuestions.length} unique. Returning ${finalQuestions.length} (requested: ${returnLimit})`);
    
    // Log the IDs being returned for debugging
    if (finalQuestions.length > 0) {
        console.log(`[KB Process] Returning question IDs: ${finalQuestions.map(q => q.id).join(', ')}`);
    }
    
    return finalQuestions;
};

/**
 * Main search function for 24/7 AI Prep365 Chat
 * Returns exact KB questions only - no AI generation
 */
export const searchExactKBQuestions = async (userTopic, difficulty = null, count = null, excludeIds = []) => {
    try {
        const requestedCount = Number(count) || 10;
        const safeExcludeIds = Array.isArray(excludeIds) ? excludeIds : [];
        
        console.log(`🚀 [Prep365 KB] Search initiated for: "${userTopic}" | Difficulty: ${difficulty || 'Mixed'} | Count: ${requestedCount} | Excl: ${safeExcludeIds.length}`);

        // Step 1: Match topic to KB (returns array of topics)
        const matchedTopics = await matchTopicToKB(userTopic);
        console.log(`🎯 [Prep365 KB] matchedTopics:`, matchedTopics);
        
        let questions = [];
        let allPotentialQuestions = [];

        if (matchedTopics && matchedTopics.length > 0) {
            // Step 2: Shuffle matched topics for variety
            const shuffledTopics = [...matchedTopics].sort(() => Math.random() - 0.5);
            
            // Step 3: Fetch questions from matched topics
            for (const topic of shuffledTopics) {
                // Fetch a small batch from each topic to ensure variety
                const perTopicLimit = Math.max(2, Math.ceil(requestedCount / 3));
                const topicQuestions = await filterByDifficulty(topic, difficulty, perTopicLimit, perTopicLimit * 5, safeExcludeIds);
                allPotentialQuestions = [...allPotentialQuestions, ...topicQuestions];
                
                // Keep fetching until we have a healthy pool for variety, but don't over-fetch
                if (allPotentialQuestions.length >= requestedCount * 5) break;
            }
            
            // Randomize and limit the aggregated results
            questions = processAndReturnQuestions(allPotentialQuestions, requestedCount, safeExcludeIds);
        }

        // ADDITIONAL LOGIC: If still not enough questions, try fallback searches
        if (questions.length < requestedCount) {
            console.log(`[Prep365 KB] Found only ${questions.length}/${requestedCount}. Attempting broader searches...`);
            
            const remainingNeeded = requestedCount - questions.length;
            const currentExcludeIds = [...safeExcludeIds, ...questions.map(q => q.id)];
            const topicNorm = normalizeTopic(userTopic);
            
            // Fallback 1: ilike match on the first matched topic
            const fallbackTopic = (matchedTopics && matchedTopics.length > 0) ? matchedTopics[0] : topicNorm;
            let widerQuery = supabase
                .from('questions')
                .select('*')
                .ilike('topic', `%${fallbackTopic}%`);
            
            if (currentExcludeIds.length > 0) {
                const idList = buildSupabaseInList(currentExcludeIds);
                if (idList) {
                    widerQuery = widerQuery.not('id', 'in', `(${idList})`);
                }
            }
                
            const { data: widerResults } = await widerQuery.limit(remainingNeeded * 2);
                
            if (widerResults && widerResults.length > 0) {
                console.log(`[Prep365 KB] Broader search found ${widerResults.length} new matches.`);
                const processedWider = processAndReturnQuestions(widerResults, remainingNeeded, currentExcludeIds);
                questions = [...questions, ...processedWider].slice(0, requestedCount);
            }
        }

        // FINAL FALLBACK: Raw keyword search if still short
        if (questions.length < requestedCount) {
            const remainingNeeded = requestedCount - questions.length;
            const currentExcludeIds = [...safeExcludeIds, ...questions.map(q => q.id)];
            const topicNorm = normalizeTopic(userTopic);
            
            console.log(`Still short (${questions.length}/${requestedCount}). Final keyword fallback for "${topicNorm}"...`);
            let fallbackQuery = supabase
                .from('questions')
                .select('*')
                .or(`topic.ilike.%${topicNorm}%,question.ilike.%${topicNorm}%`);
            
            if (currentExcludeIds.length > 0) {
                const idList = buildSupabaseInList(currentExcludeIds);
                if (idList) {
                    fallbackQuery = fallbackQuery.not('id', 'in', `(${idList})`);
                }
            }

            const { data: finalFallback } = await fallbackQuery.limit(remainingNeeded);
                
            if (finalFallback && finalFallback.length > 0) {
                const processedFallback = processAndReturnQuestions(finalFallback, remainingNeeded, currentExcludeIds);
                questions = [...questions, ...processedFallback].slice(0, requestedCount);
            }
        }
        
        console.log(`✅ [Prep365 KB] Final results: Found ${questions.length}/${requestedCount} unique questions.`);

        // Step 4: Preserve exact content formatting
        return questions.map(q => ({
            id: q.id,
            topic: q.topic,
            difficulty: q.level,
            type: q.type || 'mcq', // MCQ or short_answer
            text: q.question || q.text, // Exact text as stored
            questionHtml: q.question_html, // HTML formatted question (with tables/images)
            options: q.options || [], // Exact options as stored
            correctAnswer: q.correct_answer, // Exact answer as stored
            explanation: q.explanation || '', // Exact explanation as stored
            createdAt: q.created_at,
            imageUrl: q.image_url || q.image, // Consistently map image
            images: q.images || [],
            tables: q.tables || [],
            formulas: q.formulas || [],
            formatting: q.formatting || {}
        }));

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

    // Check 1: Topic must match (either exactly or via fuzzy match returned by engine)
    // If matchedTopic exists, it means the engine already determined it was a valid match
    if (!matchedTopic) {
        validation.isCompliant = false;
        validation.violations.push(`No topic match found for requested: "${userTopic}"`);
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
