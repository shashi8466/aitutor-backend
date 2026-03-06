import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';
import EnrollmentKeyInput from './EnrollmentKeyInput';

const { FiActivity, FiClock, FiPlay, FiBookOpen, FiArrowRight } = FiIcons;

const PracticeTests = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tests, setTests] = useState([]);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) loadPracticeTests();
    }, [user]);

    const loadPracticeTests = async () => {
        try {
            setLoading(true);
            // 1. Get ALL practice courses
            const { data: allPracticeCourses } = await supabase
                .from('courses')
                .select('*')
                .eq('is_practice', true);

            // 2. Get student's enrolled course IDs
            const { data: enrollments } = await enrollmentService.getStudentEnrollments(user.id);
            const enrolledIds = (enrollments || []).map(e => e.course_id);

            // 3. Filter into Enrolled and Available
            const enrolledPractice = (allPracticeCourses || []).filter(c => enrolledIds.includes(c.id));
            const notEnrolledPractice = (allPracticeCourses || []).filter(c => !enrolledIds.includes(c.id));

            setAvailableCourses(notEnrolledPractice);

            // 4. Fetch uploads for enrolled courses (including manual is_practice uploads)
            if (enrolledIds.length > 0) {
                let query = supabase
                    .from('uploads')
                    .select(`
                                id, 
                                course_id, 
                                level, 
                                questions_count, 
                                created_at,
                                courses:course_id(name)
                            `)
                    .in('course_id', enrolledIds)
                    .in('status', ['completed', 'warning'])
                    .order('created_at', { ascending: false });

                const practiceCourseIds = enrolledPractice.map(c => c.id);
                if (practiceCourseIds.length > 0) {
                    query = query.or(`is_practice.eq.true,course_id.in.(${practiceCourseIds.join(',')})`);
                } else {
                    query = query.eq('is_practice', true);
                }

                const { data: uploads, error } = await query;
                if (error) throw error;
                setTests(uploads || []);
            } else {
                setTests([]);
            }
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

            {tests.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <SafeIcon icon={FiPlay} className="text-[#E53935]" />
                        Active Practice Exams
                    </h2>
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
                                        {test.level || 'All Levels'}
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
                                        onClick={() => navigate(`/student/course/${test.course_id}/level/${(test.level || 'all').toLowerCase()}/quiz`)}
                                        className="flex items-center gap-1 text-sm font-bold text-[#E53935] hover:gap-2 transition-all"
                                    >
                                        Start Test <SafeIcon icon={FiArrowRight} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {availableCourses.length > 0 && (
                <div className="space-y-6 pt-8">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <SafeIcon icon={FiBookOpen} className="text-blue-500" />
                        Available Practice Courses
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {availableCourses.map((course) => (
                            <div key={course.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 p-8 rounded-3xl border border-blue-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4">
                                    <SafeIcon icon={FiActivity} className="w-12 h-12 text-blue-200/50 group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{course.name}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">{course.description || 'Unlock advanced practice materials for this course.'}</p>

                                    <EnrollmentKeyInput onSuccess={loadPracticeTests} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tests.length === 0 && availableCourses.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                        <SafeIcon icon={FiActivity} className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No Practice Content Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                        Your tutors haven't assigned any practice tests to your account yet. Check back soon!
                    </p>
                </div>
            )}

        </div>
    );
};

export default PracticeTests;
