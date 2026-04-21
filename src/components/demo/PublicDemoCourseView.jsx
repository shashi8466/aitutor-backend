import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService } from '../../services/api';

const { FiLock, FiPlay, FiCheckCircle, FiShield, FiAward, FiInfo, FiLoader, FiZap } = FiIcons;

const PublicDemoCourseView = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [uploads, setUploads] = useState([]);
    const [demoProgress, setDemoProgress] = useState({
        easy: { passed: false },
        medium: { passed: false },
        hard: { passed: false }
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDemoCourse();
        // Load progress from localStorage
        const savedProgress = localStorage.getItem(`demo_progress_${courseId}`);
        if (savedProgress) {
            try {
                setDemoProgress(JSON.parse(savedProgress));
            } catch (e) {
                console.error("Failed to load demo progress", e);
            }
        }
    }, [courseId]);

    const loadDemoCourse = async () => {
        setLoading(true);
        try {
            console.log("Loading demo course", courseId);
            const courseRes = await courseService.getById(courseId);
            
            if (!courseRes || !courseRes.data) {
                setError("Course not found.");
                return;
            }

            if (!courseRes.data.is_demo) {
                setError("This course is not available in demo mode.");
                return;
            }

            let uploadsData = [];
            try {
                const uploadsRes = await uploadService.getAll({ courseId });
                uploadsData = uploadsRes.data || [];
            } catch (uErr) {
                console.warn("Could not fetch uploads, using empty array", uErr);
            }

            setCourse(courseRes.data);
            setUploads(uploadsData);
        } catch (err) {
            console.error("Error loading demo course:", err);
            // Log specific error for debugging
            setError(`Failed to load the demo course. (${err.message || 'Unknown'})`);
        } finally {
            setLoading(false);
        }
    };

    const isLevelUnlocked = (level) => {
        if (level === 'Easy') return true;
        if (level === 'Medium') return demoProgress.easy.passed;
        if (level === 'Hard') return demoProgress.medium.passed;
        return false;
    };

    const getTopicsForLevel = (level) => {
        const files = uploads.filter(u => u.level === level && u.category === 'study_material');
        if (files.length === 0) return ['General Concepts'];
        return files.map(f => f.file_name.replace(/\.[^/.]+$/, ''));
    };

    if (loading) return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center">
            <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935] mb-4" />
            <p className="font-bold text-gray-500 animate-pulse">Launching Public Demo...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center p-8 text-center">
            <SafeIcon icon={FiShield} className="w-16 h-16 text-gray-300 mb-4" />
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2 uppercase italic">Access Restricted</h1>
            <p className="text-gray-500 max-w-md">{error}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 font-sans transition-colors duration-200">
            {/* Direct Header - No Navigation Sidebar */}
            <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 p-6 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#E53935] rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-100 dark:shadow-none">
                            <SafeIcon icon={FiZap} className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tighter">AIPrep365 <span className="text-[#E53935]">DEMO</span></span>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full">
                        <SafeIcon icon={FiShield} className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Public Access Enabled</span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-12">
                <div className="text-center mb-12">
                   <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter italic">
                            {course.name}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium max-w-2xl mx-auto">
                            Experience our adaptive test engine. Complete each level to reveal your estimated SAT performance.
                        </p>
                   </motion.div>
                </div>

                {/* Score Placeholder - Always Locked for Demo User */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-12 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-10 rounded-[30px] shadow-2xl border border-gray-800 text-center relative overflow-hidden"
                >
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Predicted Score Calculation</span>
                        </div>

                        <div className="inline-block bg-white/5 backdrop-blur-xl p-8 px-12 rounded-[24px] border border-white/10 transform hover:scale-105 transition-transform cursor-default shadow-2xl">
                            <div className="text-lg md:text-xl font-black text-gray-400 uppercase tracking-tight py-2 flex items-center gap-3">
                                <SafeIcon icon={FiLock} className="w-5 h-5 text-[#E53935]" />
                                Complete All Levels to Unlock
                            </div>
                        </div>
                        
                    </div>

                    <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                        <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-[#E53935] rounded-full blur-[120px]"></div>
                        <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-blue-600 rounded-full blur-[100px]"></div>
                    </div>
                </motion.div>

                <div className="space-y-6">
                    {['Easy', 'Medium', 'Hard'].map((level, index) => {
                        const topics = getTopicsForLevel(level);
                        const unlocked = isLevelUnlocked(level);
                        const isCompleted = demoProgress[level.toLowerCase()].passed;

                        const levelStyles = {
                            Easy: { bg: 'bg-white', border: 'border-green-200', accent: 'bg-green-600', text: 'text-green-600' },
                            Medium: { bg: 'bg-white', border: 'border-orange-200', accent: 'bg-orange-500', text: 'text-orange-500' },
                            Hard: { bg: 'bg-white', border: 'border-red-200', accent: 'bg-[#E53935]', text: 'text-[#E53935]' }
                        };
                        const style = levelStyles[level];

                        return (
                            <motion.div
                                key={level}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                className={`rounded-[24px] border ${style.bg} dark:bg-gray-900 ${unlocked ? style.border : 'border-gray-100 dark:border-gray-800'} p-8 shadow-sm hover:shadow-xl transition-all relative ${!unlocked ? 'opacity-60 grayscale' : ''}`}
                            >
                                {!unlocked && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/20 dark:bg-transparent backdrop-blur-[1px] rounded-[24px]">
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-2xl border border-gray-100 dark:border-gray-700">
                                            <SafeIcon icon={FiLock} className="w-6 h-6 text-gray-300" />
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className={`w-14 h-14 rounded-2xl ${style.accent} flex items-center justify-center font-black text-white text-2xl shadow-lg flex-shrink-0`}>
                                        {index + 1}
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-4 italic">
                                            {level} Difficulty
                                        </h3>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {topics.map((topic, i) => (
                                                <div key={i} className="flex items-center gap-3 text-gray-600 dark:text-gray-400 font-bold text-sm">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${style.accent}`} />
                                                    <span className="truncate">{topic}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center md:items-end gap-3 w-full md:w-auto">
                                        {isCompleted && (
                                            <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border border-green-100 dark:border-green-800 shadow-sm">
                                                <SafeIcon icon={FiCheckCircle} className="w-3.5 h-3.5" /> Completed
                                            </div>
                                        )}
                                        <button
                                            onClick={() => unlocked && navigate(`/demo/${courseId}/level/${level.toLowerCase()}`)}
                                            disabled={!unlocked}
                                            className={`w-full md:w-auto px-10 py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest shadow-xl transition-all group ${
                                                unlocked 
                                                ? 'bg-black text-white hover:bg-[#E53935] transform hover:-translate-y-1' 
                                                : 'bg-gray-100 text-gray-300 dark:bg-gray-800 dark:text-gray-700'
                                            }`}
                                        >
                                            <SafeIcon icon={FiPlay} className={`w-4 h-4 ${unlocked ? 'group-hover:animate-ping' : ''}`} />
                                            {isCompleted ? `Retake ${level}` : `Start ${level}`}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

            </main>

            <footer className="bg-white dark:bg-gray-950 py-12 border-t border-gray-100 dark:border-gray-900 text-center">
                <p className="text-gray-400 dark:text-gray-600 text-xs font-bold uppercase tracking-widest">
                    AIPrep365 &copy; 2026 • Premium Adaptive Test Experience
                </p>
            </footer>
        </div>
    );
};

export default PublicDemoCourseView;
