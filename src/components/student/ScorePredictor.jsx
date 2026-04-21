import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService, gradingService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateSatScore } from '../../utils/scoreCalculator';

const {
    FiZap, FiArrowRight, FiBook, FiActivity, FiTarget,
    FiTrendingUp, FiCheckCircle, FiXCircle, FiInfo, FiLoader,
    FiAward, FiPieChart, FiBarChart2, FiRotateCcw
} = FiIcons;

const SAT_TOPICS = {
    RW: [
        "Craft and Structure", "Information and Ideas", "Standard English Conventions",
        "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
        "Central Ideas and Details", "Text Structure", "Purpose"
    ],
    MATH: [
        "Algebra", "Advanced Math", "Linear equations in one variable", 
        "Linear equations in two variables", "Linear functions", "Systems of two linear equations", 
        "Linear inequalities", "Nonlinear functions", "Quadratic equations", 
        "Exponential functions", "Polynomials", "Radicals", "Rational exponents", 
        "Problem-Solving and Data Analysis", "Ratios, rates, proportional relationships", 
        "Percentages", "One-variable data", "Two-variable data", "Probability", 
        "Conditional probability", "Inference from sample statistics", 
        "Evaluating statistical claims", "Geometry and Trigonometry", "Area and volume", 
        "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles", 
        "Equivalent expressions", "Nonlinear equations in one variable and systems of equations in two variables"
    ]
};

