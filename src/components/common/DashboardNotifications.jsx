import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

const { FiBell, FiCheckCircle, FiChevronRight, FiClock, FiX, FiCheck } = FiIcons;

const DashboardNotifications = ({ limit = 5 }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        fetchNotifications();
    }, [user, limit]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            // Show recent outbox items as in-app notifications.
            // This avoids depending on a separate `notifications` table schema.
            const { data, error } = await supabase
                .from('notification_outbox')
                .select('id,event_type,status,created_at,payload,recipient_profile_id,recipient_type')
                .eq('recipient_profile_id', user.id)
                .in('event_type', ['TEST_COMPLETED'])
                .in('status', ['pending', 'processing', 'sent'])
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            setNotifications((data || []).map(row => ({
                id: row.id,
                type: row.event_type,
                created_at: row.created_at,
                payload: row.payload || {},
                status: row.status,
                recipient_type: row.recipient_type
            })));
        } catch (error) {
            console.error('Error fetching dashboard notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (notification) => {
        const { payload } = notification;
        if (!payload?.submissionId) return;

        if (user.role === 'parent') {
            navigate(`/parent/child/${payload.studentId}/course/${payload.courseId}/difficulty/${(payload.level || 'medium').toLowerCase()}/test/${payload.submissionId}`);
        } else {
            navigate(`/student/detailed-review/${payload.submissionId}`);
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-gray-100 dark:bg-gray-750 rounded-xl"></div>
                    <div className="h-16 bg-gray-100 dark:bg-gray-750 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (!loading && notifications.length === 0) {
        return null; // Don't show anything if no notifications
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                    <SafeIcon icon={FiBell} className="text-blue-500" />
                    Recent Updates
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Updates
                </span>
            </div>

            <div className="space-y-4">
                <AnimatePresence initial={false}>
                    {notifications.map((n) => (
                        <motion.div
                            key={n.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-blue-50/30 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/50"
                        >
                            <div className="flex items-center gap-4 flex-1">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    n.type === 'TEST_COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                                }`}>
                                    <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                            {n.payload?.courseName ? `Test Completed: ${n.payload.courseName}` : 'Test Completed'}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                            <SafeIcon icon={FiClock} className="w-3 h-3" />
                                            {n.created_at && (
                                                `${new Date(n.created_at).toLocaleDateString()} ${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                            )}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        {user.role === 'parent'
                                            ? `${n.payload?.studentName || 'Your child'} scored ${Math.round(n.payload?.rawPercentage || 0)}%`
                                            : `Your score: ${Math.round(n.payload?.rawPercentage || 0)}%`}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => handleAction(n)}
                                className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2 group shadow-sm"
                            >
                                View Full Report
                                <SafeIcon icon={FiChevronRight} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default DashboardNotifications;
