import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { adminService, authService } from '../../services/api';

const {
    FiUsers, FiUserCheck, FiRefreshCw, FiTrash2,
    FiSearch, FiFilter, FiDownload, FiAlertCircle
} = FiIcons;

const AdminGroupManagement = () => {
    const [groups, setGroups] = useState([]);
    const [tutors, setTutors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTutor, setFilterTutor] = useState('all');
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [newTutorId, setNewTutorId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsRes, profilesRes] = await Promise.all([
                adminService.getAllGroups(),
                authService.getAllProfiles()
            ]);

            setGroups(groupsRes.data.groups || []);

            // Filter only tutors
            const tutorList = profilesRes.data?.filter(p => p.role === 'tutor') || [];
            setTutors(tutorList);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleReassignGroup = async () => {
        if (!selectedGroup || !newTutorId) return;

        try {
            await adminService.reassignGroup(selectedGroup.id, newTutorId);
            setShowReassignModal(false);
            setSelectedGroup(null);
            setNewTutorId('');
            loadData();
        } catch (err) {
            console.error('Error reassigning group:', err);
            alert('Failed to reassign group');
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;

        try {
            await adminService.deleteGroup(groupId);
            loadData();
        } catch (err) {
            console.error('Error deleting group:', err);
            alert('Failed to delete group');
        }
    };

    const filteredGroups = groups.filter(group => {
        const matchesSearch = group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.tutor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.course?.name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTutor = filterTutor === 'all' || group.created_by === filterTutor;

        return matchesSearch && matchesTutor;
    });

    // Group statistics
    const stats = {
        totalGroups: groups.length,
        totalStudents: groups.reduce((sum, g) => sum + (g.member_count || 0), 0),
        totalTutors: new Set(groups.map(g => g.created_by)).size,
        avgGroupSize: groups.length > 0
            ? Math.round(groups.reduce((sum, g) => sum + (g.member_count || 0), 0) / groups.length)
            : 0
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading groups...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Group Management</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage all student groups across tutors</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiUsers} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{stats.totalGroups}</span>
                    </div>
                    <p className="text-blue-100 font-bold">Total Groups</p>
                    <p className="text-blue-200 text-xs mt-1">Across all tutors</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiUserCheck} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{stats.totalStudents}</span>
                    </div>
                    <p className="text-green-100 font-bold">Students in Groups</p>
                    <p className="text-green-200 text-xs mt-1">Total enrollments</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiUsers} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{stats.totalTutors}</span>
                    </div>
                    <p className="text-purple-100 font-bold">Tutors with Groups</p>
                    <p className="text-purple-200 text-xs mt-1">Unique tutors</p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between mb-2">
                        <SafeIcon icon={FiUsers} className="w-8 h-8 opacity-80" />
                        <span className="text-3xl font-bold">{stats.avgGroupSize}</span>
                    </div>
                    <p className="text-orange-100 font-bold">Avg Group Size</p>
                    <p className="text-orange-200 text-xs mt-1">Students per group</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search groups, tutors, or courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <SafeIcon icon={FiFilter} className="text-gray-400" />
                        <select
                            value={filterTutor}
                            onChange={(e) => setFilterTutor(e.target.value)}
                            className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                        >
                            <option value="all">All Tutors</option>
                            {tutors.map(tutor => (
                                <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold transition-colors"
                    >
                        <SafeIcon icon={FiRefreshCw} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Groups Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                                <th className="text-left py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Group Name</th>
                                <th className="text-left py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Course</th>
                                <th className="text-left py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Tutor</th>
                                <th className="text-center py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Students</th>
                                <th className="text-left py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Created</th>
                                <th className="text-right py-4 px-6 text-sm font-bold text-gray-600 dark:text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredGroups.length > 0 ? (
                                filteredGroups.map((group) => (
                                    <tr key={group.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-4 px-6">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{group.name}</p>
                                                {group.description && (
                                                    <p className="text-sm text-gray-500 line-clamp-1">{group.description}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-gray-900 dark:text-white">
                                            {group.course?.name || 'N/A'}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{group.tutor_name}</p>
                                                <p className="text-sm text-gray-500">{group.tutor_email}</p>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full font-bold">
                                                {group.member_count || 0}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(group.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setShowReassignModal(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                    title="Reassign tutor"
                                                >
                                                    <SafeIcon icon={FiRefreshCw} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGroup(group.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Delete group"
                                                >
                                                    <SafeIcon icon={FiTrash2} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <SafeIcon icon={FiAlertCircle} className="w-12 h-12 text-gray-400" />
                                            <p className="text-gray-500">No groups found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reassign Modal */}
            {showReassignModal && selectedGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                    >
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Reassign Group</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Reassign "{selectedGroup.name}" to a different tutor
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Select New Tutor
                            </label>
                            <select
                                value={newTutorId}
                                onChange={(e) => setNewTutorId(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                            >
                                <option value="">Choose a tutor...</option>
                                {tutors
                                    .filter(t => t.id !== selectedGroup.created_by)
                                    .map(tutor => (
                                        <option key={tutor.id} value={tutor.id}>
                                            {tutor.name} ({tutor.email})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReassignModal(false);
                                    setSelectedGroup(null);
                                    setNewTutorId('');
                                }}
                                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReassignGroup}
                                disabled={!newTutorId}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none"
                            >
                                Reassign
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AdminGroupManagement;
