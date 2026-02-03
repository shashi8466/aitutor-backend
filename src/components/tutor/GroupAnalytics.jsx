import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const {
    FiUsers, FiTrendingUp, FiTrendingDown, FiAward,
    FiAlertCircle, FiCalendar, FiDownload, FiArrowLeft
} = FiIcons;

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

const GroupAnalytics = ({ groupId, groupName, onBack }) => {
    const [analytics, setAnalytics] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        loadAnalytics();
        loadMembers();
    }, [groupId, dateRange]);

    const loadAnalytics = async () => {
        try {
            const response = await tutorService.getGroupAnalytics(
                groupId,
                dateRange.start || null,
                dateRange.end || null
            );
            setAnalytics(response.data);
        } catch (err) {
            console.error('Error loading analytics:', err);
            setError('Failed to load analytics');
        }
    };

    const loadMembers = async () => {
        setLoading(true);
        try {
            const response = await tutorService.getGroupMembers(groupId);
            setMembers(response.data.members || []);
        } catch (err) {
            console.error('Error loading members:', err);
            setError('Failed to load members');
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = () => {
        // Generate CSV report
        const csvContent = generateCSVReport();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${groupName}_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateCSVReport = () => {
        if (!analytics || !members) return '';

        let csv = `Group Analytics Report - ${groupName}\n`;
        csv += `Generated: ${new Date().toLocaleString()}\n\n`;

        csv += `Summary Statistics\n`;
        csv += `Total Students,${analytics.total_students}\n`;
        csv += `Total Tests,${analytics.total_tests}\n`;
        csv += `Average Score,${analytics.average_score}%\n\n`;

        csv += `Top Performers\n`;
        csv += `Name,Email,Average Score,Total Tests\n`;
        analytics.top_performers?.forEach(student => {
            csv += `${student.name},${student.email},${student.average_score}%,${student.total_tests}\n`;
        });

        csv += `\nStudent Details\n`;
        csv += `Name,Email,Total Tests,Average Score,Latest Score,Last Test Date\n`;
        members.forEach(member => {
            csv += `${member.name},${member.email},${member.total_tests},${member.average_score}%,${member.latest_score}%,${member.last_test_date || 'N/A'}\n`;
        });

        return csv;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
                <div className="flex items-center gap-3">
                    <SafeIcon icon={FiAlertCircle} className="w-6 h-6 text-red-600" />
                    <p className="text-red-600 dark:text-red-400 font-bold">{error}</p>
                </div>
            </div>
        );
    }

    const subjectData = analytics?.subject_performance ? [
        { name: 'Math', percentage: analytics.subject_performance.math?.average_percentage || 0 },
        { name: 'Reading', percentage: analytics.subject_performance.reading?.average_percentage || 0 },
        { name: 'Writing', percentage: analytics.subject_performance.writing?.average_percentage || 0 }
    ] : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{groupName} Analytics</h2>
                        <p className="text-gray-500 dark:text-gray-400">Detailed performance insights</p>
                    </div>
                </div>
                <button
                    onClick={downloadReport}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                    <SafeIcon icon={FiDownload} />
                    Download Report
                </button>
            </div>

            {/* Date Range Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-4">
                    <SafeIcon icon={FiCalendar} className="w-5 h-5 text-gray-400" />
                    <div className="flex gap-4 flex-1">
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                            />
                        </div>
                        {(dateRange.start || dateRange.end) && (
                            <button
                                onClick={() => setDateRange({ start: '', end: '' })}
                                className="self-end px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg"
                >
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiUsers} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{analytics?.total_students || 0}</span>
                    </div>
                    <p className="text-blue-100 font-bold">Total Students</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg"
                >
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiTrendingUp} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{analytics?.average_score || 0}%</span>
                    </div>
                    <p className="text-green-100 font-bold">Average Score</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
                >
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiAward} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{analytics?.total_tests || 0}</span>
                    </div>
                    <p className="text-purple-100 font-bold">Total Tests</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg"
                >
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiTrendingUp} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{analytics?.top_performers?.[0]?.average_score || 0}%</span>
                    </div>
                    <p className="text-orange-100 font-bold">Top Score</p>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Progress Trend */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Progress Trend</h3>
                    {analytics?.progress_trend && analytics.progress_trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={analytics.progress_trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="week" stroke="#9CA3AF" />
                                <YAxis stroke="#9CA3AF" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                    labelStyle={{ color: '#F3F4F6' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="average_score" stroke="#3B82F6" strokeWidth={2} name="Avg Score %" />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-gray-500 py-12">No trend data available</p>
                    )}
                </div>

                {/* Subject Performance */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Subject Performance</h3>
                    {subjectData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={subjectData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9CA3AF" />
                                <YAxis stroke="#9CA3AF" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                                    labelStyle={{ color: '#F3F4F6' }}
                                />
                                <Bar dataKey="percentage" fill="#3B82F6" name="Average %" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-center text-gray-500 py-12">No subject data available</p>
                    )}
                </div>
            </div>

            {/* Top & Low Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <SafeIcon icon={FiAward} className="w-5 h-5 text-green-600" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Top Performers</h3>
                    </div>
                    <div className="space-y-3">
                        {analytics?.top_performers && analytics.top_performers.length > 0 ? (
                            analytics.top_performers.map((student, index) => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                            #{index + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{student.name}</p>
                                            <p className="text-xs text-gray-500">{student.total_tests} tests</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-green-600">{student.average_score}%</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-8">No data available</p>
                        )}
                    </div>
                </div>

                {/* Students Needing Attention */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <SafeIcon icon={FiAlertCircle} className="w-5 h-5 text-orange-600" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Needs Attention</h3>
                    </div>
                    <div className="space-y-3">
                        {analytics?.low_performers && analytics.low_performers.length > 0 ? (
                            analytics.low_performers.map((student) => (
                                <div key={student.id} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-xs">
                                            {student.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">{student.name}</p>
                                            <p className="text-xs text-gray-500">{student.total_tests} tests</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-orange-600">{student.average_score}%</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-8">No data available</p>
                        )}
                    </div>
                </div>
            </div>

            {/* All Students Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">All Students</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Name</th>
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Email</th>
                                <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Tests</th>
                                <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Avg Score</th>
                                <th className="text-center py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Latest</th>
                                <th className="text-left py-3 px-4 text-sm font-bold text-gray-600 dark:text-gray-400">Last Test</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.length > 0 ? (
                                members.map((member) => (
                                    <tr key={member.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{member.name}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{member.email}</td>
                                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{member.total_tests}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`font-bold ${member.average_score >= 70 ? 'text-green-600' : member.average_score >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                                                {member.average_score}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-900 dark:text-white">{member.latest_score}%</td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                            {member.last_test_date ? new Date(member.last_test_date).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-gray-500">
                                        No students in this group yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GroupAnalytics;
