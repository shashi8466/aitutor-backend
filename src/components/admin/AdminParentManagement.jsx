import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { authService, adminService } from '../../services/api';

const { FiUserPlus, FiUsers, FiMail, FiLock, FiCheckCircle, FiAlertCircle, FiSearch, FiCheck, FiX, FiPlus, FiEdit, FiTrash2, FiTarget, FiDollarSign, FiSettings, FiArrowRight, FiToggleLeft, FiToggleRight } = FiIcons;

const AdminParentManagement = () => {
    const [students, setStudents] = useState([]);
    const [parents, setParents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });

    const [selectedStudents, setSelectedStudents] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingParentId, setEditingParentId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setErrorMsg('');
            console.log('📊 Fetching Parent Management Data (Students + Parents)...');
            
            // Fetch both roles in parallel for efficiency
            const [studentsRes, parentsRes] = await Promise.all([
                authService.getAllProfiles({ role: 'student' }),
                adminService.getParents()
            ]);

            setStudents(studentsRes.data || []);
            
            // Handle parents response with proper error checking
            if (parentsRes.data?.success) {
                setParents(parentsRes.data.data || []);
                console.log(`✅ Loaded ${studentsRes.data?.length || 0} students and ${parentsRes.data.data?.length || 0} parents.`);
            } else {
                throw new Error(parentsRes.data?.error || 'Failed to load parent accounts');
            }
        } catch (error) {
            console.error('Error loading parent management data:', error);
            setErrorMsg('Failed to load user data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudents(prev => {
            if (prev.includes(studentId)) {
                return prev.filter(id => id !== studentId);
            } else {
                return [...prev, studentId];
            }
        });
    };

    const handleEditClick = (parent) => {
        setEditingParentId(parent.id);
        setFormData({
            name: parent.name || '',
            email: parent.email || '',
            password: '' // Password left blank intentionally so it requires filling only if changing
        });
        setSelectedStudents(parent.linked_students || []);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingParentId(null);
        setFormData({ name: '', email: '', password: '' });
        setSelectedStudents([]);
        setErrorMsg('');
        setSuccessMsg('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (selectedStudents.length === 0) {
            setErrorMsg('Please select at least one student to link to this parent account.');
            return;
        }

        if (!formData.name || !formData.email || (!formData.password && !editingParentId)) {
            setErrorMsg('Please fill out all required parent details.');
            return;
        }

        setSubmitting(true);

        try {
            const parentData = {
                name: formData.name,
                email: formData.email,
                studentIds: selectedStudents
            };
            if (formData.password) {
                parentData.password = formData.password;
            }

            if (editingParentId) {
                await adminService.updateParent(editingParentId, parentData);
                setSuccessMsg(`Parent account for ${formData.name} updated successfully!`);
            } else {
                await adminService.createParent(parentData);
                setSuccessMsg(`Parent account for ${formData.name} created successfully! linked to ${selectedStudents.length} student(s).`);
            }

            setEditingParentId(null);
            setFormData({ name: '', email: '', password: '' });
            setSelectedStudents([]);
            loadData();


        } catch (err) {
            setErrorMsg(err.response?.data?.error || err.message || 'An error occurred while saving the parent account.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteParent = async (parentId, parentName = 'this parent account') => {
        if (!window.confirm(`Are you sure you want to delete ${parentName}? This action cannot be undone and will:\n\n• Remove the parent account from the system\n• Unlink the parent from all students\n• Delete all associated data\n\nThis action is permanent.`)) {
            return;
        }

        try {
            setLoading(true);
            setErrorMsg('');
            
            const response = await adminService.deleteParent(parentId);
            
            if (response.data?.success) {
                setSuccessMsg(response.data.message || 'Parent account deleted successfully!');
                loadData();
            } else {
                throw new Error(response.data?.error || 'Delete failed');
            }
        } catch (err) {
            console.error('Delete Parent Error:', err);
            
            let errorMessage = 'Failed to delete parent account.';
            
            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.message) {
                errorMessage = err.message;
            } else if (err.response?.data?.details) {
                errorMessage = `Delete failed: ${err.response.data.details}`;
            }
            
            setErrorMsg(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        
        if (!window.confirm(`Are you sure you want to ${action} this parent account?`)) {
            return;
        }

        try {
            setLoading(true);
            await adminService.updateUserStatus(userId, newStatus);
            setSuccessMsg(`Parent account ${newStatus}d successfully!`);
            loadData();
        } catch (err) {
            console.error('Toggle Status Error:', err);
            setErrorMsg(err.response?.data?.error || err.message || `Failed to ${action} parent account.`);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Parent Management</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Create parent accounts and link them to students</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Creation Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <SafeIcon icon={FiUserPlus} className="text-amber-600 dark:text-amber-400 w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingParentId ? 'Edit Parent Account' : 'Add New Parent'}
                            </h3>
                        </div>
                        {editingParentId && (
                            <button type="button" onClick={cancelEdit} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1">
                                <SafeIcon icon={FiX} /> Cancel Edit
                            </button>
                        )}
                    </div>

                    <form className="p-6 space-y-6" onSubmit={handleSubmit}>
                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium flex items-start gap-3 border border-red-100 dark:border-red-800/30">
                                <SafeIcon icon={FiAlertCircle} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{errorMsg}</p>
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-4 rounded-xl text-sm font-medium flex items-start gap-3 border border-green-100 dark:border-green-800/30">
                                <SafeIcon icon={FiCheckCircle} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{successMsg}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Parent Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SafeIcon icon={FiUsers} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="pl-10 w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
                                        placeholder="e.g. Raj Kumar"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Parent Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SafeIcon icon={FiMail} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="pl-10 w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
                                        placeholder="e.g. rajparent@gmail.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                    Password {editingParentId && <span className="text-gray-400 normal-case ml-1 font-medium">(Leave blank to keep current)</span>}
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <SafeIcon icon={FiLock} className="text-gray-400" />
                                    </div>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="pl-10 w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
                                        placeholder={editingParentId ? "********" : "********"}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">
                                Linked Students: <span className="font-bold text-amber-600 dark:text-amber-400">{selectedStudents.length} selected</span>
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={submitting}
                                className={`w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all ${submitting ? 'bg-amber-400 dark:bg-amber-600 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg shadow-amber-200 dark:shadow-none hover:from-amber-600 hover:to-orange-700'}`}
                            >
                                {submitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <SafeIcon icon={editingParentId ? FiCheck : FiUserPlus} />
                                        {editingParentId ? 'Save Changes' : 'Create Parent Account'}
                                    </>
                                )}
                            </motion.button>
                        </div>
                    </form>
                </motion.div>

                {/* Student Selection List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-[600px]"
                >
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Select Students</h3>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <SafeIcon icon={FiSearch} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none dark:text-white"
                                placeholder="Search by student name or email..."
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {loading ? (
                            <div className="text-center py-10 text-gray-500">Loading students...</div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 text-sm">No students found matching your search.</div>
                        ) : (
                            filteredStudents.map(student => {
                                const isSelected = selectedStudents.includes(student.id);
                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => toggleStudentSelection(student.id)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">
                                                {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white text-sm">{student.name || 'Anonymous Student'}</h4>
                                                <p className="text-xs text-gray-500">{student.email}</p>
                                            </div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 text-transparent'}`}>
                                            <SafeIcon icon={FiCheck} className="w-4 h-4" />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Existing Parents List */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <SafeIcon icon={FiUsers} className="text-blue-600 dark:text-blue-400 w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Existing Parent Accounts</h3>
                    </div>
                </div>

                <div className="p-0 overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Loading parents data...</div>
                    ) : parents.length === 0 ? (
                        <div className="text-center py-10 text-gray-500 text-sm">No parent accounts found.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <th className="py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                                    <th className="py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                                    <th className="py-4 px-6 font-semibold text-gray-700 dark:text-gray-300">Linked Students</th>
                                    <th className="py-4 px-6 font-semibold text-gray-700 dark:text-gray-300 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parents.map((parent) => {
                                    const linkedIds = parent.linked_students || [];
                                    const linkedNames = linkedIds.map(id => {
                                        const s = students.find(stu => stu.id === id);
                                        if (s) return s.name || 'Anonymous Student';
                                        if (loading) return 'Loading...';
                                        return `ID: ${id.substring(0, 8)}...`;
                                    });

                                    return (
                                        <tr key={parent.id} className={`border-b border-gray-100 dark:border-gray-700 transition-colors ${editingParentId === parent.id ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-750/50'}`}>
                                            <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">
                                                {parent.name || 'N/A'}
                                            </td>
                                            <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                                                {parent.email || 'N/A'}
                                            </td>
                                            <td className="py-4 px-6 text-gray-600 dark:text-gray-300">
                                                {linkedNames.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {linkedNames.map((name, i) => (
                                                            <span key={i} className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-2.5 py-1 rounded-md border border-amber-100 dark:border-amber-800/30">
                                                                {name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic text-sm">No linked students</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        parent.status === 'active' 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {parent.status === 'active' ? 'Active' : 'Inactive'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleToggleStatus(parent.id, parent.status)}
                                                        className={`p-2 rounded-lg transition-all shadow-sm ${
                                                            parent.status === 'active'
                                                                ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                        }`}
                                                        title={parent.status === 'active' ? 'Deactivate' : 'Activate'}
                                                    >
                                                        <SafeIcon icon={parent.status === 'active' ? FiToggleRight : FiToggleLeft} className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditClick(parent)}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                        title="Edit Parent"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteParent(parent.id, parent.name || 'this parent account')}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                                        title="Delete Parent"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminParentManagement;
