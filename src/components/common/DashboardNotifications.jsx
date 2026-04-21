import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';

import axios from 'axios';

const { FiBell, FiCheckCircle, FiChevronRight, FiClock, FiX, FiCheck } = FiIcons;

const DashboardNotifications = ({ limit = 3 }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFullHistory, setShowFullHistory] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        fetchNotifications();
    }, [user]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            // Direct Supabase query to bypass API routing issues
            const { data, error } = await supabase
                .from('notification_outbox')
                .select('id,event_type,status,created_at,payload,recipient_profile_id,recipient_type')
                .eq('recipient_profile_id', user.id)
                .in('event_type', ['TEST_COMPLETED'])
                .in('status', ['pending', 'processing', 'sent'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            // Sort by most recent first
            const sorted = (data || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setNotifications(sorted.map(row => ({
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

        setShowFullHistory(false);
        if (user.role === 'parent') {
            navigate(`/parent/child/${payload.studentId}/course/${payload.courseId}/difficulty/${(payload.level || 'medium').toLowerCase()}/test/${payload.submissionId}`);
        } else {
            navigate(`/student/detailed-review/${payload.submissionId}`);
        }
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 animate-pulse">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
                <div className="space-y-3">
                    <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                    <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (!loading && notifications.length === 0) {
        return null;
    }

    const displayedNotifications = notifications.slice(0, limit);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                        <SafeIcon icon={FiBell} className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">Recent Updates</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Activity Feed</p>
                    </div>
                </div>
                
                {notifications.length > limit && (
                    <button 
                        onClick={() => setShowFullHistory(true)}
                        className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 transition-all"
                    >
                        View All History
                        <SafeIcon icon={FiChevronRight} className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="space-y-4">
                <AnimatePresence initial={false}>
                    {displayedNotifications.map((n) => (
                        <NotificationCard key={n.id} n={n} handleAction={handleAction} userRole={user.role} />
                    ))}
                </AnimatePresence>
            </div>

            {/* FULL HISTORY MODAL */}
            <AnimatePresence>
                {showFullHistory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowFullHistory(false)}
                            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden relative z-[101] border border-slate-200 dark:border-slate-800 flex flex-col"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center">
                                        <SafeIcon icon={FiBell} className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl text-slate-900 dark:text-white">Full Activity History</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Chronological record of all updates</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowFullHistory(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                                >
                                    <SafeIcon icon={FiX} className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {notifications.map((n) => (
                                    <NotificationCard key={n.id} n={n} handleAction={handleAction} userRole={user.role} isModal />
                                ))}
                            </div>
                            
                            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-center">
                                <p className="text-xs text-slate-500 font-medium">Showing {notifications.length} activity records</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Internal Sub-component for clarity
const NotificationCard = ({ n, handleAction, userRole, isModal = false }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                n.type === 'TEST_COMPLETED' 
                ? 'bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-800/50' 
                : 'bg-sky-50/30 dark:bg-sky-900/10 border-sky-100 dark:border-sky-800/50'
            } hover:shadow-md hover:scale-[1.01] transition-all`}
        >
            <div className="flex items-center gap-4 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.type === 'TEST_COMPLETED' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600'
                }`}>
                    <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-0.5">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {n.payload?.courseName ? `Test Completed: ${n.payload.courseName}` : 'Test Completed'}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 uppercase tracking-tighter">
                            <SafeIcon icon={FiClock} className="w-3 h-3" />
                            {n.created_at && (
                                `${new Date(n.created_at).toLocaleDateString()} ${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            )}
                        </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {userRole === 'parent'
                            ? `${n.payload?.studentName || 'Your child'} scored ${Math.round(n.payload?.rawPercentage || 0)}%`
                            : `Achieved Score: ${Math.round(n.payload?.rawPercentage || 0)}% in ${n.payload?.level || 'Practice'}`}
                    </p>
                </div>
            </div>

            <button
                onClick={() => handleAction(n)}
                className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 group shadow-sm"
            >
                View Full Report
                <SafeIcon icon={FiChevronRight} className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
        </motion.div>
    );
};

export default DashboardNotifications;
