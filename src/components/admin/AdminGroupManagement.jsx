import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { adminService, authService, tutorService, gradingService, enrollmentService, courseService } from '../../services/api';
import GroupAnalytics from '../tutor/GroupAnalytics';
import HierarchicalContentSelector from '../common/HierarchicalContentSelector';

const {
    FiUsers, FiUserCheck, FiRefreshCw, FiTrash2,
    FiSearch, FiFilter, FiDownload, FiAlertCircle,
    FiArrowLeft, FiBarChart2, FiBook, FiMail, FiCalendar,
    FiTrendingUp, FiTarget, FiActivity, FiArrowRight,
    FiPlus, FiX, FiUser, FiCheck, FiLayers, FiClock,
    FiAward, FiCheckCircle, FiXCircle, FiInfo, FiFileText
} = FiIcons;

const AdminGroupManagement = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', or 'analytics'
    const [groups, setGroups] = useState([]);
    const [tutors, setTutors] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTutor, setFilterTutor] = useState('all');
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [activeGroupData, setActiveGroupData] = useState(null);
    const [newTutorId, setNewTutorId] = useState('');

    // Create Group States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [assignedContent, setAssignedContent] = useState({});
    const [assignedCourseIds, setAssignedCourseIds] = useState([]);
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedTutorId, setSelectedTutorId] = useState('');
    const [creatingGroup, setCreatingGroup] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsRes, tutorsRes, coursesRes] = await Promise.all([
                adminService.getAllGroups(),
                adminService.getAllTutors(),
                courseService.getAll().catch(() => ({ data: [] }))
            ]);

            setGroups(groupsRes.data.groups || []);
            setTutors(tutorsRes.data.tutors || []);
            setCourses(coursesRes.data || []);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) {
            alert('Please enter a group name.');
            return;
        }

        setCreatingGroup(true);
        try {
            await adminService.createGroup({
                name: newGroupName,
                assigned_content: assignedContent,
                assigned_course_ids: assignedCourseIds,
                description: groupDescription,
                tutor_id: selectedTutorId || (tutors.length > 0 ? tutors[0].id : null)
            });
            setShowCreateModal(false);
            setNewGroupName('');
            setAssignedContent({});
            setAssignedCourseIds([]);
            setGroupDescription('');
            setSelectedTutorId('');
            loadData();
        } catch (err) {
            console.error('Error creating group:', err);
            alert(err.response?.data?.details || err.response?.data?.error || 'Failed to create group');
        } finally {
            setCreatingGroup(false);
        }
    };

    const handleViewDetail = (group) => {
        setSelectedGroup(group);
        setViewMode('detail');
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
        const search = searchQuery.toLowerCase();
        const matchesSearch =
            (group.name?.toLowerCase() || '').includes(search) ||
            (group.tutor_name?.toLowerCase() || '').includes(search);
            // Search is limited without full text, we can skip course matching for now since it's an array

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

    if (loading && viewMode === 'list') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading groups...</p>
                </div>
            </div>
        );
    }

    if (viewMode === 'analytics' && selectedGroup) {
        return (
            <GroupAnalytics
                groupId={selectedGroup.id}
                groupName={selectedGroup.name}
                adminMode={true}
                onBack={() => {
                    setViewMode('list');
                    setSelectedGroup(null);
                }}
            />
        );
    }

    if (viewMode === 'detail' && selectedGroup) {
        return (
            <GroupDetailView
                group={selectedGroup}
                onBack={() => {
                    setViewMode('list');
                    setSelectedGroup(null);
                }}
            />
        );
    }

    return (
        <div className="bg-[#0B0D14] min-h-screen text-white p-6 sm:p-8 rounded-[32px] font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                            <SafeIcon icon={FiUsers} className="w-6 h-6" />
                        </div>
                        Group Management
                    </h2>
                    <p className="text-gray-400 mt-2 ml-[3.75rem] font-medium text-sm">Manage all student groups across tutors</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                        <SafeIcon icon={FiPlus} className="w-4 h-4" /> Create Student Group
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-[#11131A] text-gray-300 rounded-xl border border-[#1C202B] hover:bg-gray-800 transition-colors text-sm font-bold shadow-sm">
                        <SafeIcon icon={FiDownload} className="w-4 h-4" /> Export Report
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                {/* Total Groups */}
                <div className="bg-[#11131A] rounded-2xl p-6 border border-[#1C202B] relative overflow-hidden shadow-lg group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform">
                            <SafeIcon icon={FiUsers} className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Groups</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalGroups}</h3>
                            <p className="text-gray-500 text-[10px] mt-0.5">Across all tutors</p>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>
                </div>

                {/* Students in Groups */}
                <div className="bg-[#11131A] rounded-2xl p-6 border border-[#1C202B] relative overflow-hidden shadow-lg group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/10 border border-green-500/20 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.15)] group-hover:scale-110 transition-transform">
                            <SafeIcon icon={FiUserCheck} className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Students in Groups</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalStudents}</h3>
                            <p className="text-gray-500 text-[10px] mt-0.5">Total enrollments</p>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full"></div>
                </div>

                {/* Tutors with Groups */}
                <div className="bg-[#11131A] rounded-2xl p-6 border border-[#1C202B] relative overflow-hidden shadow-lg group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-110 transition-transform">
                            <SafeIcon icon={FiUsers} className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Tutors with Groups</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{stats.totalTutors}</h3>
                            <p className="text-gray-500 text-[10px] mt-0.5">Unique tutors</p>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full"></div>
                </div>

                {/* Avg Group Size */}
                <div className="bg-[#11131A] rounded-2xl p-6 border border-[#1C202B] relative overflow-hidden shadow-lg group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-500/10 border border-orange-500/20 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.15)] group-hover:scale-110 transition-transform">
                            <SafeIcon icon={FiUsers} className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Avg Group Size</p>
                            <h3 className="text-2xl font-bold text-white mt-1">{stats.avgGroupSize}</h3>
                            <p className="text-gray-500 text-[10px] mt-0.5">Students per group</p>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full"></div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#11131A] rounded-2xl border border-[#1C202B] p-4 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1 relative w-full">
                        <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search groups, tutors, or courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-[#0B0D14] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-[#7C3AED] transition-colors text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <SafeIcon icon={FiFilter} className="text-gray-500 absolute ml-4 pointer-events-none" />
                        <select
                            value={filterTutor}
                            onChange={(e) => setFilterTutor(e.target.value)}
                            className="pl-11 pr-8 py-3 bg-[#0B0D14] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-[#7C3AED] transition-colors text-sm appearance-none min-w-[200px]"
                        >
                            <option value="all">All Tutors</option>
                            {tutors.map(tutor => (
                                <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={loadData}
                            className="px-6 py-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl flex items-center gap-2 font-bold transition-colors shadow-[0_0_15px_rgba(124,58,237,0.3)] text-sm ml-auto"
                        >
                            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Groups Grid (Premium UI) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                {filteredGroups.length > 0 ? (
                    filteredGroups.map((group, index) => {
                        const themeColors = [
                            { main: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/20', solid: 'bg-[#3B82F6] hover:bg-[#2563EB]', shadow: 'hover:shadow-[#3B82F6]/10', icon: 'text-blue-500' },
                            { main: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/20', solid: 'bg-[#10B981] hover:bg-[#059669]', shadow: 'hover:shadow-[#10B981]/10', icon: 'text-emerald-500' },
                            { main: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/20', solid: 'bg-[#8B5CF6] hover:bg-[#7C3AED]', shadow: 'hover:shadow-[#8B5CF6]/10', icon: 'text-purple-500' },
                            { main: 'text-[#F97316]', bg: 'bg-[#F97316]/10', border: 'border-[#F97316]/20', solid: 'bg-[#F97316] hover:bg-[#EA580C]', shadow: 'hover:shadow-[#F97316]/10', icon: 'text-orange-500' }
                        ];
                        const theme = themeColors[index % themeColors.length];

                        return (
                        <motion.div
                            key={group.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -4 }}
                            className={`bg-[#11131A] rounded-[24px] border border-[#1C202B] shadow-lg overflow-hidden flex flex-col group transition-all duration-300 relative ${theme.shadow}`}
                        >
                            <div className={`absolute top-0 right-0 w-48 h-48 opacity-[0.03] blur-3xl rounded-full pointer-events-none ${theme.bg.replace('/10', '')}`}></div>
                            <div className="p-6 flex-1 relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`w-12 h-12 ${theme.bg} rounded-xl flex items-center justify-center ${theme.main} border ${theme.border}`}>
                                        <SafeIcon icon={FiLayers} className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedGroup(group);
                                                setShowReassignModal(true);
                                            }}
                                            className={`p-2 ${theme.main} hover:${theme.bg} rounded-lg transition-all border border-transparent hover:${theme.border}`}
                                            title="Reassign tutor"
                                        >
                                            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGroup(group.id)}
                                            className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/20"
                                            title="Delete group"
                                        >
                                            <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 ${theme.bg} ${theme.main} text-[10px] font-black uppercase tracking-widest rounded-md border ${theme.border}`}>
                                            {(group.assigned_course_ids?.length || 0)} areas assigned
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white uppercase tracking-tight leading-none mt-2">
                                        {group.name}
                                    </h3>
                                    {group.description && (
                                        <p className="text-xs text-gray-500 line-clamp-2">{group.description}</p>
                                    )}
                                </div>

                                <div className="space-y-3 p-4 bg-[#0B0D14] rounded-xl border border-[#1C202B]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                                            <SafeIcon icon={FiUser} className="w-4 h-4" />
                                            <span className="font-bold">STUDENTS</span>
                                        </div>
                                        <span className={`font-black ${theme.main}`}>{group.member_count || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                                            <SafeIcon icon={FiBook} className="w-4 h-4" />
                                            <span className="font-bold">ASSIGNED TUTOR</span>
                                        </div>
                                        <span className={`font-black text-xs ${theme.main} truncate max-w-[130px]`} title={group.tutor_name}>{group.tutor_name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 grid grid-cols-2 gap-3 relative z-10 border-t border-[#1C202B] bg-[#11131A]">
                                <button
                                    onClick={() => {
                                        setSelectedGroup(group);
                                        setViewMode('analytics');
                                    }}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-4 bg-transparent ${theme.main} font-bold rounded-xl border ${theme.border} hover:${theme.bg} transition-all text-xs`}
                                >
                                    <SafeIcon icon={FiTrendingUp} className="w-4 h-4" /> Analytics
                                </button>
                                <button
                                    onClick={() => handleViewDetail(group)}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-4 ${theme.solid} text-white font-bold rounded-xl transition-all text-xs shadow-sm shadow-black/20`}
                                >
                                    <SafeIcon icon={FiActivity} className="w-4 h-4" /> Manage
                                </button>
                            </div>
                        </motion.div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 bg-[#11131A] rounded-[24px] border border-[#1C202B] flex flex-col items-center gap-4">
                        <SafeIcon icon={FiAlertCircle} className="w-12 h-12 text-gray-500" />
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white">No Groups Found</h3>
                            <p className="text-gray-500">Try adjusting your filters or search query</p>
                        </div>
                    </div>
                )}
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

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-[#11131A] border border-[#1C202B] rounded-3xl p-8 max-w-xl w-full shadow-2xl z-10 text-white max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                                <div>
                                    <h3 className="text-2xl font-black text-white">Create Student Group</h3>
                                    <p className="text-xs text-gray-400 mt-1">Assign subtopics and tutors for SAT preparation.</p>
                                </div>
                                <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-white rounded-xl">
                                    <SafeIcon icon={FiX} className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateGroup} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Group Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#181B26] border border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white text-sm"
                                        placeholder="e.g. SAT Math Batch A, Summer Intensive"
                                    />
                                </div>

                                {tutors.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Assigned Tutor</label>
                                        <select
                                            value={selectedTutorId}
                                            onChange={(e) => setSelectedTutorId(e.target.value)}
                                            className="w-full px-4 py-3 bg-[#181B26] border border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white text-sm"
                                        >
                                            <option value="">Select Tutor</option>
                                            {tutors.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Assign SAT Content</label>
                                    <HierarchicalContentSelector 
                                        courses={courses}
                                        initialContent={assignedContent}
                                        onChange={({ assigned_content, assigned_course_ids }) => {
                                            setAssignedContent(assigned_content);
                                            setAssignedCourseIds(assigned_course_ids);
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Description (Optional)</label>
                                    <textarea
                                        value={groupDescription}
                                        onChange={(e) => setGroupDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#181B26] border border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 text-white text-sm"
                                        rows="3"
                                        placeholder="Description or notes for this group..."
                                    ></textarea>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingGroup}
                                        className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {creatingGroup ? 'Creating...' : 'Create Group'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const GroupDetailView = ({ group, onBack }) => {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);
    const [studentScores, setStudentScores] = useState([]);
    const [loadingScores, setLoadingScores] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [selectedSubmissionForAnalysis, setSelectedSubmissionForAnalysis] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [inviteLink, setInviteLink] = useState('');
    const [localGroup, setLocalGroup] = useState(group);

    const fetchDetailData = async () => {
        setLoading(true);
        try {
            const [membersRes, analyticsRes] = await Promise.all([
                adminService.getGroupMembers(group.id),
                adminService.getGroupDashboard(group.id)
            ]);
            setMembers(membersRes.data || []);
            setAnalytics(analyticsRes.data.overview || {});
        } catch (err) {
            console.error('Error fetching group details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetailData();
        if (group.invite_token) {
            const baseUrl = window.location.origin;
            setInviteLink(`${baseUrl}/join-group/${group.invite_token}`);
        } else {
            setInviteLink('');
        }
    }, [group.id]);

    const handleGenerateInviteLink = async () => {
        try {
            const res = await adminService.generateGroupInviteToken(localGroup.id);
            if (res.data.token) {
                const baseUrl = window.location.origin;
                setInviteLink(`${baseUrl}/join-group/${res.data.token}`);
                setLocalGroup({...localGroup, invite_token: res.data.token});
            }
        } catch (error) {
            console.error('Failed to generate invite token:', error);
            alert('Failed to generate invite token');
        }
    };

    const handleCopyInviteLink = () => {
        if (inviteLink) {
            navigator.clipboard.writeText(inviteLink);
            alert('Invite link copied to clipboard!');
        }
    };

    const handleOpenMemberModal = async () => {
        setShowMemberModal(true);
        setLoadingStudents(true);
        setSelectedStudents([]); // Initialize empty selection for NEW members
        try {
            const res = await adminService.getAvailableStudents(localGroup.id);
            const candidates = res.data.students || [];
            setAvailableStudents(candidates);
        } catch (err) {
            console.error('Error fetching course students:', err);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleAddMembers = async () => {
        if (selectedStudents.length === 0) return;
        try {
            setLoadingStudents(true);
            await adminService.bulkAssignStudents(localGroup.id, selectedStudents);
            setSelectedStudents([]);
            // Refresh counts and lists
            await fetchDetailData();
        } catch (err) {
            console.error('Error adding members:', err);
            alert('Failed to add members');
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleRemoveMemberAction = async (studentId) => {
        if (!window.confirm('Are you sure you want to remove this student from the group?')) return;
        try {
            setLoadingStudents(true);
            await tutorService.removeGroupMember(localGroup.id, studentId);
            // Refresh counts and lists
            await fetchDetailData();
        } catch (err) {
            console.error('Error removing member:', err);
            alert('Failed to remove member');
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleRemoveMember = async (studentId) => {
        if (!window.confirm('Are you sure you want to remove this student from the group?')) return;
        try {
            // For admin, we can reuse tutor remove endpoint OR we can create an admin one
            // Tutor remove endpoint checks ownership. Let's just use it and see if the log helps 
            // Actually, better to have a dedicated admin remove.
            // But tutorService.deleteGroupMember is usually fine if we fix the 403 on tutor side too.
            // I'll stick to adminService if I can.
            // Wait, I didn't add removeMember to adminService. I'll stick with tutorService but I already fixed the 403 authorization in tutor.js for members.
            await tutorService.removeGroupMember(localGroup.id, studentId);
            fetchDetailData();
        } catch (err) {
            console.error('Error removing member:', err);
        }
    };

    const handleViewStudentHistory = async (student) => {
        setSelectedStudentForHistory(student);
        setLoadingScores(true);
        try {
            // Re-use tutor progress endpoint which returns submissions
            const res = await tutorService.getGroupMembers(localGroup.id); // This already has performance
            // Actually, we want ALL scores for this student in this course
            const response = await tutorService.getStudentProgress(student.id);
            // Filter submissions by current course
            const courseSubmissions = (response.data.submissions || []).filter(s => s.course_id === group.course_id);
            setStudentScores(courseSubmissions);
        } catch (err) {
            console.error('Error fetching student scores:', err);
        } finally {
            setLoadingScores(false);
        }
    };

    const handleViewTestAnalysis = async (submissionId) => {
        setLoadingAnalysis(true);
        try {
            const res = await gradingService.getSubmission(submissionId);
            setAnalysisData(res.data.submission);
            setSelectedSubmissionForAnalysis(submissionId);
        } catch (err) {
            console.error('Error fetching test analysis:', err);
            alert('Failed to load test analysis');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading group details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-600 dark:text-gray-400"
                    >
                        <SafeIcon icon={FiArrowLeft} className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{localGroup.name}</h2>
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider">
                                {(localGroup.assigned_course_ids?.length || 0)} Content Areas
                            </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-gray-500">Assigned Tutor: <span className="font-bold text-gray-700 dark:text-gray-300">{localGroup.tutor_name}</span></p>
                            <span className="text-gray-300">|</span>
                            <p className="text-gray-500">{localGroup.tutor_email}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenMemberModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold transition-colors shadow-lg shadow-blue-200 dark:shadow-none"
                    >
                        <SafeIcon icon={FiPlus} />
                        Manage Members
                    </button>
                </div>
            </div>

            {/* Analytics Overview */}
            <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-8">
                {analytics && (
                    <>
                        <h4 className="text-xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <SafeIcon icon={FiTrendingUp} /> Performance Overview
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800">
                                <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Total Students</div>
                                <p className="text-3xl font-black text-gray-900 dark:text-white">{analytics.totalStudents || 0}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-800">
                                <div className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Average Score</div>
                                <p className="text-3xl font-black text-blue-600">{analytics.averageScore || 0}%</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-100 dark:border-green-800">
                                <div className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">Total Tests</div>
                                <p className="text-3xl font-black text-green-600">{analytics.totalTestsCompleted || 0}</p>
                            </div>
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-100 dark:border-purple-800">
                                <div className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">Group Status</div>
                                <p className="text-2xl font-black text-purple-600">
                                    {analytics.averageScore > 80 ? 'Elite' : analytics.averageScore > 60 ? 'Stable' : 'Needs Support'}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Member List */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <SafeIcon icon={FiUsers} className="text-blue-500" />
                        Student Performance Breakdown
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50/50 dark:bg-gray-900/50">
                            <tr>
                                <th className="text-left p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Student</th>
                                <th className="text-center p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Course Progress</th>
                                <th className="text-center p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Tests</th>
                                <th className="text-center p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Avg %</th>
                                <th className="text-center p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Latest Score</th>
                                <th className="text-right p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {members.length > 0 ? (
                                members.map((member) => (
                                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                                                    {member.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white">{member.name}</p>
                                                    <p className="text-xs text-gray-500">{member.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                                    {member.progress_count || 0} Lessons
                                                </span>
                                                <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.min((member.progress_count || 0) * 10, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300">
                                                {member.total_tests}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={`text-lg font-black ${member.average_score >= 80 ? 'text-green-600' : member.average_score >= 60 ? 'text-blue-600' : 'text-orange-600'}`}>
                                                    {member.average_score}%
                                                </span>
                                                <div className="w-16 h-1 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${member.average_score >= 80 ? 'bg-green-500' : member.average_score >= 60 ? 'bg-blue-500' : 'bg-orange-500'}`}
                                                        style={{ width: `${member.average_score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center font-bold text-gray-700 dark:text-gray-300">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-600 dark:text-blue-400">{member.latest_score}%</span>
                                                {member.latest_scaled_score > 0 && (
                                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full text-blue-700 dark:text-blue-300">
                                                        Scale: {member.latest_scaled_score}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/student-analysis/${member.id}`)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/50"
                                                    title="View all scores"
                                                >
                                                    <SafeIcon icon={FiBarChart2} />
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Remove from group"
                                                >
                                                    <SafeIcon icon={FiX} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-gray-500 font-medium">
                                        No students found in this group
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Add Member Modal */}
            <AnimatePresence>
                {showMemberModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-gray-800 rounded-[32px] p-8 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Manage Group Members</h3>
                                    <p className="text-gray-500">Add students to this group</p>
                                </div>
                                <button onClick={() => setShowMemberModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="mb-4 p-4 border rounded-2xl bg-gray-50 dark:bg-gray-900/50">
                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Group Invitation</h4>
                                {inviteLink ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-500">Students can use this link to join this group automatically.</p>
                                        <div className="flex items-center gap-2">
                                            <input type="text" readOnly value={inviteLink} className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none" />
                                            <button onClick={handleCopyInviteLink} className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-200">Copy</button>
                                            <button onClick={handleGenerateInviteLink} className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-300">Regenerate</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500">Generate an invitation link for students to join.</p>
                                        <button onClick={handleGenerateInviteLink} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">Generate Invite Link</button>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                {loadingStudents ? (
                                    <div className="py-20 text-center animate-pulse text-blue-600 font-bold">Scanning for eligible students...</div>
                                ) : (
                                    <div className="grid gap-3">
                                        {availableStudents.length > 0 ? (
                                            availableStudents.map(student => {
                                                const isAlreadyMember = members.some(m => m.id === student.id);
                                                const isSelected = selectedStudents.includes(student.id);

                                                return (
                                                    <div
                                                        key={student.id}
                                                        className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isAlreadyMember
                                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30'
                                                            : isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800'
                                                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4 text-left">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isAlreadyMember ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                                                }`}>
                                                                {student.name?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                    {student.name}
                                                                    {isAlreadyMember && (
                                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black uppercase rounded-full tracking-tighter">In Batch</span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-gray-500">{student.email}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {isAlreadyMember ? (
                                                                <button
                                                                    onClick={() => handleRemoveMemberAction(student.id)}
                                                                    className="px-3 py-1.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1.5"
                                                                >
                                                                    <SafeIcon icon={FiIcons.FiUserMinus} /> Remove
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        if (isSelected) {
                                                                            setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                                                        } else {
                                                                            setSelectedStudents([...selectedStudents, student.id]);
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 ${isSelected
                                                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                                                        }`}
                                                                >
                                                                    {isSelected ? (
                                                                        <><SafeIcon icon={FiIcons.FiCheck} /> Selected</>
                                                                    ) : (
                                                                        <><SafeIcon icon={FiIcons.FiUserPlus} /> Add To Batch</>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-20 text-center opacity-50 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 w-full">
                                                <SafeIcon icon={FiIcons.FiUsers} className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                                                <p className="font-bold">No students found for this course.</p>
                                                <p className="text-sm">Verify student enrollments in the course settings.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                        {selectedStudents.length} students selected
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => {
                                                const available = availableStudents.filter(s => !members.some(m => m.id === s.id));
                                                if (selectedStudents.length === available.length && available.length > 0) {
                                                    setSelectedStudents([]); // Deselect all
                                                } else {
                                                    setSelectedStudents(available.map(s => s.id)); // Select all
                                                }
                                            }}
                                            className="text-xs font-bold text-blue-600 hover:underline"
                                        >
                                            {selectedStudents.length > 0 && selectedStudents.length === availableStudents.filter(s => !members.some(m => m.id === s.id)).length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        {selectedStudents.length > 0 && (
                                            <button
                                                onClick={() => setSelectedStudents([])}
                                                className="text-xs font-bold text-red-600 hover:underline"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowMemberModal(false)}
                                        className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-black rounded-2xl hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddMembers}
                                        disabled={selectedStudents.length === 0}
                                        className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:shadow-none"
                                    >
                                        Add {selectedStudents.length} {selectedStudents.length === 1 ? 'Student' : 'Students'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Student History Modal */}
            <AnimatePresence>
                {selectedStudentForHistory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-[32px] p-8 max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Student Test History</h3>
                                    <p className="text-gray-500">All submissions for <span className="text-indigo-600 font-bold">{selectedStudentForHistory.name}</span> in this group</p>
                                </div>
                                <button onClick={() => setSelectedStudentForHistory(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {loadingScores ? (
                                    <div className="py-20 text-center text-indigo-600 font-bold animate-pulse">Fetching complete test history...</div>
                                ) : studentScores.length > 0 ? (
                                    <div className="space-y-4">
                                        {studentScores.map((score, idx) => (
                                            <div
                                                key={score.id}
                                                onClick={() => handleViewTestAnalysis(score.id)}
                                                className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900 transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex flex-col items-center justify-center border border-gray-200 dark:border-gray-700 group-hover:border-blue-500 transition-colors">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase">Test</span>
                                                        <span className="text-lg font-black text-gray-900 dark:text-white">#{studentScores.length - idx}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-gray-900 dark:text-white flex items-center gap-2">
                                                            {score.course?.name || 'Group Content'}
                                                            <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase ${score.level === 'Hard' ? 'bg-red-100 text-red-700' :
                                                                score.level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-green-100 text-green-700'
                                                                }`}>
                                                                {score.level || 'Standard'}
                                                            </span>
                                                            {score.raw_score_percentage >= 80 && (
                                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full uppercase">High Performance</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-gray-500 font-medium">Attempted on {new Date(score.created_at).toLocaleDateString()} at {new Date(score.created_at).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Percentage</p>
                                                        <p className="text-xl font-black text-gray-900 dark:text-white">{score.raw_score_percentage}%</p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/admin/report/${score.id}`);
                                                            }}
                                                            className="px-3 py-1.5 bg-white dark:bg-gray-800 text-blue-600 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors whitespace-nowrap"
                                                        >
                                                            <SafeIcon icon={FiFileText} /> View Report
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(`/admin/report/${score.id}?download=true`);
                                                            }}
                                                            className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs flex items-center justify-center gap-1 shadow-sm transition-colors whitespace-nowrap"
                                                        >
                                                            <SafeIcon icon={FiDownload} /> Download PDF
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-blue-600 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                        ANALYSIS <SafeIcon icon={FiArrowRight} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center opacity-50">
                                        <SafeIcon icon={FiAlertCircle} className="w-12 h-12 mx-auto mb-4" />
                                        <p>No test submissions found for this specific course.</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8">
                                <button
                                    onClick={() => setSelectedStudentForHistory(null)}
                                    className="w-full py-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-black rounded-2xl hover:bg-gray-200 transition-colors"
                                >
                                    Close History
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Detailed Test Analysis Modal */}
            <AnimatePresence>
                {selectedSubmissionForAnalysis && analysisData && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-[32px] p-0 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setSelectedSubmissionForAnalysis(null)}
                                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
                                    >
                                        <SafeIcon icon={FiArrowLeft} className="w-6 h-6" />
                                    </button>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                                            <SafeIcon icon={FiBarChart2} className="text-blue-600" />
                                            TEST ANALYSIS – {analysisData.course?.name} ({analysisData.level?.toUpperCase()})
                                        </h3>
                                        <p className="text-gray-500">Student: <span className="font-bold text-gray-700 dark:text-gray-300">{analysisData.user?.name}</span></p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedSubmissionForAnalysis(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                                {/* Summary Section */}
                                <section>
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                        Summary Section
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                        {[
                                            { label: 'Total Questions', value: (analysisData.correct_responses?.length || 0) + (analysisData.incorrect_responses?.length || 0) },
                                            { label: 'Attempted', value: ((analysisData.correct_responses?.length || 0) + (analysisData.incorrect_responses?.length || 0)) - (analysisData.incorrect_responses?.filter(r => r.selected_answer === 'Not recorded').length || 0) },
                                            { label: 'Correct', value: analysisData.correct_responses?.length || 0, color: 'text-green-600' },
                                            { label: 'Wrong', value: (analysisData.incorrect_responses?.length || 0) - (analysisData.incorrect_responses?.filter(r => r.selected_answer === 'Not recorded').length || 0), color: 'text-red-600' },
                                            { label: 'Percentage', value: `${analysisData.raw_score_percentage}%`, color: 'text-blue-600' },
                                            { label: 'Time Taken', value: `${Math.floor((analysisData.test_duration_seconds || analysisData.duration || 0) / 60)} mins` }
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{stat.label}</p>
                                                <p className={`text-xl font-black ${stat.color || 'text-gray-900 dark:text-white'}`}>{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Question Breakdown */}
                                <section>
                                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                        Question Breakdown
                                    </h4>
                                    <div className="space-y-4">
                                        {[
                                            ...(analysisData.correct_responses || []).map(r => ({ ...r, status: 'correct' })),
                                            ...(analysisData.incorrect_responses || []).map(r => ({ ...r, status: r.selected_answer === 'Not recorded' ? 'skipped' : 'wrong' }))
                                        ].sort((a, b) => (a.question?.id || 0) - (b.question?.id || 0)).map((q, idx) => (
                                            <div key={idx} className="p-6 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-[24px] shadow-sm">
                                                <div className="flex justify-between items-start mb-4">
                                                    <h5 className="font-black text-gray-900 dark:text-white">Question {idx + 1}</h5>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${q.status === 'correct' ? 'bg-green-100 text-green-700' :
                                                        q.status === 'wrong' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {q.status === 'correct' ? <><SafeIcon icon={FiCheckCircle} className="w-3 h-3" /> Correct</> :
                                                            q.status === 'wrong' ? <><SafeIcon icon={FiXCircle} className="w-3 h-3" /> Wrong</> :
                                                                <><SafeIcon icon={FiAlertCircle} className="w-3 h-3" /> Not Attempted</>}
                                                    </span>
                                                </div>

                                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl mb-4 text-sm text-gray-700 dark:text-gray-300">
                                                    {q.question_text || q.question?.question}
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase">Student Answer</p>
                                                        <p className={`font-bold ${q.status === 'wrong' ? 'text-red-600' : q.status === 'correct' ? 'text-green-600' : 'text-gray-500'}`}>
                                                            {q.selected_answer === 'Not recorded' ? 'Not Attempted' : q.selected_answer}
                                                        </p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase">Correct Answer</p>
                                                        <p className="font-bold text-green-600">{q.correct_answer || q.question?.correct_answer}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase">Status</p>
                                                        <p className="font-bold flex items-center gap-1">
                                                            {q.status === 'correct' ? '✅ Correct' : q.status === 'wrong' ? '❌ Wrong' : '⚪ Not Attempted'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {(q.explanation || q.question?.explanation) && (
                                                    <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800 flex gap-3">
                                                        <SafeIcon icon={FiInfo} className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                                        <p className="text-xs text-gray-500 leading-relaxed"><span className="font-bold text-gray-700 dark:text-gray-300">Explanation:</span> {q.explanation || q.question?.explanation}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <div className="p-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                                <button
                                    onClick={() => setSelectedSubmissionForAnalysis(null)}
                                    className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none transition-all uppercase tracking-widest text-sm"
                                >
                                    Done Reviewing
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Analysis Loading Overlay */}
            {loadingAnalysis && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <p className="font-black text-gray-900 dark:text-white uppercase tracking-tighter">Analyzing Performance...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminGroupManagement;
