import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import Skeleton from './Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { gradingService, profileService } from '../../services/api';
import supabase from '../../supabase/supabase';

const { FiCalendar, FiArrowLeft, FiBarChart2, FiCheckCircle, FiClock, FiBook, FiChevronRight } = FiIcons;

const WeeklyReport = ({ isParentView = false }) => {
    const { weekStart, studentId: paramStudentId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState(null);
    const [reportData, setReportData] = useState({
        submissions: [],
        totalTests: 0,
        avgScore: 0,
        bestScore: 0,
        improvement: 0
    });

    const targetStudentId = isParentView ? paramStudentId : user?.id;

    useEffect(() => {
        if (targetStudentId && weekStart) {
            fetchReportData();
        }
    }, [targetStudentId, weekStart]);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Student Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('name, email')
                .eq('id', targetStudentId)
                .single();
            setStudent(profile);

            // 2. Resolve Week Range
            const startDate = new Date(weekStart);
            const endDate = new Date(startDate.getTime() + 7 * 86400000);

            // 3. Fetch Submissions for that week
            const { data: submissions, error } = await supabase
                .from('test_submissions')
                .select('*, courses:courses(name, id)')
                .eq('user_id', targetStudentId)
                .gte('test_date', startDate.toISOString())
                .lte('test_date', endDate.toISOString())
                .order('test_date', { ascending: false });

            if (error) throw error;

            const total = submissions?.length || 0;
            const avg = total > 0 
                ? Math.round(submissions.reduce((s, sub) => s + (sub.raw_score_percentage || 0), 0) / total) 
                : 0;
            const best = total > 0 
                ? Math.round(Math.max(...submissions.map(s => s.raw_score_percentage || 0))) 
                : 0;

            setReportData({
                submissions: submissions || [],
                totalTests: total,
                avgScore: avg,
                bestScore: best,
                improvement: 0 // Could calculate vs previous week if needed
            });
        } catch (err) {
            console.error("Error fetching weekly report:", err);
        } finally {
            setLoading(false);
        }
    };

    const weekEndDate = new Date(new Date(weekStart).getTime() + 6 * 86400000);
    const dateRangeStr = `${new Date(weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-96 w-full rounded-2xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 pb-20">
            <div className="max-w-4xl mx-auto px-4 pt-8">
                {/* Back Link */}
                <button 
                    onClick={() => navigate(isParentView ? `/parent/child/${targetStudentId}` : '/student')}
                    className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors mb-8"
                >
                    <SafeIcon icon={FiArrowLeft} /> Back to Dashboard
                </button>

                {/* Header Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 mb-8"
                >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <SafeIcon icon={FiCalendar} className="w-6 h-6" />
                                </div>
                                <h1 className="text-2xl font-black text-gray-900 dark:text-white">Weekly Performance Report</h1>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{dateRangeStr}</p>
                            {isParentView && (
                                <div className="mt-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
                                        {student?.name?.charAt(0)}
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Student: {student?.name}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <StatBadge label="Total Tests" value={reportData.totalTests} icon={FiBook} color="text-blue-600" bg="bg-blue-50" />
                            <StatBadge label="Avg. Score" value={`${reportData.avgScore}%`} icon={FiBarChart2} color="text-green-600" bg="bg-green-50" />
                        </div>
                    </div>
                </motion.div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Test List */}
                    <section>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 underline decoration-indigo-500 decoration-4 underline-offset-4">
                            Tests Completed This Week
                        </h2>
                        {reportData.submissions.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500">No tests were completed during this period.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {reportData.submissions.map((sub, idx) => (
                                    <motion.div
                                        key={sub.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => {
                                            if (isParentView) {
                                                navigate(`/parent/child/${targetStudentId}/course/${sub.course_id}/difficulty/${sub.level?.toLowerCase() || 'medium'}/test/${sub.id}`);
                                            } else {
                                                navigate(`/student/detailed-review/${sub.id}`);
                                            }
                                        }}
                                        className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                    <SafeIcon icon={FiCheckCircle} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 dark:text-white">{sub.courses?.name || 'Test Attempt'}</h4>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1"><SafeIcon icon={FiClock} className="w-3 h-3" /> {new Date(sub.test_date).toLocaleDateString()}</span>
                                                        <span className="capitalize px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md font-bold">{sub.level}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{sub.raw_score_percentage}%</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Score</div>
                                            </div>
                                            <div className="ml-4">
                                                <SafeIcon icon={FiChevronRight} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Weekly Insight */}
                    <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                                <SafeIcon icon={FiBarChart2} className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold mb-2">Weekly Insight</h3>
                                <p className="text-indigo-100 leading-relaxed font-medium">
                                    {reportData.totalTests > 3 
                                        ? "Excellent momentum this week! You're performing above average in consistency. Keep this pace to reach your goals faster."
                                        : reportData.totalTests > 0
                                        ? "Good progress! You're building a steady habit. Try increasing your test frequency next week to see even faster improvement."
                                        : "A quiet week! Consistency is key to SAT success. Try to schedule at least one practice session per day next week."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatBadge = ({ label, value, icon, color, bg }) => (
    <div className={`${bg} p-4 rounded-2xl min-w-[120px] border border-white/50`}>
        <div className="flex items-center gap-2 mb-1">
            <SafeIcon icon={icon} className={`w-4 h-4 ${color}`} />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
);

export default WeeklyReport;
