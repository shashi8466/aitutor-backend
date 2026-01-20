import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const {
    FiPlus, FiUsers, FiTrash2, FiEdit2, FiX, FiCheck,
    FiPlusCircle, FiUserPlus, FiUserMinus, FiInfo, FiSearch,
    FiChevronRight
} = FiIcons;

const GroupManager = () => {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState('');

    // Form States
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [groupsRes, studentsRes, dashboardRes] = await Promise.all([
                tutorService.getGroups(),
                tutorService.getStudents(),
                tutorService.getDashboard()
            ]);

            setGroups(groupsRes.data.groups || []);
            setStudents(studentsRes.data.students || []);
            setCourses(dashboardRes.data.courses || []);
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
            await tutorService.createGroup({
                name: newGroupName,
                courseId: selectedCourseId,
                description: groupDescription
            });
            setShowCreateModal(false);
            setNewGroupName('');
            setSelectedCourseId('');
            setGroupDescription('');
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
            await tutorService.deleteGroup(groupId);
            loadData();
        } catch (error) {
            console.error('Error deleting group:', error);
        }
    };

    const handleAddMembers = async () => {
        if (!selectedGroup || selectedStudentIds.length === 0) return;
        try {
            await tutorService.addGroupMembers(selectedGroup.id, selectedStudentIds);
            setShowAddMemberModal(false);
            setSelectedStudentIds([]);
            loadData();
        } catch (error) {
            console.error('Error adding members:', error);
        }
    };

    const handleRemoveMember = async (groupId, studentId) => {
        if (!window.confirm('Remove student from group?')) return;
        try {
            await tutorService.removeGroupMember(groupId, studentId);
            loadData();
        } catch (error) {
            console.error('Error removing member:', error);
        }
    };

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchQuery.toLowerCase());

        // Only show students enrolled in the same course as the group
        const groupCourseId = selectedGroup?.course_id;
        const studentCourseId = s.enrolled_course_id;
        const isSameCourse = String(groupCourseId) === String(studentCourseId);

        return matchesSearch && isSameCourse;
    });

    if (loading) return <div className="p-8 text-center text-blue-600">Loading groups...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Groups</h2>
                    <p className="text-gray-500 dark:text-gray-400">Manage batches and class sessions</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                    <SafeIcon icon={FiPlus} /> Create New Group
                </button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                    <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <SafeIcon icon={FiUsers} className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Groups Created</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first student group to manage batches easily.</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            + Create New Group
                        </button>
                    </div>
                ) : (
                    groups.map(group => (
                        <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden group hover:border-blue-300 dark:hover:border-blue-800 transition-all"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                        <SafeIcon icon={FiUsers} className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <button
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    >
                                        <SafeIcon icon={FiTrash2} />
                                    </button>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{group.name}</h3>
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">
                                    Course: {group.course?.name || 'Assigned Course'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">
                                    {group.description || 'No description provided.'}
                                </p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
                                    <div className="flex items-center gap-1 text-gray-500">
                                        <SafeIcon icon={FiUsers} className="w-4 h-4" />
                                        <span className="text-sm font-bold">{typeof group.member_count === 'object' ? (group.member_count.count || 0) : (group.member_count || 0)} Students</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedGroup(group);
                                            setShowAddMemberModal(true);
                                        }}
                                        className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <SafeIcon icon={FiUserPlus} /> Manage
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
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
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create Student Group</h3>

                            {error && (
                                <div className="p-3 mb-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2">
                                    <SafeIcon icon={FiInfo} /> {error}
                                </div>
                            )}

                            <form onSubmit={handleCreateGroup} className="space-y-4">
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
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Associate Course</label>
                                    <select
                                        required
                                        value={selectedCourseId}
                                        onChange={(e) => setSelectedCourseId(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select a course</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>{course.name}</option>
                                        ))}
                                    </select>
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
                                <div className="flex gap-3 pt-4">
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

            {/* Manage Members Modal */}
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
                                    <p className="text-sm text-gray-500">Manage group members</p>
                                </div>
                                <button onClick={() => setShowAddMemberModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-6">
                                {/* Current Members - This part would need backend update to fetch actual member profiles */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Available Students</h4>
                                    <div className="relative mb-4">
                                        <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                                        />
                                    </div>
                                    <div className="grid gap-2 max-h-60 overflow-y-auto pr-2">
                                        {filteredStudents.length === 0 ? (
                                            <p className="text-center py-8 text-gray-500 text-sm">No students found matching your search.</p>
                                        ) : (
                                            filteredStudents.map(student => (
                                                <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs uppercase">
                                                            {student.name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">{student.name}</p>
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
                                                            ? 'bg-green-100 text-green-600'
                                                            : 'bg-white dark:bg-gray-800 text-blue-600 border border-gray-100 dark:border-gray-700'
                                                            }`}
                                                    >
                                                        <SafeIcon icon={selectedStudentIds.includes(student.id) ? FiCheck : FiPlus} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-100 dark:border-gray-700 mt-6 bg-white dark:bg-gray-800">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                        {selectedStudentIds.length} students selected
                                    </p>
                                    {selectedStudentIds.length > 0 && (
                                        <button
                                            onClick={() => setSelectedStudentIds([])}
                                            className="text-xs font-bold text-red-600 hover:underline"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAddMemberModal(false)}
                                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddMembers}
                                        disabled={selectedStudentIds.length === 0}
                                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none"
                                    >
                                        Add to Group
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GroupManager;
