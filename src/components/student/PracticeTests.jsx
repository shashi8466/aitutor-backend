import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const { FiActivity, FiClock, FiPlay, FiBookOpen, FiArrowRight } = FiIcons;

const PracticeTests = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) loadPracticeTests();
    }, [user]);

    const loadPracticeTests = async () => {
        try {
            setLoading(true);
            // 1. Get enrolled course IDs
            const { data: enrollments } = await enrollmentService.getStudentEnrollments(user.id);
            const courseIds = (enrollments || []).map(e => e.course_id);

            if (courseIds.length === 0) {
                setTests([]);
                setLoading(false);
                return;
            }

            // 2. Fetch 'quiz_document' uploads for these courses
            const { data: uploads, error } = await supabase
                .from('uploads')
                .select(`
                    id, 
                    course_id, 
                    level, 
                    questions_count, 
                    created_at,
                    courses:course_id(name)
                `)
                .eq('category', 'quiz_document')
                .in('course_id', courseIds)
                .in('status', ['completed', 'warning'])
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTests(uploads || []);
        } catch (error) {
            console.error("Failed to load practice tests", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-96">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-[#E53935] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Loading tests...</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-xl">
                        <SafeIcon icon={FiActivity} className="text-[#E53935]" />
                    </div>
                    Practice Tests
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Admin-curated tests to sharpen your SAT skills.</p>
            </div>

            {tests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tests.map((test, idx) => (
                        <motion.div
                            key={test.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-[#E53935]">
                                    <SafeIcon icon={FiBookOpen} className="w-5 h-5" />
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${test.level === 'Hard' ? 'bg-red-100 text-red-700' :
                                        test.level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                            'bg-green-100 text-green-700'
                                    }`}>
                                    {test.level}
                                </span>
                            </div>

                            <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 line-clamp-1">
                                {test.courses?.name || 'Classroom Test'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium mb-4">Questions: {test.questions_count || 0}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-400 text-xs">
                                    <SafeIcon icon={FiClock} className="w-3 h-3" />
                                    <span>{new Date(test.created_at).toLocaleDateString()}</span>
                                </div>
                                <button
                                    onClick={() => navigate(`/student/course/${test.course_id}/level/${test.level.toLowerCase()}/quiz`)}
                                    className="flex items-center gap-1 text-sm font-bold text-[#E53935] hover:gap-2 transition-all"
                                >
                                    Start Test <SafeIcon icon={FiArrowRight} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <SafeIcon icon={FiActivity} className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Practice Tests Available</h3>
                    <p className="text-gray-500 mt-1">Once your teacher uploads a full-length quiz, it will appear here.</p>
                </div>
            )}
        </div>
    );
};

export default PracticeTests;
