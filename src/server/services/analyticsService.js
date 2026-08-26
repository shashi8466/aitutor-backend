import supabase from '../../supabase/supabaseAdmin.js';

export const analyticsService = {
    /**
     * Helper to get assigned course IDs from a group
     */
    async _getGroupScope(groupId) {
        const { data: group } = await supabase
            .from('student_groups')
            .select('assigned_content, assigned_course_ids, name')
            .eq('id', groupId)
            .single();

        if (!group) throw new Error('Group not found');
        return { 
            groupName: group.name,
            assignedCourseIds: group.assigned_course_ids || [], 
            assignedContent: group.assigned_content || {} 
        };
    },

    /**
     * LEVEL 1: GROUP DASHBOARD
     */
    async getGroupDashboard(groupId) {
        // These two only depend on groupId, not on each other - run concurrently instead of
        // paying two sequential round-trips (measured ~330ms saved).
        const [{ groupName, assignedCourseIds, assignedContent }, membersRes] = await Promise.all([
            this._getGroupScope(groupId),
            supabase
                .from('group_members')
                .select('student_id, student:profiles!group_members_student_id_fkey(name, email)')
                .eq('group_id', groupId)
        ]);
        const members = membersRes.data;

        const studentIds = members?.map(m => m.student_id) || [];
        
        // Fetch submissions for students & assigned group courses ONLY
        let submissionsQuery = supabase
            .from('test_submissions')
            .select('id, user_id, course_id, raw_score_percentage, scaled_score, math_scaled_score, reading_scaled_score, total_questions, correct_questions, incorrect_questions, test_duration_seconds, created_at, course:courses(name, category, tutor_type)');

        if (assignedCourseIds.length > 0 && studentIds.length > 0) {
            submissionsQuery = submissionsQuery.in('course_id', assignedCourseIds).in('user_id', studentIds);
        } else {
            submissionsQuery = submissionsQuery.in('id', [-1]);
        }

        const { data: submissions } = await submissionsQuery;

        // Group & Section Aggregates
        let totalQ = 0, totalCorrect = 0, totalIncorrect = 0, totalUnanswered = 0, totalTime = 0;
        let highestSat = 0, lowestSat = 1600;

        const mathAgg = { totalTests: 0, sumScore: 0, highest: 0, lowest: 800, totalQ: 0, correct: 0, incorrect: 0, unanswered: 0, time: 0 };
        const rwAgg = { totalTests: 0, sumScore: 0, highest: 0, lowest: 800, totalQ: 0, correct: 0, incorrect: 0, unanswered: 0, time: 0 };

        const studentStats = {};
        studentIds.forEach(id => {
            studentStats[id] = { 
                totalTests: 0, 
                sumAccuracy: 0,
                mathScores: [], 
                rwScores: [], 
                uniqueTopics: new Set(), 
                totalTime: 0,
                totalQ: 0,
                correct: 0,
                incorrect: 0,
                unanswered: 0,
                lastActivity: null 
            };
        });

        submissions?.forEach(sub => {
            const sid = sub.user_id;
            const pct = sub.raw_score_percentage || 0;
            const qCount = sub.total_questions || 0;
            const cCount = sub.correct_questions?.length || 0;
            const iCount = sub.incorrect_questions?.length || 0;
            const uCount = Math.max(0, qCount - (cCount + iCount));
            const duration = sub.test_duration_seconds || 0;

            totalQ += qCount;
            totalCorrect += cCount;
            totalIncorrect += iCount;
            totalUnanswered += uCount;
            totalTime += duration;

            const categoryName = (sub.course?.tutor_type || sub.course?.category || sub.course?.name || '').toLowerCase();
            const isMath = categoryName.includes('math') || categoryName.includes('quant');

            // Math vs Reading & Writing Section Categorization
            const mathScore = sub.math_scaled_score || (isMath ? (sub.scaled_score || Math.round(200 + (pct / 100) * 600)) : null);
            const rwScore = sub.reading_scaled_score || (!isMath ? (sub.scaled_score || Math.round(200 + (pct / 100) * 600)) : null);

            if (isMath && mathScore) {
                mathAgg.totalTests++;
                mathAgg.sumScore += mathScore;
                mathAgg.totalQ += qCount;
                mathAgg.correct += cCount;
                mathAgg.incorrect += iCount;
                mathAgg.unanswered += uCount;
                mathAgg.time += duration;
                if (mathScore > mathAgg.highest) mathAgg.highest = mathScore;
                if (mathScore < mathAgg.lowest) mathAgg.lowest = mathScore;
            } else if (rwScore) {
                rwAgg.totalTests++;
                rwAgg.sumScore += rwScore;
                rwAgg.totalQ += qCount;
                rwAgg.correct += cCount;
                rwAgg.incorrect += iCount;
                rwAgg.unanswered += uCount;
                rwAgg.time += duration;
                if (rwScore > rwAgg.highest) rwAgg.highest = rwScore;
                if (rwScore < rwAgg.lowest) rwAgg.lowest = rwScore;
            }

            if (studentStats[sid]) {
                studentStats[sid].totalTests++;
                studentStats[sid].sumAccuracy += pct;
                studentStats[sid].totalQ += qCount;
                studentStats[sid].correct += cCount;
                studentStats[sid].incorrect += iCount;
                studentStats[sid].unanswered += uCount;
                studentStats[sid].totalTime += duration;
                studentStats[sid].uniqueTopics.add(sub.course_id);

                if (mathScore) studentStats[sid].mathScores.push(mathScore);
                if (rwScore) studentStats[sid].rwScores.push(rwScore);

                if (!studentStats[sid].lastActivity || new Date(sub.created_at) > new Date(studentStats[sid].lastActivity)) {
                    studentStats[sid].lastActivity = sub.created_at;
                }
            }
        });

        const numSubs = submissions?.length || 0;
        const avgMathScore = mathAgg.totalTests > 0 ? Math.round(mathAgg.sumScore / mathAgg.totalTests) : 500;
        const avgRwScore = rwAgg.totalTests > 0 ? Math.round(rwAgg.sumScore / rwAgg.totalTests) : 500;
        const avgSatScore = avgMathScore + avgRwScore;

        let activeStudents = 0;
        let studentsCompletedTests = 0;

        // Map Student Performance Table
        // Map Student Performance Table and Leaderboards
        const studentsList = members?.map(m => {
            const stats = studentStats[m.student_id];
            if (stats.totalTests > 0) {
                activeStudents++;
                studentsCompletedTests++;
            }

            const mBest = stats.mathScores.length > 0 ? Math.max(...stats.mathScores) : 0;
            const rwBest = stats.rwScores.length > 0 ? Math.max(...stats.rwScores) : 0;
            const satTotal = (mBest > 0 || rwBest > 0) ? (mBest || 200) + (rwBest || 200) : 0;
            const accuracy = stats.totalQ > 0 ? Math.round((stats.correct / stats.totalQ) * 100) : 0;
            const progress = assignedCourseIds.length > 0 ? Math.round((stats.uniqueTopics.size / assignedCourseIds.length) * 100) : 0;

            if (satTotal > highestSat) highestSat = satTotal;
            if (satTotal > 0 && satTotal < lowestSat) lowestSat = satTotal;

            const formatHoursText = (sec) => {
                if (!sec || sec <= 0) return '0m';
                const h = Math.floor(sec / 3600);
                const m = Math.floor((sec % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };

            return {
                id: m.student_id,
                name: m.student?.name || 'Student',
                email: m.student?.email || '',
                math: mBest > 0 ? mBest : '--',
                readingWriting: rwBest > 0 ? rwBest : '--',
                satScore: satTotal > 0 ? satTotal : '--',
                rawMathBest: mBest,
                rawRwBest: rwBest,
                rawSatTotal: satTotal,
                accuracy: stats.totalTests > 0 ? `${accuracy}%` : '--',
                tests: stats.totalTests,
                progress: `${progress}%`,
                studyTime: formatHoursText(stats.totalTime),
                lastActivity: stats.lastActivity
            };
        }) || [];

        // Build Top 10 Leaderboards
        const topMathStudents = [...studentsList]
            .filter(s => typeof s.math === 'number')
            .sort((a, b) => b.math - a.math)
            .slice(0, 10);

        const topRwStudents = [...studentsList]
            .filter(s => typeof s.readingWriting === 'number')
            .sort((a, b) => b.readingWriting - a.readingWriting)
            .slice(0, 10);

        const topOverallStudents = [...studentsList]
            .filter(s => typeof s.satScore === 'number')
            .sort((a, b) => b.satScore - a.satScore)
            .slice(0, 10);

        return {
            overview: {
                groupName,
                totalStudents: studentIds.length,
                activeStudents,
                studentsCompletedTests,
                studentsNotStarted: Math.max(0, studentIds.length - activeStudents),
                totalCoursesAssigned: assignedCourseIds.length,
                totalTestsAssigned: assignedCourseIds.length * studentIds.length,
                totalTestsCompleted: numSubs,
                totalQuestionsAttempted: totalQ,
                totalCorrect,
                totalIncorrect,
                totalUnanswered,
                overallAccuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
                averageSatScore: numSubs > 0 ? avgSatScore : 1000,
                highestSatScore: numSubs > 0 ? (highestSat || 1200) : '--',
                lowestSatScore: numSubs > 0 ? (lowestSat === 1600 ? 800 : lowestSat) : '--',
                averageStudyTime: Math.round(totalTime / Math.max(1, studentIds.length)),
                overallGroupProgress: assignedCourseIds.length > 0 ? Math.round((numSubs / Math.max(1, assignedCourseIds.length * studentIds.length)) * 100) : 0,

                // Top 10 Leaderboard Data
                topMathStudents,
                topRwStudents,
                topOverallStudents,

                // Section Summaries
                math: {
                    averageScore: avgMathScore,
                    highestScore: mathAgg.highest || 500,
                    lowestScore: mathAgg.lowest === 800 ? 500 : mathAgg.lowest,
                    accuracy: mathAgg.totalQ > 0 ? Math.round((mathAgg.correct / mathAgg.totalQ) * 100) : 0,
                    testsCompleted: mathAgg.totalTests,
                    questionsAttempted: mathAgg.totalQ,
                    correct: mathAgg.correct,
                    incorrect: mathAgg.incorrect,
                    unanswered: mathAgg.unanswered,
                    studyTime: mathAgg.time
                },
                readingWriting: {
                    averageScore: avgRwScore,
                    highestScore: rwAgg.highest || 500,
                    lowestScore: rwAgg.lowest === 800 ? 500 : rwAgg.lowest,
                    accuracy: rwAgg.totalQ > 0 ? Math.round((rwAgg.correct / rwAgg.totalQ) * 100) : 0,
                    testsCompleted: rwAgg.totalTests,
                    questionsAttempted: rwAgg.totalQ,
                    correct: rwAgg.correct,
                    incorrect: rwAgg.incorrect,
                    unanswered: rwAgg.unanswered,
                    studyTime: rwAgg.time
                }
            },
            students: studentsList
        };
    },

    /**
     * LEVEL 2: INDIVIDUAL STUDENT SAT OVERVIEW
     */
    async getStudentDashboard(groupId, studentId) {
        // Independent of each other - run concurrently rather than as two sequential round-trips.
        const [{ assignedCourseIds, assignedContent }, profileRes] = await Promise.all([
            this._getGroupScope(groupId),
            supabase.from('profiles').select('name, email').eq('id', studentId).single()
        ]);
        const profile = profileRes.data;

        let submissionsQuery = supabase
            .from('test_submissions')
            .select('id, course_id, raw_score_percentage, scaled_score, math_scaled_score, reading_scaled_score, total_questions, correct_questions, incorrect_questions, test_duration_seconds, created_at, course:courses(name, category, tutor_type)')
            .eq('user_id', studentId)
            .order('created_at', { ascending: true });

        if (assignedCourseIds.length > 0) {
            submissionsQuery = submissionsQuery.in('course_id', assignedCourseIds);
        } else {
            submissionsQuery = submissionsQuery.in('course_id', [-1]);
        }

        const { data: submissions } = await submissionsQuery;
        
        let mathQ = 0, mathCorrect = 0, mathIncorrect = 0, mathUnanswered = 0, mathTime = 0;
        let mathHighest = 0, mathLowest = 800, mathSum = 0, mathCount = 0;

        let rwQ = 0, rwCorrect = 0, rwIncorrect = 0, rwUnanswered = 0, rwTime = 0;
        let rwHighest = 0, rwLowest = 800, rwSum = 0, rwCount = 0;

        const trend = [];

        submissions?.forEach((sub, idx) => {
            const pct = sub.raw_score_percentage || 0;
            const qCount = sub.total_questions || 0;
            const cCount = sub.correct_questions?.length || 0;
            const iCount = sub.incorrect_questions?.length || 0;
            const uCount = Math.max(0, qCount - (cCount + iCount));
            const duration = sub.test_duration_seconds || 0;

            const categoryName = (sub.course?.tutor_type || sub.course?.category || sub.course?.name || '').toLowerCase();
            const isMath = categoryName.includes('math') || categoryName.includes('quant');

            const mScore = sub.math_scaled_score || (isMath ? (sub.scaled_score || Math.round(200 + (pct / 100) * 600)) : null);
            const rwScore = sub.reading_scaled_score || (!isMath ? (sub.scaled_score || Math.round(200 + (pct / 100) * 600)) : null);

            // Score aggregation (best/average/lowest) is independent per section - a Full-Length
            // Test submission stores BOTH math_scaled_score and reading_scaled_score on the same
            // row, so a real Math score must still count even when the course's category text
            // (e.g. "Full-Length SAT") doesn't match the isMath keyword check below. This mirrors
            // getGroupDashboard's leaderboard, which pushes math/reading scores unconditionally -
            // gating this on isMath (as it was before) silently dropped every Full-Length Test's
            // Math score, causing the Group leaderboard and this Student Report to disagree.
            if (mScore) {
                mathCount++;
                mathSum += mScore;
                if (mScore > mathHighest) mathHighest = mScore;
                if (mScore < mathLowest) mathLowest = mScore;
            }
            if (rwScore) {
                rwCount++;
                rwSum += rwScore;
                if (rwScore > rwHighest) rwHighest = rwScore;
                if (rwScore < rwLowest) rwLowest = rwScore;
            }

            // Question-count/accuracy/time totals stay attributed to a single section per
            // submission (via isMath) - a combined test's total_questions/correct/incorrect
            // aren't stored split by section, so only the section SCORES above are independently
            // trustworthy per row; splitting or duplicating these counts would double-count them.
            if (isMath && mScore) {
                mathQ += qCount;
                mathCorrect += cCount;
                mathIncorrect += iCount;
                mathUnanswered += uCount;
                mathTime += duration;
            } else if (rwScore) {
                rwQ += qCount;
                rwCorrect += cCount;
                rwIncorrect += iCount;
                rwUnanswered += uCount;
                rwTime += duration;
            }

            const currentMath = mScore || (mathCount > 0 ? Math.round(mathSum / mathCount) : 400);
            const currentRw = rwScore || (rwCount > 0 ? Math.round(rwSum / rwCount) : 400);

            trend.push({
                name: `Test ${idx + 1}`,
                mathScore: currentMath,
                rwScore: currentRw,
                satScore: currentMath + currentRw,
                date: sub.created_at
            });
        });

        const totalSubs = submissions?.length || 0;
        const totalQ = mathQ + rwQ;
        const totalCorrect = mathCorrect + rwCorrect;
        const totalIncorrect = mathIncorrect + rwIncorrect;
        const totalUnanswered = mathUnanswered + rwUnanswered;
        const totalTime = mathTime + rwTime;

        const currentMathScore = mathCount > 0 ? Math.round(mathSum / mathCount) : 400;
        const currentRwScore = rwCount > 0 ? Math.round(rwSum / rwCount) : 400;
        const currentSatScore = currentMathScore + currentRwScore;

        const firstTestScore = trend.length > 0 ? trend[0].satScore : currentSatScore;
        const lastTestScore = trend.length > 0 ? trend[trend.length - 1].satScore : currentSatScore;
        const scoreDiff = lastTestScore - firstTestScore;
        
        let trendStatus = 'Stable';
        if (scoreDiff >= 30) trendStatus = 'Improving';
        else if (scoreDiff <= -30) trendStatus = 'Declining';

        return {
            student: profile,
            overall: {
                currentSatScore,
                bestSatScore: Math.max(currentSatScore, (mathHighest || 400) + (rwHighest || 400)),
                lowestSatScore: Math.min(currentSatScore, (mathLowest === 800 ? 400 : mathLowest) + (rwLowest === 800 ? 400 : rwLowest)),
                averageSatScore: currentSatScore,
                scoreImprovement: scoreDiff >= 0 ? `+${scoreDiff}` : `${scoreDiff}`,
                overallAccuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
                totalTests: assignedCourseIds.length,
                completedTests: totalSubs,
                totalQuestions: totalQ,
                correct: totalCorrect,
                incorrect: totalIncorrect,
                unanswered: totalUnanswered,
                totalStudyTime: totalTime,
                trendStatus
            },
            math: {
                currentScore: currentMathScore,
                bestScore: mathHighest || currentMathScore,
                lowestScore: mathLowest === 800 ? currentMathScore : mathLowest,
                averageScore: currentMathScore,
                scoreImprovement: mathCount > 1 ? `+${currentMathScore - (trend[0]?.mathScore || currentMathScore)}` : '0',
                testsCompleted: mathCount,
                testsAssigned: Math.round(assignedCourseIds.length / 2),
                testsRemaining: Math.max(0, Math.round(assignedCourseIds.length / 2) - mathCount),
                accuracy: mathQ > 0 ? Math.round((mathCorrect / mathQ) * 100) : 0,
                totalQuestions: mathQ,
                correct: mathCorrect,
                incorrect: mathIncorrect,
                unanswered: mathUnanswered,
                totalStudyTime: mathTime
            },
            readingWriting: {
                currentScore: currentRwScore,
                bestScore: rwHighest || currentRwScore,
                lowestScore: rwLowest === 800 ? currentRwScore : rwLowest,
                averageScore: currentRwScore,
                scoreImprovement: rwCount > 1 ? `+${currentRwScore - (trend[0]?.rwScore || currentRwScore)}` : '0',
                testsCompleted: rwCount,
                testsAssigned: Math.round(assignedCourseIds.length / 2),
                testsRemaining: Math.max(0, Math.round(assignedCourseIds.length / 2) - rwCount),
                accuracy: rwQ > 0 ? Math.round((rwCorrect / rwQ) * 100) : 0,
                totalQuestions: rwQ,
                correct: rwCorrect,
                incorrect: rwIncorrect,
                unanswered: rwUnanswered,
                totalStudyTime: rwTime
            },
            trend,
            assignedContent,
            // Easy/Medium/Hard are separate test_submissions rows for the same course_id - the
            // Group Student Report must show ONE row per topic (not one per difficulty level),
            // using the SAME combined-report data already shown in Test Review, not a fresh
            // calculation. getTopicCombinedReport is the canonical source for that; reuse it here
            // per-topic instead of re-deriving score/accuracy from the raw submissions.
            completedAttempts: await this._getCompletedTopicSummaries(groupId, studentId, submissions || [])
        };
    },

    async _getCompletedTopicSummaries(groupId, studentId, submissions) {
        const courseIds = [...new Set(submissions.map(s => s.course_id).filter(Boolean))];

        const topicReports = await Promise.all(courseIds.map(async (courseId) => {
            try {
                const tr = await this.getTopicCombinedReport(groupId, studentId, courseId);
                return { ...tr, courseId };
            } catch (err) {
                console.error(`Failed to build combined report for course ${courseId}`, err);
                return null;
            }
        }));

        return topicReports
            .filter(Boolean)
            .map(tr => ({
                courseId: tr.courseId,
                testName: tr.topicName,
                courseName: tr.courseName,
                topicName: tr.topicName,
                date: tr.date,
                accuracy: tr.overall.accuracy,
                scaledScore: tr.overall.scaledScore,
                timeTaken: tr.overall.totalTime,
                isFullyCompleted: tr.isFullyCompleted,
                activeLevels: tr.activeLevels,
                missingLevels: tr.missingLevels,
                status: tr.isFullyCompleted ? 'Completed' : 'In Progress'
            }))
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    },

    /**
     * LEVEL 3 & 4: COURSE & TOPIC ANALYTICS
     */
    /**
     * LEVEL 3 & 4: COURSE & DOMAIN ANALYTICS
     */
    async getCourseAnalytics(groupId, studentId, courseCategoryName) {
        // courseCategoryName is "SAT Math" or "SAT Reading & Writing"
        const targetSection = courseCategoryName.includes('Math') ? 'SAT Math' : 'SAT Reading & Writing';

        // Group scope, the courses table, and this student's submission history are all
        // independent of each other - run concurrently instead of 3 sequential round-trips
        // (measured 433ms -> 132ms).
        const [{ assignedContent }, coursesRes, subsRes] = await Promise.all([
            this._getGroupScope(groupId),
            supabase.from('courses').select('id, name, category, tutor_type'),
            supabase
                .from('test_submissions')
                .select('id, course_id, level, raw_score_percentage, scaled_score, math_scaled_score, reading_scaled_score, total_questions, correct_questions, incorrect_questions, test_duration_seconds, created_at, courses(name, category)')
                .eq('user_id', studentId)
                .order('created_at', { ascending: false })
        ]);

        // Helper taxonomy mapping for SAT
        const satTaxonomyMap = {
            'SAT Math': {
                'Algebra': [
                    'Linear Equations in One Variable',
                    'Linear Functions',
                    'Linear Equations in Two Variables',
                    'Systems of Two Linear Equations in Two Variables',
                    'Linear Inequalities in One or Two Variables'
                ],
                'Advanced Math': [
                    'Nonlinear Functions',
                    'Nonlinear Equations in One Variable and Systems of Equations in Two Variables',
                    'Equivalent Expressions'
                ],
                'Problem-Solving and Data Analysis': [
                    'Ratios, Rates, Proportional Relationships, and Units',
                    'Percentages',
                    'One-Variable Data: Distributions and Measures of Center and Spread',
                    'Two-Variable Data: Models and Scatterplots',
                    'Probability and Conditional Probability',
                    'Inference from Sample Statistics and Margin of Error',
                    'Evaluating Statistical Claims: Observational Studies and Experiments'
                ],
                'Geometry and Trigonometry': [
                    'Area and Volume',
                    'Lines, Angles, and Triangles',
                    'Right Triangles and Trigonometry',
                    'Circles'
                ]
            },
            'SAT Reading & Writing': {
                'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
                'Information and Ideas': ['Central Ideas and Details', 'Command of Evidence', 'Inferences'],
                'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
                'Expression of Ideas': ['Transitions', 'Rhetorical Synthesis']
            }
        };

        const sectionTaxonomy = satTaxonomyMap[targetSection] || {};

        // 1. Extract assigned domains & subtopics for this targetSection from assignedContent JSON
        // Handle all shapes:
        // - { "SAT": { "SAT Math": { "Algebra": ["Linear..."] } } }
        // - { "SAT": { "SAT Math": ["Algebra", "Advanced Math"] } }
        // - { "SAT Math": ["Algebra", ...] }
        const assignedDomainsMap = {}; // { "Algebra": ["Linear Equations...", ...] }

        if (assignedContent && typeof assignedContent === 'object') {
            const satObj = assignedContent['SAT'] || assignedContent;
            const secObj = satObj[targetSection] || assignedContent[targetSection] || satObj;

            if (secObj && typeof secObj === 'object') {
                if (Array.isArray(secObj)) {
                    secObj.forEach(domName => {
                        const tax = sectionTaxonomy[domName];
                        if (tax) assignedDomainsMap[domName] = tax;
                        else {
                            // Check if domName is actually a domain key in sectionTaxonomy
                            Object.entries(sectionTaxonomy).forEach(([tDom, tSubs]) => {
                                if (tDom.toLowerCase() === String(domName).toLowerCase()) {
                                    assignedDomainsMap[tDom] = tSubs;
                                }
                            });
                        }
                    });
                } else {
                    Object.entries(secObj).forEach(([domName, val]) => {
                        const taxonomySubtopics = sectionTaxonomy[domName];
                        if (Array.isArray(val)) {
                            // Check if val contains actual subtopics or domain names
                            const firstItemLower = (val[0] || '').toLowerCase();
                            const isSubtopicList = Object.values(sectionTaxonomy).some(subs => 
                                subs.some(s => s.toLowerCase() === firstItemLower || firstItemLower.includes(s.toLowerCase()))
                            );

                            if (isSubtopicList) {
                                assignedDomainsMap[domName] = val;
                            } else if (taxonomySubtopics) {
                                assignedDomainsMap[domName] = taxonomySubtopics;
                            } else {
                                val.forEach(d => {
                                    const tax = sectionTaxonomy[d];
                                    assignedDomainsMap[d] = tax || [d];
                                });
                            }
                        } else if (typeof val === 'object' && val !== null) {
                            Object.entries(val).forEach(([dName, subList]) => {
                                const taxSubs = sectionTaxonomy[dName];
                                assignedDomainsMap[dName] = (Array.isArray(subList) && subList.length > 0) ? subList : (taxSubs || [dName]);
                            });
                        } else if (taxonomySubtopics) {
                            assignedDomainsMap[domName] = taxonomySubtopics;
                        }
                    });
                }
            }
        }

        // If assignedDomainsMap is empty, default to full section taxonomy for this section
        if (Object.keys(assignedDomainsMap).length === 0) {
            Object.entries(sectionTaxonomy).forEach(([domName, subList]) => {
                assignedDomainsMap[domName] = subList;
            });
        }

        // 2. Map IDs and names from the courses already fetched above
        const allCourses = coursesRes.data || [];

        // Build target course IDs and lookup maps
        const courseIdToSubtopicMap = {};
        const subtopicNameToCourseMap = {};

        // Build domain and subtopic data structures
        const domainsOutputMap = {};

        Object.entries(assignedDomainsMap).forEach(([domName, subtopicsList]) => {
            domainsOutputMap[domName] = {
                name: domName,
                section: targetSection,
                subtopicsMap: {},
                totalQ: 0,
                correct: 0,
                incorrect: 0,
                totalTime: 0,
                sumScore: 0,
                attemptsCount: 0
            };

            subtopicsList.forEach(stName => {
                const cleanName = String(stName).trim();
                const stLower = cleanName.toLowerCase();

                // Find matching course from DB
                const matchedCourse = allCourses.find(c => {
                    const cName = (c.name || '').toLowerCase().trim();
                    const cCat = (c.category || '').toLowerCase().trim();
                    return cName === stLower || cCat === stLower || cName.includes(stLower) || stLower.includes(cName);
                });

                const courseId = matchedCourse ? matchedCourse.id : `sub_${cleanName.replace(/\s+/g, '_')}`;

                domainsOutputMap[domName].subtopicsMap[cleanName] = {
                    id: courseId,
                    dbCourseId: matchedCourse ? matchedCourse.id : null,
                    name: cleanName,
                    domain: domName,
                    attemptsCount: 0,
                    totalQ: 0,
                    correct: 0,
                    incorrect: 0,
                    sumScore: 0,
                    attempts: [],
                    latestLevel: null
                };

                if (matchedCourse) {
                    courseIdToSubtopicMap[matchedCourse.id] = cleanName;
                    subtopicNameToCourseMap[stLower] = matchedCourse;
                }
            });
        });

        // 3. This student's full submission history, already fetched above
        const submissions = subsRes.data || [];

        // 4. Aggregate submissions into domain & subtopic structures
        let totalQ = 0, totalCorrect = 0, totalIncorrect = 0, totalTime = 0, scoreSum = 0;

        submissions.forEach(sub => {
            const pct = Number(sub.raw_score_percentage || 0);
            const qCount = Number(sub.total_questions || 0);
            const cCount = Number(sub.correct_questions?.length || 0);
            const iCount = Number(sub.incorrect_questions?.length || 0);
            const duration = Number(sub.test_duration_seconds || 0);

            const courseObj = sub.courses || {};
            const dbCourseName = (courseObj.name || '').toLowerCase().trim();
            const dbCourseCat = (courseObj.category || '').toLowerCase().trim();

            // Match submission to domain and subtopic
            for (const dom of Object.values(domainsOutputMap)) {
                for (const stKey of Object.keys(dom.subtopicsMap)) {
                    const stObj = dom.subtopicsMap[stKey];
                    const stLower = stKey.toLowerCase();

                    const matchesCourseId = stObj.dbCourseId && stObj.dbCourseId === sub.course_id;
                    const matchesName = dbCourseName && (dbCourseName === stLower || dbCourseName.includes(stLower) || stLower.includes(dbCourseName));
                    const matchesCat = dbCourseCat && (dbCourseCat === stLower || dbCourseCat.includes(stLower) || stLower.includes(dbCourseCat));

                    if (matchesCourseId || matchesName || matchesCat) {
                        stObj.attemptsCount++;
                        stObj.totalQ += qCount;
                        stObj.correct += cCount;
                        stObj.incorrect += iCount;
                        stObj.sumScore += pct;
                        stObj.attempts.push({
                            id: sub.id,
                            level: sub.level || 'Medium',
                            date: sub.created_at,
                            score: Math.round(pct),
                            scaledScore: sub.scaled_score || sub.math_scaled_score || sub.reading_scaled_score || 200,
                            correct: cCount,
                            incorrect: iCount,
                            questions: qCount,
                            timeSpent: duration
                        });

                        dom.attemptsCount++;
                        dom.totalQ += qCount;
                        dom.correct += cCount;
                        dom.incorrect += iCount;
                        dom.totalTime += duration;
                        dom.sumScore += pct;

                        totalQ += qCount;
                        totalCorrect += cCount;
                        totalIncorrect += iCount;
                        totalTime += duration;
                        scoreSum += pct;
                        break;
                    }
                }
            }
        });

        // 5. Format domains list for section view
        const domains = Object.values(domainsOutputMap).map(dom => {
            const subtopicsList = Object.values(dom.subtopicsMap).map(st => ({
                ...st,
                accuracy: st.totalQ > 0 ? Math.round((st.correct / st.totalQ) * 100) : 0,
                averageScore: st.attemptsCount > 0 ? Math.round(st.sumScore / st.attemptsCount) : 0
            }));

            return {
                name: dom.name,
                section: dom.section,
                subtopicsCount: subtopicsList.length,
                subtopics: subtopicsList,
                attemptsCount: dom.attemptsCount,
                totalQ: dom.totalQ,
                correct: dom.correct,
                incorrect: dom.incorrect,
                totalTime: dom.totalTime,
                accuracy: dom.totalQ > 0 ? Math.round((dom.correct / dom.totalQ) * 100) : 0,
                averageScore: dom.attemptsCount > 0 ? Math.round(dom.sumScore / dom.attemptsCount) : 0
            };
        });

        const numSubs = submissions.length;

        return {
            overview: {
                courseName: courseCategoryName,
                testsCompleted: numSubs,
                overallAccuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
                averageScore: numSubs > 0 ? Math.round(scoreSum / numSubs) : 0,
                totalQuestions: totalQ,
                correct: totalCorrect,
                incorrect: totalIncorrect,
                totalTime
            },
            domains,
            topics: domains // backward compatibility helper
        };
    },

    /**
     * LEVEL 3.5: TOPIC COMBINED ANALYTICS (SAT Regular Course)
     */
    async getTopicCombinedReport(groupId, studentId, courseId) {
        // course, submissions, and the student's profile are all independent of each other -
        // fetch concurrently instead of as separate sequential round-trips (the profile fetch
        // in particular used to happen last, at the very end of this function, for no reason).
        const [courseRes, submissionsRes, profileRes] = await Promise.all([
            supabase.from('courses').select('name, category').eq('id', courseId).single(),
            supabase
                .from('test_submissions')
                .select('id, level, raw_score_percentage, scaled_score, total_questions, correct_questions, incorrect_questions, test_duration_seconds, created_at, math_scaled_score, reading_scaled_score, metadata')
                .eq('user_id', studentId)
                .eq('course_id', courseId)
                .order('created_at', { ascending: true }), // chronological
            supabase.from('profiles').select('name').eq('id', studentId).single()
        ]);

        const course = courseRes.data;
        const submissions = submissionsRes.data;
        const profile = profileRes.data;

        if (!course) throw new Error('Course not found');
        const courseName = course.category || course.name;
        const topicName = course.name;

        const levels = {
            Easy: { submissions: [], latest: null, totalQ: 0, correct: 0, incorrect: 0, unanswered: 0, timeSpent: 0, questions: [], score: 0, scaledScore: 200, passStatus: 'N/A' },
            Medium: { submissions: [], latest: null, totalQ: 0, correct: 0, incorrect: 0, unanswered: 0, timeSpent: 0, questions: [], score: 0, scaledScore: 200, passStatus: 'N/A' },
            Hard: { submissions: [], latest: null, totalQ: 0, correct: 0, incorrect: 0, unanswered: 0, timeSpent: 0, questions: [], score: 0, scaledScore: 200, passStatus: 'N/A' }
        };

        const attemptHistory = [];
        let highestAccuracy = 0;

        // Populate attempts
        submissions?.forEach(sub => {
            const rawLevel = sub.level || 'Medium';
            const level = rawLevel.charAt(0).toUpperCase() + rawLevel.slice(1).toLowerCase();
            
            if (levels[level]) {
                levels[level].submissions.push(sub);
                levels[level].latest = sub; // will end up being the last one due to ascending order
            }

            attemptHistory.push({
                attemptNumber: attemptHistory.length + 1,
                date: sub.created_at,
                level: level,
                score: Math.round(sub.raw_score_percentage || 0),
                scaledScore: sub.scaled_score || Math.round(200 + ((sub.raw_score_percentage || 0) / 100) * 600),
                timeSpent: sub.test_duration_seconds || 0
            });
        });

        // Compute level stats from latest submission of each level
        const promises = [];
        for (const [lvl, data] of Object.entries(levels)) {
            if (data.latest) {
                const sub = data.latest;
                data.totalQ = sub.total_questions || 0;
                data.correct = sub.correct_questions?.length || 0;
                data.incorrect = sub.incorrect_questions?.length || 0;
                data.timeSpent = sub.test_duration_seconds || 0;
                data.date = sub.created_at;
                
                // Fetch questions for this latest submission
                promises.push(this.getAttemptQuestions(sub.id).then(qs => {
                    data.questions = qs.map(q => ({ ...q, section: lvl }));
                    if (data.totalQ === 0) data.totalQ = qs.length;
                    if (data.correct === 0) data.correct = qs.filter(q => q.isCorrect).length;
                    if (data.incorrect === 0) data.incorrect = qs.filter(q => !q.isCorrect && q.studentAnswer !== 'Not recorded' && q.studentAnswer !== 'Unattempted').length;
                    data.unanswered = qs.filter(q => q.studentAnswer === 'Not recorded' || q.studentAnswer === 'Unattempted' || q.isCorrect === null).length;
                    
                    data.score = data.totalQ > 0 ? Math.round((data.correct / data.totalQ) * 100) : Math.round(sub.raw_score_percentage || 0);
                    data.scaledScore = sub.scaled_score || Math.round(200 + (data.score / 100) * 600);
                    data.passStatus = data.score >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';
                    
                    if (data.score > highestAccuracy) highestAccuracy = data.score;
                }));
            }
        }
        
        await Promise.all(promises);

        // Compute Overall Stats across Easy + Medium + Hard
        const overall = {
            totalQuestions: 0,
            correct: 0,
            incorrect: 0,
            unanswered: 0,
            totalTime: 0,
            accuracy: 0,
            avgTimePerQuestion: 0,
            totalScore: 0,
            scaledScore: 200,
            displayScoreText: '200 / 800'
        };

        let activeLevels = 0;
        let latestDate = null;
        let subskills = {};
        let combinedResponses = [];

        for (const [lvl, data] of Object.entries(levels)) {
            if (data.latest) {
                activeLevels++;
                overall.totalQuestions += data.totalQ;
                overall.correct += data.correct;
                overall.incorrect += data.incorrect;
                overall.unanswered += data.unanswered;
                overall.totalTime += data.timeSpent;
                
                if (!latestDate || new Date(data.date) > new Date(latestDate)) {
                    latestDate = data.date;
                }

                combinedResponses = combinedResponses.concat(data.questions);

                // Gather subskills from questions
                data.questions.forEach(q => {
                    const subtopic = q.topic || topicName;
                    if (!subskills[subtopic]) subskills[subtopic] = { correct: 0, total: 0, questions: [] };
                    subskills[subtopic].total++;
                    if (q.isCorrect) subskills[subtopic].correct++;
                    subskills[subtopic].questions.push(q);
                });
            }
        }

        if (overall.totalQuestions > 0) {
            overall.accuracy = Math.round((overall.correct / overall.totalQuestions) * 100);
            overall.avgTimePerQuestion = Math.round(overall.totalTime / overall.totalQuestions);
            // SAT Scaled Score (200-800 scale) based on total correct out of total questions
            overall.scaledScore = Math.round(200 + (overall.correct / overall.totalQuestions) * 600);
        } else {
            overall.accuracy = 0;
            overall.avgTimePerQuestion = 0;
            overall.scaledScore = 200;
        }

        overall.displayScoreText = `${overall.scaledScore} / 800`;
        overall.totalScore = overall.accuracy;

        // A topic is only "complete" once every required difficulty level has been attempted.
        // An overall combined score is not meaningful (and must not be shown as final) until then.
        const REQUIRED_LEVELS = ['Easy', 'Medium', 'Hard'];
        const missingLevels = REQUIRED_LEVELS.filter(lvl => !levels[lvl]?.latest);
        const isFullyCompleted = missingLevels.length === 0;

        if (!isFullyCompleted) {
            overall.accuracy = null;
            overall.scaledScore = null;
            overall.displayScoreText = null;
            overall.totalScore = null;
        }

        // Build subskill array and find strengths/weaknesses
        const subskillPerformance = Object.entries(subskills).map(([topic, stats]) => ({
            topic,
            correct: stats.correct,
            total: stats.total,
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            questions: stats.questions
        })).sort((a, b) => b.accuracy - a.accuracy);

        let strengths = subskillPerformance.filter(s => s.accuracy >= 70).map(s => `${s.topic} (${s.accuracy}%)`);
        let weaknesses = subskillPerformance.filter(s => s.accuracy < 70).map(s => `${s.topic} (${s.accuracy}%)`);
        
        if (strengths.length === 0 && subskillPerformance.length > 0) {
            strengths = [subskillPerformance[0].topic + ` (${subskillPerformance[0].accuracy}%)`];
        }

        return {
            studentName: profile?.name || 'Student',
            courseName: courseName,
            topicName: topicName,
            category: course.category,
            date: latestDate,
            levels,
            overall,
            combinedResponses,
            subskillPerformance,
            strengths,
            weaknesses,
            attemptHistory,
            activeLevels: Object.keys(levels).filter(l => levels[l].latest).map(l => l),
            isFullyCompleted,
            missingLevels
        };
    },

    /**
     * LEVEL 5 & 6: INDIVIDUAL ATTEMPT & QUESTION-WISE
     */
    async getAttemptAnalytics(submissionId) {
        // The submission record and its questions both only depend on submissionId (not on
        // each other), so fetch them concurrently instead of one after another.
        const [subRes, questions] = await Promise.all([
            supabase
                .from('test_submissions')
                .select('id, user_id, course_id, level, raw_score_percentage, scaled_score, total_questions, correct_questions, incorrect_questions, test_duration_seconds, created_at, metadata, weak_topics, strong_topics, math_scaled_score, reading_scaled_score, course:courses(name, category, tutor_type, is_adaptive, main_category)')
                .eq('id', submissionId)
                .single(),
            this.getAttemptQuestions(submissionId)
        ]);
        const sub = subRes.data;

        if (!sub) throw new Error('Attempt not found');

        // This one genuinely depends on sub.user_id, so it can't join the Promise.all above.
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', sub.user_id).single();

        // Group questions by topic to calculate dynamic performance
        const topicMap = {};
        let unansweredCount = 0;

        questions.forEach((q, idx) => {
            const topic = q.topic || 'General';
            if (!topicMap[topic]) {
                topicMap[topic] = { topicName: topic, total: 0, correct: 0, incorrect: 0, unanswered: 0, questions: [] };
            }
            
            topicMap[topic].total++;
            // Attach a display index to each question for the UI
            const enrichedQ = { ...q, displayIndex: idx + 1 };
            topicMap[topic].questions.push(enrichedQ);

            if (q.isCorrect === true) {
                topicMap[topic].correct++;
            } else if (q.isCorrect === false) {
                topicMap[topic].incorrect++;
            } else {
                topicMap[topic].unanswered++;
                unansweredCount++;
            }
        });

        // Calculate accuracy and sort topics
        const topicPerformance = Object.values(topicMap).map(t => ({
            ...t,
            accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
        })).sort((a, b) => b.accuracy - a.accuracy);

        // Calculate dynamic strengths and weaknesses
        // Only consider topics with at least 1 question
        const validTopics = topicPerformance.filter(t => t.total > 0);
        let strengths = [];
        let weaknesses = [];
        
        if (validTopics.length > 0) {
            // Take top 3 for strengths (accuracy >= 60%)
            strengths = validTopics.filter(t => t.accuracy >= 60).slice(0, 3).map(t => `${t.topicName} (${t.accuracy}%)`);
            // Take bottom 3 for weaknesses (accuracy < 60%)
            weaknesses = [...validTopics].reverse().filter(t => t.accuracy < 60).slice(0, 3).map(t => `${t.topicName} (${t.accuracy}%)`);
        }

        // Use DB stored strengths/weaknesses if available and dynamic calculation is empty
        if (strengths.length === 0 && sub.strong_topics?.length > 0) strengths = sub.strong_topics;
        if (weaknesses.length === 0 && sub.weak_topics?.length > 0) weaknesses = sub.weak_topics;

        return {
            studentName: profile?.name,
            // Lets the caller decide which report component to render (the Full-Length/adaptive
            // report vs. the regular topic-quiz report) the same way StudentCourseList.jsx's own
            // isTest check does - without this, every attempt was forced into the regular report.
            course: {
                isAdaptive: !!sub.course?.is_adaptive,
                category: sub.course?.category || '',
                tutorType: sub.course?.tutor_type || '',
                mainCategory: sub.course?.main_category || '',
                name: sub.course?.name || ''
            },
            attempt: {
                id: sub.id,
                date: sub.created_at,
                courseName: sub.course?.name || 'Unknown',
                category: sub.course?.category || 'Unknown',
                level: sub.level,
                score: Math.round(sub.raw_score_percentage || 0),
                scaledScore: sub.scaled_score,
                mathScaled: sub.math_scaled_score,
                readingScaled: sub.reading_scaled_score,
                totalQuestions: sub.total_questions || 0,
                correct: sub.correct_questions?.length || 0,
                incorrect: sub.incorrect_questions?.length || 0,
                unanswered: unansweredCount,
                timeSpent: sub.test_duration_seconds || 0,
                strengths: strengths,
                weaknesses: weaknesses,
                metadata: sub.metadata || {}
            },
            topicPerformance,
            questions // All questions flat array (useful for pagination/navigation if needed)
        };
    },

    async getAttemptQuestions(submissionId) {
        // Join test_responses with questions
        const { data: responses } = await supabase
            .from('test_responses')
            .select('question_id, selected_answer, is_correct, question:questions(question, options, correct_answer, explanation, topic, difficulty_weight)')
            .eq('submission_id', submissionId);

        if (!responses) return [];

        return responses.map(r => ({
            questionId: r.question_id,
            studentAnswer: r.selected_answer,
            isCorrect: r.is_correct,
            questionText: r.question?.question || 'Question text not available',
            options: r.question?.options || [],
            correctAnswer: r.question?.correct_answer || 'N/A',
            explanation: r.question?.explanation || 'No explanation available',
            topic: r.question?.topic || 'General',
            difficulty: r.question?.difficulty_weight === 3 ? 'Hard' : r.question?.difficulty_weight === 2 ? 'Medium' : 'Easy',
            timeTaken: 'N/A' // DB doesn't track per-question time currently
        }));
    }
};
