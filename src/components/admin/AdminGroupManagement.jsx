import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { adminService, tutorService, courseService } from '../../services/api';
import GroupAnalytics from '../tutor/GroupAnalytics';
import HierarchicalContentSelector from '../common/HierarchicalContentSelector';

const {
    FiPlus, FiUsers, FiTrash2, FiEdit2, FiX, FiCheck,
    FiUserPlus, FiInfo, FiSearch, FiBarChart2, FiRefreshCw
} = FiIcons;

/**
 * Admin Group Management - mirrors the Tutor Panel's Student Groups page (see
 * src/components/tutor/GroupManager.jsx) for the same card layout, modal-based Edit/Manage
 * Students flow, and Analytics wiring, while retaining the admin-only capabilities a
 * cross-tutor view needs: filtering/creating groups by tutor, seeing which tutor owns each
 * group, and reassigning a group to a different tutor.
 */
const AdminGroupManagement = () => {
    const [groups, setGroups] = useState([]);
    const [tutors, setTutors] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [currentMembers, setCurrentMembers] = useState([]);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState('');
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [analyticsGroupId, setAnalyticsGroupId] = useState(null);
    const [analyticsGroupName, setAnalyticsGroupName] = useState('');

    // Reassign-tutor modal (admin-only capability)
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignGroup, setReassignGroup] = useState(null);
    const [newTutorId, setNewTutorId] = useState('');

    // Groups list display state
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [groupSortBy, setGroupSortBy] = useState('recent');
    const [groupViewMode, setGroupViewMode] = useState('grid');
    const [filterTutor, setFilterTutor] = useState('all');

    // Create Form States
    const [newGroupName, setNewGroupName] = useState('');
    const [assignedContent, setAssignedContent] = useState({});
    const [assignedCourseIds, setAssignedCourseIds] = useState([]);
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedTutorId, setSelectedTutorId] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);

    // Edit Form States
    const [editGroupName, setEditGroupName] = useState('');
    const [editAssignedContent, setEditAssignedContent] = useState({});
    const [editAssignedCourseIds, setEditAssignedCourseIds] = useState([]);
    const [editGroupDescription, setEditGroupDescription] = useState('');
    const [editGroupStatus, setEditGroupStatus] = useState('active');
    const [activeEditTab, setActiveEditTab] = useState('settings'); // 'settings' | 'students' | 'tutors'
    const [inviteLink, setInviteLink] = useState('');
    // Bulk-remove selection for Current Members - separate from selectedStudentIds, which is the
    // Available Students (add-to-group) selection.
    const [selectedMemberIdsToRemove, setSelectedMemberIdsToRemove] = useState([]);
    const [removingMembers, setRemovingMembers] = useState(false);

    // Co-Tutor management state (admin can manage co-tutors for any group)
    const [groupTutors, setGroupTutors] = useState({ owner: null, coTutors: [] });
    const [loadingTutors, setLoadingTutors] = useState(false);
    const [showAddCoTutorForm, setShowAddCoTutorForm] = useState(false);
    const [newCoTutorEmail, setNewCoTutorEmail] = useState('');
    const [addingCoTutor, setAddingCoTutor] = useState(false);

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
            console.error('Error loading group data:', err);
            const errMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to load group data';
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
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
        } catch (error) {
            console.error('Error creating group:', error);
            const errMsg = error.response?.data?.details || error.response?.data?.error || 'Failed to create group';
            alert(`Error: ${errMsg}`);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        if (!window.confirm('Are you sure you want to delete this group?')) return;
        try {
            await adminService.deleteGroup(groupId);
            loadData();
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    };

    const handleOpenReassign = (group) => {
        setReassignGroup(group);
        setNewTutorId('');
        setShowReassignModal(true);
    };

    const handleReassignGroup = async () => {
        if (!reassignGroup || !newTutorId) return;
        try {
            await adminService.reassignGroup(reassignGroup.id, newTutorId);
            setShowReassignModal(false);
            setReassignGroup(null);
            setNewTutorId('');
            loadData();
        } catch (error) {
            console.error('Error reassigning group:', error);
            alert('Failed to reassign group');
        }
    };

    const handleAddMembers = async () => {
        if (!selectedGroup || selectedStudentIds.length === 0) return;
        setLoadingMembers(true);
        try {
            await tutorService.addGroupMembers(selectedGroup.id, selectedStudentIds);
            setSelectedStudentIds([]);
            await fetchGroupMembers(selectedGroup.id);
            loadData();
        } catch (error) {
            console.error('Error adding members:', error);
            alert('Failed to add members');
        } finally {
            setLoadingMembers(false);
        }
    };

    const fetchGroupMembers = async (groupId) => {
        setLoadingMembers(true);
        try {
            const [membersRes, availableRes] = await Promise.all([
                adminService.getGroupMembers(groupId),
                adminService.getAvailableStudents(groupId)
            ]);
            setCurrentMembers(membersRes.data.members || []);
            setAvailableStudents(availableRes.data.students || []);
        } catch (err) {
            console.error('Error fetching group members:', err);
        } finally {
            setLoadingMembers(false);
        }
    };

    const fetchGroupTutors = async (groupId) => {
        setLoadingTutors(true);
        try {
            const res = await adminService.getCoTutors(groupId);
            setGroupTutors({ owner: res.data.owner, coTutors: res.data.coTutors || [] });
        } catch (err) {
            console.error('Error fetching group tutors:', err);
        } finally {
            setLoadingTutors(false);
        }
    };

    const handleAddCoTutor = async () => {
        if (!selectedGroup || !newCoTutorEmail.trim()) return;
        setAddingCoTutor(true);
        try {
            await adminService.addCoTutor(selectedGroup.id, newCoTutorEmail.trim());
            setNewCoTutorEmail('');
            setShowAddCoTutorForm(false);
            await fetchGroupTutors(selectedGroup.id);
        } catch (error) {
            console.error('Error adding co-tutor:', error);
            const errMsg = error.response?.data?.error || 'Failed to add co-tutor';
            alert(errMsg);
        } finally {
            setAddingCoTutor(false);
        }
    };

    const handleRemoveCoTutor = async (tutorId) => {
        if (!selectedGroup || !window.confirm('Remove this co-tutor from the group?')) return;
        try {
            await adminService.removeCoTutor(selectedGroup.id, tutorId);
            await fetchGroupTutors(selectedGroup.id);
        } catch (error) {
            console.error('Error removing co-tutor:', error);
            alert('Failed to remove co-tutor');
        }
    };

    const handleGenerateInviteLink = async () => {
        if (!selectedGroup) return;
        try {
            const res = await adminService.generateGroupInviteToken(selectedGroup.id);
            if (res.data.token) {
                const baseUrl = window.location.origin;
                setInviteLink(`${baseUrl}/join-group/${res.data.token}`);
                setSelectedGroup({ ...selectedGroup, invite_token: res.data.token });
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

    const handleOpenEditGroup = async (group) => {
        setSelectedGroup(group);
        setEditGroupName(group.name);
        setEditAssignedContent(group.assigned_content || {});
        setEditAssignedCourseIds(group.assigned_course_ids || []);
        setEditGroupDescription(group.description || '');
        setEditGroupStatus(group.status || 'active');
        setActiveEditTab('settings');
        setSelectedStudentIds([]);
        setSelectedMemberIdsToRemove([]);
        setShowAddMemberModal(true);
        setShowAddCoTutorForm(false);
        setNewCoTutorEmail('');
        if (group.invite_token) {
            const baseUrl = window.location.origin;
            setInviteLink(`${baseUrl}/join-group/${group.invite_token}`);
        } else {
            setInviteLink('');
        }
        fetchGroupMembers(group.id);
        fetchGroupTutors(group.id);
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        try {
            await adminService.updateGroup(selectedGroup.id, {
                name: editGroupName,
                assigned_content: editAssignedContent,
                assigned_course_ids: editAssignedCourseIds,
                description: editGroupDescription,
                status: editGroupStatus
            });
            loadData();
            alert('Group updated successfully!');
            // We do not close the modal so they can continue managing students if needed
        } catch (error) {
            console.error('Error updating group:', error);
            const errMsg = error.response?.data?.details || error.response?.data?.error || 'Failed to update group';
            alert(`Error: ${errMsg}`);
        }
    };

    const handleOpenManageMembers = async (group) => {
        setSelectedGroup(group);
        setActiveEditTab('students');
        setSelectedStudentIds([]);
        setSelectedMemberIdsToRemove([]);
        setShowAddMemberModal(true);
        setShowAddCoTutorForm(false);
        setNewCoTutorEmail('');
        if (group.invite_token) {
            const baseUrl = window.location.origin;
            setInviteLink(`${baseUrl}/join-group/${group.invite_token}`);
        } else {
            setInviteLink('');
        }
        fetchGroupMembers(group.id);
        fetchGroupTutors(group.id);
    };

    const handleRemoveMember = async (groupId, studentId) => {
        if (!window.confirm('Remove student from group?')) return;
        try {
            await tutorService.removeGroupMember(groupId, studentId);
            await fetchGroupMembers(groupId);
            loadData();
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    const toggleMemberRemoveSelection = (studentId) => {
        setSelectedMemberIdsToRemove(prev =>
            prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
        );
    };

    const handleBulkRemoveMembers = async (groupId) => {
        if (selectedMemberIdsToRemove.length === 0) return;
        const count = selectedMemberIdsToRemove.length;
        if (!window.confirm(`Remove ${count} student${count === 1 ? '' : 's'} from this group?`)) return;

        setRemovingMembers(true);
        try {
            await tutorService.removeGroupMembers(groupId, selectedMemberIdsToRemove);
            setSelectedMemberIdsToRemove([]);
            await fetchGroupMembers(groupId);
            loadData();
        } catch (error) {
            console.error('Error bulk-removing members:', error);
            alert('Failed to remove selected students.');
        } finally {
            setRemovingMembers(false);
        }
    };

    const getStudentCount = (group) => (typeof group.member_count === 'object' ? (group.member_count.count || 0) : (group.member_count || 0));

    const formatShortDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const totalStudentsAcrossGroups = groups.reduce((sum, g) => sum + getStudentCount(g), 0);
    const uniqueTutorsWithGroups = new Set(groups.map(g => g.created_by)).size;
    const avgGroupSize = groups.length > 0 ? Math.round(totalStudentsAcrossGroups / groups.length) : 0;

    const displayedGroups = useMemo(() => {
        const list = groups.filter(g => {
            const matchesSearch = (g.name || '').toLowerCase().includes(groupSearchQuery.trim().toLowerCase()) ||
                (g.tutor_name || '').toLowerCase().includes(groupSearchQuery.trim().toLowerCase());
            const matchesTutor = filterTutor === 'all' || g.created_by === filterTutor;
            return matchesSearch && matchesTutor;
        });
        return [...list].sort((a, b) => {
            if (groupSortBy === 'name') return (a.name || '').localeCompare(b.name || '');
            if (groupSortBy === 'students') return getStudentCount(b) - getStudentCount(a);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0); // 'recent'
        });
    }, [groups, groupSearchQuery, groupSortBy, filterTutor]);

    const filteredStudents = availableStudents.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    // Show analytics view if selected
    if (showAnalytics && analyticsGroupId) {
        return (
            <GroupAnalytics
                groupId={analyticsGroupId}
                groupName={analyticsGroupName}
                adminMode={true}
                onBack={() => {
                    setShowAnalytics(false);
                    setAnalyticsGroupId(null);
                    setAnalyticsGroupName('');
                }}
            />
        );
    }

    if (loading && groups.length === 0) return (
        <div className="flex flex-col items-center justify-center p-20 text-blue-600">
            <SafeIcon icon={FiRefreshCw} className="w-8 h-8 animate-spin mb-4" />
            <p className="font-bold">Loading groups...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Group Management</h2>
                    <p className="text-slate-400">Manage all student groups across tutors</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-900/30 transition-all"
                >
                    <SafeIcon icon={FiPlus} /> Create New Group
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Groups', sub: 'Across all tutors', value: groups.length, icon: FiUsers, bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
                    { label: 'Students in Groups', sub: 'Total enrollments', value: totalStudentsAcrossGroups, icon: FiUserPlus, bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400' },
                    { label: 'Tutors with Groups', sub: 'Unique tutors', value: uniqueTutorsWithGroups, icon: FiIcons.FiUserCheck, bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
                    { label: 'Avg Group Size', sub: 'Students per group', value: avgGroupSize, icon: FiBarChart2, bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' }
                ].map(stat => (
                    <div key={stat.label} className="bg-[#131622] border border-[#252A3C] rounded-2xl p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${stat.bg} ${stat.text}`}>
                            <SafeIcon icon={stat.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xl font-black text-white leading-tight">{stat.value}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{stat.label}</p>
                            <p className="text-[10px] text-slate-500 truncate">{stat.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search / Tutor Filter / Sort / View Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-sm">
                        <SafeIcon icon={FiSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            value={groupSearchQuery}
                            onChange={(e) => setGroupSearchQuery(e.target.value)}
                            placeholder="Search groups or tutors..."
                            className="w-full pl-10 pr-4 py-2.5 bg-[#131622] border border-[#252A3C] rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <select
                        value={filterTutor}
                        onChange={(e) => setFilterTutor(e.target.value)}
                        className="bg-[#131622] border border-[#252A3C] text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[160px]"
                    >
                        <option value="all">All Tutors</option>
                        {tutors.map(tutor => (
                            <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <span className="hidden sm:inline">Sort by:</span>
                        <select
                            value={groupSortBy}
                            onChange={(e) => setGroupSortBy(e.target.value)}
                            className="bg-[#131622] border border-[#252A3C] text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="recent">Recently Created</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="students">Most Students</option>
                        </select>
                    </div>
                    <div className="flex gap-1.5 bg-[#131622] p-1 rounded-lg border border-[#252A3C]">
                        <button
                            title="Grid View"
                            onClick={() => setGroupViewMode('grid')}
                            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${groupViewMode === 'grid' ? 'bg-[#1E2A55] border border-indigo-500 text-indigo-300' : 'text-slate-400 hover:text-white'}`}
                        >
                            <SafeIcon icon={FiIcons.FiGrid} className="w-3.5 h-3.5" />
                        </button>
                        <button
                            title="List View"
                            onClick={() => setGroupViewMode('list')}
                            className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${groupViewMode === 'list' ? 'bg-[#1E2A55] border border-indigo-500 text-indigo-300' : 'text-slate-400 hover:text-white'}`}
                        >
                            <SafeIcon icon={FiIcons.FiList} className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <button
                        onClick={loadData}
                        title="Refresh"
                        className="w-9 h-9 flex items-center justify-center bg-[#131622] border border-[#252A3C] text-slate-300 hover:text-white rounded-xl transition-all"
                    >
                        <SafeIcon icon={FiRefreshCw} className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold flex items-center gap-2">
                    <SafeIcon icon={FiInfo} /> {error}
                </div>
            )}

            {/* Groups Grid */}
            {groups.length > 0 && (
                displayedGroups.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm font-bold">No groups match your search.</div>
                ) : (
                    <div className={groupViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-4'}>
                        {displayedGroups.map(group => {
                            const isActive = (group.status || 'active') === 'active';
                            const studentCount = getStudentCount(group);
                            return (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-[#131622] rounded-2xl border border-[#252A3C] shadow-sm overflow-hidden hover:border-indigo-500/40 transition-all"
                                >
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                                                <SafeIcon icon={FiUsers} className="w-6 h-6 text-indigo-400" />
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenReassign(group)}
                                                    title="Reassign to another tutor"
                                                    className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all"
                                                >
                                                    <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGroup(group.id)}
                                                    title="Delete group"
                                                    className="px-2 py-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-1.5 text-xs font-bold"
                                                >
                                                    Delete <SafeIcon icon={FiTrash2} />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1">{group.name}</h3>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-green-400' : 'text-slate-500'}`}>
                                                    {isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            {group.tutor_name && (
                                                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full truncate max-w-[160px]" title={group.tutor_name}>
                                                    Tutor: {group.tutor_name}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                                            {group.description || 'No description provided.'}
                                        </p>

                                        <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-[#1C202B]">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Content Areas</p>
                                                <p className="text-xs font-bold text-indigo-400">{(group.assigned_course_ids?.length || 0)} Areas Assigned</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Created On</p>
                                                <p className="text-xs font-bold text-slate-300">{formatShortDate(group.created_at)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Students</p>
                                                <p className="text-xs font-bold text-slate-300">{studentCount} Students</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Group Type</p>
                                                <p className="text-xs font-bold text-slate-300">Class Group</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => {
                                                    setAnalyticsGroupId(group.id);
                                                    setAnalyticsGroupName(group.name);
                                                    setShowAnalytics(true);
                                                }}
                                                className="flex-1 min-w-[110px] px-3 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-purple-500/20 transition-all"
                                            >
                                                <SafeIcon icon={FiBarChart2} className="w-3.5 h-3.5" /> Analytics
                                            </button>
                                            <button
                                                onClick={() => handleOpenManageMembers(group)}
                                                className="flex-1 min-w-[110px] px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-500/20 transition-all"
                                            >
                                                <SafeIcon icon={FiUserPlus} className="w-3.5 h-3.5" /> Manage Students
                                            </button>
                                            <button
                                                onClick={() => handleOpenEditGroup(group)}
                                                className="flex-1 min-w-[110px] px-3 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/20 transition-all"
                                            >
                                                <SafeIcon icon={FiEdit2} className="w-3.5 h-3.5" /> Edit Group
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Persistent CTA footer */}
            <div className="bg-[#131622] border border-dashed border-[#2D3448] rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <SafeIcon icon={FiUserPlus} className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-white font-bold mb-1">Create a new group to get started</h3>
                <p className="text-slate-400 text-sm mb-5 max-w-md mx-auto">Organize students into groups and assign content areas to track progress effectively.</p>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-blue-900/30"
                >
                    <SafeIcon icon={FiPlus} className="w-4 h-4" /> Create New Group
                </button>
            </div>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCreateModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl max-w-md w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="px-8 pt-8 shrink-0">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create Student Group</h3>
                            </div>

                            <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 min-h-0">
                                <div className="flex-1 overflow-y-auto px-8 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={newGroupName}
                                            onChange={(e) => setNewGroupName(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            placeholder="Batch A, Monday Session, etc."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Assigned Tutor</label>
                                        <select
                                            value={selectedTutorId}
                                            onChange={(e) => setSelectedTutorId(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">Select Tutor</option>
                                            {tutors.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Assign Content</label>
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
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                                        <textarea
                                            value={groupDescription}
                                            onChange={(e) => setGroupDescription(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            rows="3"
                                            placeholder="Details about this group"
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="flex gap-3 px-8 py-6 shrink-0 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200"
                                    >
                                        Create Group
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reassign Tutor Modal (admin-only) */}
            <AnimatePresence>
                {showReassignModal && reassignGroup && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowReassignModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Reassign Group</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Reassign "{reassignGroup.name}" to a different tutor
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
                                        .filter(t => t.id !== reassignGroup.created_by)
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
                                        setReassignGroup(null);
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
            </AnimatePresence>

            {/* Manage Members / Edit Group Modal */}
            <AnimatePresence>
                {showAddMemberModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAddMemberModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedGroup?.name}</h3>
                                    <p className="text-sm text-gray-500">Edit group settings and members</p>
                                </div>
                                <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} />
                                </button>
                            </div>

                            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                                <button
                                    onClick={() => setActiveEditTab('settings')}
                                    className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${activeEditTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Group Settings
                                </button>
                                <button
                                    onClick={() => setActiveEditTab('students')}
                                    className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${activeEditTab === 'students' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Manage Students
                                </button>
                                <button
                                    onClick={() => setActiveEditTab('tutors')}
                                    className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 ${activeEditTab === 'tutors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    Manage Tutors
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6">
                                {activeEditTab === 'settings' ? (
                                    <form onSubmit={handleUpdateGroup} className="space-y-4 pr-2">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Group Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={editGroupName}
                                                onChange={(e) => setEditGroupName(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Assign Content</label>
                                            <HierarchicalContentSelector
                                                courses={courses}
                                                initialContent={editAssignedContent}
                                                onChange={({ assigned_content, assigned_course_ids }) => {
                                                    setEditAssignedContent(assigned_content);
                                                    setEditAssignedCourseIds(assigned_course_ids);
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                            <textarea
                                                value={editGroupDescription}
                                                onChange={(e) => setEditGroupDescription(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                                rows="3"
                                            ></textarea>
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <button
                                                type="submit"
                                                className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </form>
                                ) : activeEditTab === 'students' ? (
                                    <div className="flex flex-col h-[calc(100vh-250px)]">
                                        <div className="mb-6 p-4 border rounded-xl bg-gray-50 dark:bg-gray-800/50">
                                            <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Group Invitation</h4>
                                            {inviteLink ? (
                                                <div className="space-y-3">
                                                    <p className="text-sm text-gray-500">Students can use this link to join this group automatically.</p>
                                                    <div className="flex items-center gap-2">
                                                        <input type="text" readOnly value={inviteLink} className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg outline-none" />
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
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Available Students</h4>
                                        <div className="relative mb-4 shrink-0">
                                            <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or email..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                                            />
                                        </div>
                                        <div className="grid gap-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                            {loadingMembers ? (
                                                <div className="text-center py-8 text-blue-600 font-bold">Loading members...</div>
                                            ) : (
                                                <>
                                                    {/* Current Members Section */}
                                                    {currentMembers.length > 0 && (
                                                        <div className="mb-6">
                                                            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Current Members ({currentMembers.length})</h4>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedMemberIdsToRemove(
                                                                        selectedMemberIdsToRemove.length === currentMembers.length
                                                                            ? []
                                                                            : currentMembers.map(m => m.id)
                                                                    )}
                                                                    className="text-xs font-bold text-blue-600 hover:underline"
                                                                >
                                                                    {selectedMemberIdsToRemove.length === currentMembers.length && currentMembers.length > 0 ? 'Deselect All' : 'Select All'}
                                                                </button>
                                                            </div>

                                                            {selectedMemberIdsToRemove.length > 0 && (
                                                                <div className="flex items-center justify-between gap-3 mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                                                    <span className="text-xs font-bold text-red-700 dark:text-red-300">
                                                                        {selectedMemberIdsToRemove.length} student{selectedMemberIdsToRemove.length === 1 ? '' : 's'} selected
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleBulkRemoveMembers(selectedGroup.id)}
                                                                        disabled={removingMembers}
                                                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                                    >
                                                                        <SafeIcon icon={FiIcons.FiUserMinus} />
                                                                        {removingMembers ? 'Removing...' : 'Remove Selected'}
                                                                    </button>
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                {currentMembers.map(member => (
                                                                    <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800 transition-all">
                                                                        <div className="flex items-center gap-3">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedMemberIdsToRemove.includes(member.id)}
                                                                                onChange={() => toggleMemberRemoveSelection(member.id)}
                                                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                                                            />
                                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase bg-blue-600 text-white">
                                                                                {member.name?.charAt(0)}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                                    {member.name}
                                                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">IN BATCH</span>
                                                                                </p>
                                                                                <p className="text-xs text-gray-500">{member.email}</p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRemoveMember(selectedGroup.id, member.id)}
                                                                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                                        >
                                                                            <SafeIcon icon={FiIcons.FiUserMinus} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Available Students Section */}
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Available Students</h4>
                                                        <div className="space-y-2">
                                                            {(() => {
                                                                const availableStudentsFiltered = filteredStudents.filter(s => !currentMembers.some(m => m.id === s.id));
                                                                if (availableStudentsFiltered.length === 0) {
                                                                    return <p className="text-center py-4 text-gray-500 text-sm">No available students found.</p>;
                                                                }
                                                                return availableStudentsFiltered.map(student => (
                                                                    <div key={student.id} className="flex items-center justify-between p-3 rounded-xl border transition-all bg-gray-50 dark:bg-gray-900 border-transparent">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase bg-gray-200 dark:bg-gray-700 text-gray-500">
                                                                                {student.name?.charAt(0)}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                                    {student.name}
                                                                                </p>
                                                                                <p className="text-xs text-gray-500">{student.email}</p>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (selectedStudentIds.includes(student.id)) {
                                                                                    setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                                                                                } else {
                                                                                    setSelectedStudentIds([...selectedStudentIds, student.id]);
                                                                                }
                                                                            }}
                                                                            className={`p-2 rounded-lg transition-all ${selectedStudentIds.includes(student.id)
                                                                                ? 'bg-blue-600 text-white'
                                                                                : 'bg-white dark:bg-gray-800 text-blue-600 border border-gray-100 dark:border-gray-700'
                                                                                }`}
                                                                        >
                                                                            <SafeIcon icon={selectedStudentIds.includes(student.id) ? FiCheck : FiPlus} />
                                                                        </button>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6 pr-2">
                                        {loadingTutors ? (
                                            <div className="text-center py-8 text-blue-600 font-bold">Loading tutors...</div>
                                        ) : (
                                            <>
                                                {/* Group Owner */}
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Group Owner</h4>
                                                    <div className="flex items-center justify-between p-3 rounded-xl border bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase bg-indigo-600 text-white">
                                                                {groupTutors.owner?.name?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                    {groupTutors.owner?.name}
                                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">OWNER</span>
                                                                </p>
                                                                <p className="text-xs text-gray-500">{groupTutors.owner?.email}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Co-Tutors */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                                            Co-Tutors ({groupTutors.coTutors.length})
                                                        </h4>
                                                        {!showAddCoTutorForm && (
                                                            <button
                                                                onClick={() => setShowAddCoTutorForm(true)}
                                                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                                                            >
                                                                <SafeIcon icon={FiPlus} className="w-3 h-3" /> Add Co-Tutor
                                                            </button>
                                                        )}
                                                    </div>

                                                    {groupTutors.coTutors.length === 0 ? (
                                                        <p className="text-center py-4 text-gray-500 text-sm">No co-tutors yet.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {groupTutors.coTutors.map(ct => (
                                                                <div key={ct.id} className="flex items-center justify-between p-3 rounded-xl border bg-gray-50 dark:bg-gray-900 border-transparent">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase bg-gray-200 dark:bg-gray-700 text-gray-500">
                                                                            {ct.name?.charAt(0)}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                                                {ct.name}
                                                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">CO-TUTOR</span>
                                                                            </p>
                                                                            <p className="text-xs text-gray-500">{ct.email}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveCoTutor(ct.id)}
                                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                                    >
                                                                        <SafeIcon icon={FiIcons.FiUserMinus} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {showAddCoTutorForm && (
                                                        <div className="mt-4 p-4 border rounded-xl bg-gray-50 dark:bg-gray-800/50 space-y-3">
                                                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Tutor Email</label>
                                                            <input
                                                                type="email"
                                                                value={newCoTutorEmail}
                                                                onChange={(e) => setNewCoTutorEmail(e.target.value)}
                                                                placeholder="tutor@example.com"
                                                                className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                                            />
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={() => { setShowAddCoTutorForm(false); setNewCoTutorEmail(''); }}
                                                                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button
                                                                    onClick={handleAddCoTutor}
                                                                    disabled={!newCoTutorEmail.trim() || addingCoTutor}
                                                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none hover:bg-blue-700 transition-all"
                                                                >
                                                                    {addingCoTutor ? 'Adding...' : 'Add Co-Tutor'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {activeEditTab === 'students' && (
                                <div className="pt-6 border-t border-gray-100 dark:border-gray-700 mt-6 bg-white dark:bg-gray-800 shrink-0">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                            {selectedStudentIds.length} students selected
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => {
                                                    const available = filteredStudents.filter(s => !currentMembers.some(m => m.id === s.id));
                                                    if (selectedStudentIds.length === available.length && available.length > 0) {
                                                        setSelectedStudentIds([]); // Deselect all
                                                    } else {
                                                        setSelectedStudentIds(available.map(s => s.id)); // Select all
                                                    }
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:underline"
                                            >
                                                {selectedStudentIds.length > 0 && selectedStudentIds.length === filteredStudents.filter(s => !currentMembers.some(m => m.id === s.id)).length ? 'Deselect All' : 'Select All'}
                                            </button>
                                            {selectedStudentIds.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedStudentIds([])}
                                                    className="text-xs font-bold text-red-600 hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowAddMemberModal(false)}
                                            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleAddMembers}
                                            disabled={selectedStudentIds.length === 0 || loadingMembers}
                                            className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none hover:bg-blue-700 transition-all"
                                        >
                                            {loadingMembers ? 'Adding...' : 'Add to Group'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminGroupManagement;