const ScorePredictor = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [subjectData, setSubjectData] = useState({
        RW: { attempted: false, prediction: null, course: null },
        MATH: { attempted: false, prediction: null, course: null }
    });
    const [isPremium, setIsPremium] = useState(false);
    const [featureEnabled, setFeatureEnabled] = useState(true);

    useEffect(() => {
        if (user) {
            loadAllPredictions();
        }
    }, [user]);

    const loadAllPredictions = async () => {
        try {
            setLoading(true);
            const [enrollmentsRes, allScoresRes, settingsRes] = await Promise.all([
                enrollmentService.getStudentEnrollments(user.id),
                gradingService.getAllMyScores(),
                planService.getSettings()
            ]);

            const currentPlan = user?.plan_type || 'free';
            const currentSettings = (settingsRes.data || []).find(s => s.plan_type === currentPlan);
            setFeatureEnabled(currentSettings?.feature_score_predictor !== false);
            setIsPremium(currentPlan === 'premium' && user?.plan_status === 'active');

            const enrolledCourses = enrollmentsRes.data || [];
            const submissions = allScoresRes.data.submissions || [];

            // Identify best courses for each category (prioritizing those with attempts)
            const categories = { RW: null, MATH: null };
            
            const mathCandidates = enrolledCourses.filter(e => {
                const type = (e.courses?.tutor_type || '').toLowerCase();
                const name = (e.courses?.name || '').toLowerCase();
                return type.includes('math') || type.includes('quant') || name.includes('math');
            });
            
            const rwCandidates = enrolledCourses.filter(e => {
                const type = (e.courses?.tutor_type || '').toLowerCase();
                const name = (e.courses?.name || '').toLowerCase();
                return type.includes('reading') || type.includes('writing') || type.includes('verbal') || 
                       type.includes('rw') || type.includes('r&w') || type.includes('r & w') ||
                       name.includes('english') || name.includes('reading') || name.includes('writing') || 
                       name.includes('literacy') || name.includes('verbal') || name.includes('r&w') || name.includes('r & w');
            });

            // For each category, pick the candidate that has the latest submission
            [
                { candidates: mathCandidates, cat: 'MATH' },
                { candidates: rwCandidates, cat: 'RW' }
            ].forEach(({ candidates, cat }) => {
                if (candidates.length === 0) return;
                
                // Sort candidates by latest submission date or just pick first if none
                const sorted = [...candidates].sort((a, b) => {
                    const latestA = submissions.find(s => Number(s.course_id) === Number(a.courses?.id))?.test_date || 0;
                    const latestB = submissions.find(s => Number(s.course_id) === Number(b.courses?.id))?.test_date || 0;
                    if (latestA && !latestB) return -1;
                    if (!latestA && latestB) return 1;
                    return new Date(latestB) - new Date(latestA);
                });
                
                categories[cat] = sorted[0].courses;
            });

            // Prepare and load predictions for each category
            const updatedData = {
                RW: { attempted: false, prediction: null, course: categories.RW },
                MATH: { attempted: false, prediction: null, course: categories.MATH }
            };

            for (const cat of ['RW', 'MATH']) {
                const targetCourse = categories[cat];
                if (!targetCourse) continue;

                // Filter submissions strictly for this identified course
                const catSubmissions = submissions.filter(s => Number(s.course_id) === Number(targetCourse.id));

                if (catSubmissions.length > 0) {
                    updatedData[cat].attempted = true;
                    
                    const levelScores = { Easy: 0, Medium: 0, Hard: 0 };
                    catSubmissions.forEach(sub => {
                        const lvl = (sub.level || 'Medium').charAt(0).toUpperCase() + (sub.level || 'Medium').slice(1).toLowerCase();
                        if (!['Easy', 'Medium', 'Hard'].includes(lvl)) return;
                        
                        // Use specific subject percentage if available, otherwise fallback to raw
                        let sPct = cat === 'MATH' ? sub.math_percentage : (sub.reading_percentage || sub.writing_percentage || sub.rw_percentage);
                        let val = sPct || sub.raw_score_percentage || sub.raw_percentage || sub.percentage || 0;
                        
                        // Handle 0-1 range vs 0-100 range
                        if (val > 0 && val <= 1) val = val * 100;
                        
                        const pct = Math.round(val);
                        if (pct > levelScores[lvl]) {
                            levelScores[lvl] = pct;
                        }
                    });

                    // 🟢 Calculate Predicted SAT Score (Weighted)
                    let predictedScore = calculateSatScore(levelScores.Easy, levelScores.Medium, levelScores.Hard);
                    
                    
                    const latest = catSubmissions[0];
                    try {
                        const detail = await gradingService.getSubmission(latest.id);
                        const subDetail = detail.data.submission;
                        
                        // 🟢 Fetch valid topics for this course to filter out irrelevant ones
                        const [uploadsResponse] = await Promise.all([
                            uploadService.getAll({ courseId: latest.course_id }).catch(() => ({ data: [] }))
                        ]);
                        
                        // Combine course study materials with global SAT standards for this category
                        const courseTopics = uploadsResponse.data
                            .filter(u => u.category === 'study_material')
                            .map(f => f.file_name.replace(/\.[^/.]+$/, '').toUpperCase().trim());
                        
                        const globalTopics = (SAT_TOPICS[cat] || []).map(t => t.toUpperCase().trim());
                        
                        const topicStats = {};
                        
                        // 🟢 Step 1: Pre-populate with all standard SAT topics for this category (for the full list view)
                        globalTopics.forEach(t => {
                            topicStats[t] = { correct: 0, total: 0 };
                        });
                        
                        // 🟢 Step 2: Add course-specific topics from uploads
                        courseTopics.forEach(t => {
                            if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 };
                        });

                        (subDetail.correct_responses || []).forEach(r => {
                            const rawT = r.topic || r.question?.topic || r.subject || r.question?.subject || 
                                          (r.question_text?.includes(')') ? r.question_text.split(')')[0].replace(/Q\.\d+/, '').trim() : null) || 
                                          'General';
                            
                            const parts = rawT.split(/[>:]/);
                            const t = parts[parts.length - 1].trim().toUpperCase();
                            if (t === 'UNKNOWN' || t === '' || t.includes('QUESTION')) return;
                            
                            if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 };
                            topicStats[t].total++;
                            topicStats[t].correct++;
                        });

                        (subDetail.incorrect_responses || []).forEach(r => {
                            const rawT = r.topic || r.question?.topic || r.subject || r.question?.subject || 
                                          (r.question_text?.includes(')') ? r.question_text.split(')')[0].replace(/Q\.\d+/, '').trim() : null) || 
                                          'General';
                            
                            const parts = rawT.split(/[>:]/);
                            const t = parts[parts.length - 1].trim().toUpperCase();
                            if (t === 'UNKNOWN' || t === '' || t.includes('QUESTION')) return;
                            
                            if (!topicStats[t]) topicStats[t] = { correct: 0, total: 0 };
                            topicStats[t].total++;
                        });

                        updatedData[cat].prediction = {
                            score: predictedScore,
                            levelScores,
                            topicStats,
                            latestId: latest.id
                        };
                    } catch (e) {
                        console.error(`Failed to fetch details for ${cat}`, e);
                        updatedData[cat].prediction = { score: predictedScore, levelScores, topicStats: {} };
                    }
                }
            }

            setSubjectData(updatedData);
        } catch (err) {
            console.error('Failed to load score predictor:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <SafeIcon icon={FiLoader} className="w-8 h-8 text-[#E53935] animate-spin" />
            </div>
        );
    }
    if (!featureEnabled) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-20 text-center space-y-8">
                <div className="w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-3xl flex items-center justify-center mx-auto text-red-600 shadow-xl shadow-red-500/10">
                    <SafeIcon icon={FiIcons.FiShield} className="w-12 h-12" />
                </div>
                <div className="max-w-xl mx-auto space-y-4">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white">Premium Analysis Required</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                        The Score Predictor uses advanced statistical modeling to estimate your SAT results. This feature is exclusive to our Premium students.
                    </p>
                    <div className="pt-6">
                        <button 
                            onClick={() => navigate('/student/upgrade')}
                            className="px-10 py-5 bg-[#E53935] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/20 hover:scale-105 transition-all"
                        >
                            <SafeIcon icon={FiIcons.FiZap} className="inline mr-2" /> Unlock Predictor & Analytics
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    const sortedSubjects = [
        { 
            id: 'RW', 
            name: 'Reading & Writing', 
            icon: FiBook, 
            desc: 'Analyze your verbal skills and predict your section score.', 
            color: 'purple', 
            text: 'text-purple-600', 
            bg: 'bg-purple-100 dark:bg-purple-900/30', 
            hover: 'hover:border-purple-500', 
            hoverBg: 'group-hover:bg-purple-600' 
        },
        { 
            id: 'MATH', 
            name: 'Mathematics', 
            icon: FiTarget, 
            desc: 'Check your quant proficiency and estimated SAT Math score.', 
            color: 'blue', 
            text: 'text-blue-600', 
            bg: 'bg-blue-100 dark:bg-blue-900/30', 
            hover: 'hover:border-blue-500', 
            hoverBg: 'group-hover:bg-blue-600' 
        }
    ].sort((a, b) => {
        const aAtt = subjectData[a.id].attempted;
        const bAtt = subjectData[b.id].attempted;
        if (aAtt && !bAtt) return -1;
        if (!aAtt && bAtt) return 1;
        return 0;
    });

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-5xl font-black text-gray-900 dark:text-white mb-4 tracking-tight">Score Predictor</h1>
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
                    Your personalized SAT section performance analysis and score predictions.
                </p>
            </div>

            <div className="space-y-24">
                {sortedSubjects.map((subject) => {
                    const data = subjectData[subject.id];
                    if (data.attempted && data.prediction) {
                        return (
                            <motion.div
                                key={subject.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-10"
                            >
                                <div className="flex items-center gap-3 px-4">
                                    <div className={`w-2 h-8 rounded-full ${subject.id === 'MATH' ? 'bg-blue-600' : 'bg-purple-600'}`} />
                                    <h2 className="text-3xl font-black text-gray-900 dark:text-white">{subject.name} Result</h2>
                                    <span className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">Attempted</span>
                                </div>
                                
                                {/* Result Card */}
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-black dark:to-gray-900 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/10">
                                    <div className={`absolute top-0 right-0 w-64 h-64 ${subject.id === 'MATH' ? 'bg-blue-600/10' : 'bg-purple-600/10'} blur-[100px] rounded-full -mr-20 -mt-20`} />
                                    
                                    <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                                        <div className="flex items-center gap-8 text-center lg:text-left flex-col lg:flex-row">
                                            <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-2xl transform rotate-3 ${subject.id === 'MATH' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-purple-600 shadow-purple-500/20'} text-white`}>
                                                <SafeIcon icon={subject.icon} className="w-14 h-14" />
                                            </div>
                                            <div>
                                                <h3 className="text-4xl font-black text-white tracking-tight">Predicted Score</h3>
                                                <p className="text-gray-400 font-medium mt-1 text-lg">Based on diagnostic performance and accuracy trends</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-10 bg-white/5 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 w-full lg:w-auto">
                                            <div className="text-center px-4">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Estimated Section</p>
                                                <div className="flex items-baseline justify-center gap-1">
                                                    <p className={`text-7xl font-black ${subject.id === 'MATH' ? 'text-blue-400' : 'text-purple-400'}`}>
                                                        {data.prediction.score}
                                                    </p>
                                                    <span className="text-gray-500 font-bold text-xl">/ 800</span>
                                                </div>
                                            </div>
                                            <div className="h-16 w-px bg-white/10 hidden sm:block" />
                                            <div className="text-center px-4 font-bold">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Accuracy Level</p>
                                                <p className="text-2xl text-white">Calculated</p>
                                                <button 
                                                    onClick={() => navigate(data.course ? `/student/course/${data.course.id}` : '/student/courses')}
                                                    className={`mt-2 px-4 py-1.5 rounded-full text-[10px] font-bold border ${subject.id === 'MATH' ? 'border-blue-400 text-blue-400 hover:bg-blue-400' : 'border-purple-400 text-purple-400 hover:bg-purple-400'} hover:text-white transition-all uppercase tracking-widest`}
                                                >
                                                    Retake Test
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Stats: Module Proficiency Only (Topic Mastery Removed) */}
                                <div className="max-w-3xl mx-auto w-full">
                                    <div className="bg-white dark:bg-gray-800 p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-3 mb-8">
                                            <SafeIcon icon={FiBarChart2} className="w-7 h-7 text-[#E53935]" />
                                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">Module Proficiency</h3>
                                        </div>
                                        <div className="space-y-10">
                                            {['Easy', 'Medium', 'Hard'].map(level => {
                                                const score = data.prediction.levelScores[level] || 0;
                                                return (
                                                    <div key={level} className="flex items-center gap-8">
                                                        <div className="w-24">
                                                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-1">{level}</p>
                                                            <p className="text-xl font-black text-gray-900 dark:text-white">Level</p>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between mb-2">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mastery</span>
                                                                <span className="text-sm font-black text-gray-900 dark:text-white">{score}%</span>
                                                            </div>
                                                            <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden p-1 shadow-inner">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${score}%` }}
                                                                    className={`h-full rounded-full ${subject.id === 'MATH' ? 'bg-blue-500' : 'bg-purple-500'}`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    }

                    return (
                        <motion.div 
                            key={subject.id} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            <div className="flex items-center gap-3 px-4">
                                <div className="w-2 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                                <h2 className="text-3xl font-black text-gray-900 dark:text-white">{subject.name} Predictor</h2>
                                <span className="bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider">Unattempted</span>
                            </div>
                            <div className="max-w-4xl">
                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => navigate(data.course ? `/student/course/${data.course.id}` : '/student/courses')}
                                    className={`w-full bg-white dark:bg-gray-800 p-12 rounded-[3rem] shadow-xl border-2 border-transparent ${subject.hover} transition-all text-left flex flex-col md:flex-row items-center gap-12 group`}
                                >
                                    <div className={`w-28 h-28 ${subject.bg} rounded-[2rem] flex items-center justify-center ${subject.text} ${subject.hoverBg} group-hover:text-white transition-all transform group-hover:rotate-6 shadow-sm`}>
                                        <SafeIcon icon={subject.icon} className="w-14 h-14" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-4xl font-black text-gray-900 dark:text-white mb-3 tracking-tight">{subject.name}</h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-xl font-medium leading-relaxed">{subject.desc}</p>
                                        <div className={`mt-8 flex items-center gap-3 ${subject.text} font-black text-xl`}>
                                            Take Diagnostic Test <FiArrowRight className="group-hover:translate-x-3 transition-transform" />
                                        </div>
                                    </div>
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default ScorePredictor;
