import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import axios from 'axios';

const {
    FiKey, FiPlus, FiCopy, FiCheck, FiX, FiClock,
    FiUsers, FiCalendar, FiRefreshCw, FiTrash2, FiEye, FiEyeOff, FiEdit,
    FiBook, FiHash, FiInfo
} = FiIcons;

const EnrollmentKeyManager = ({ courseId, courseName, courses = [], isTutorView = false }) => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingKeyId, setEditingKeyId] = useState(null);
    const [copiedKey, setCopiedKey] = useState(null);
    const [viewingKey, setViewingKey] = useState(null); // For "View" modal

    const [formData, setFormData] = useState({
        keyCode: '',
        maxUses: '',
        maxStudents: '',
        validUntil: '',
        description: '',
        selectedCourseId: courseId === 'all' ? '' : courseId,
        keyType: 'single',
        autoEnrollNewCourses: false
    });

    useEffect(() => {
        loadKeys();
    }, [courseId]);

    const loadKeys = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/enrollment/keys?courseId=${courseId}`);
            setKeys(response.data.keys || []);
        } catch (error) {
            console.error('Error loading keys:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Strict Length Validation: 4 to 12 chars
        const trimmedCode = formData.keyCode.trim();

        if (trimmedCode && (trimmedCode.length < 4 || trimmedCode.length > 12)) {
            alert('Selection Error: Enrollment Key must be between 4 and 12 characters.');
            return;
        }

        const isGlobal = formData.keyType === 'global';
        const targetCourseId = isGlobal ? null : (courseId === 'all' ? formData.selectedCourseId : courseId);
        
        if (!isGlobal && !targetCourseId) {
            alert('Please select a course');
            return;
        }

        if (isEditing && !trimmedCode) {
            alert('Key Code is required for editing');
            return;
        }

        try {
            const payload = {
                courseId: targetCourseId,
                keyType: formData.keyType,
                autoEnrollNewCourses: isGlobal ? formData.autoEnrollNewCourses : false,
                maxUses: formData.maxUses === '' ? null : parseInt(formData.maxUses),
                maxStudents: formData.maxStudents === '' ? null : parseInt(formData.maxStudents),
                validUntil: formData.validUntil || null,
                description: formData.description || (isGlobal ? 'Global Enrollment Key' : `Key for ${courses.find(c => String(c.id) === String(targetCourseId))?.name || courseName}`),
                keyCode: formData.keyCode || undefined,
                customCode: formData.keyCode || undefined
            };

            if (isEditing) {
                await axios.patch(`/api/enrollment/key/${editingKeyId}`, payload);
            } else {
                await axios.post('/api/enrollment/create-key', payload);
            }

            await loadKeys();
            resetForm();
        } catch (error) {
            console.error('Error saving key:', error);
            const errData = error.response?.data;
            const errMessage = (errData?.details || errData?.message || error.message || '').toLowerCase();
            
            const isMigrationPending = 
                errData?.code === 'MIGRATION_PENDING' || 
                errMessage.includes('auto_enroll_new_courses') || 
                errMessage.includes('key_type') || 
                errMessage.includes('schema cache') ||
                (errMessage.includes('column') && errMessage.includes('enrollment_keys'));

            if (isMigrationPending) {
                alert(
                    `⚠️ DATABASE SYNC REQUIRED\n\n` +
                    `The Global Enrollment Keys feature requires a database schema migration to be applied.\n\n` +
                    `👉 Instruction:\n` +
                    `Please copy the contents of the migration SQL file located at:\n` +
                    `"src/supabase/migrations/1776800000000-global_enrollment_keys.sql"\n\n` +
                    `and run it in your Supabase SQL Editor to enable Global Enrollment Keys.`
                );
            } else {
                alert(errData?.error || 'Failed to save key');
            }
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setIsEditing(false);
        setEditingKeyId(null);
        setFormData({
            keyCode: '',
            maxUses: '',
            maxStudents: '',
            validUntil: '',
            description: '',
            selectedCourseId: courseId === 'all' ? '' : courseId,
            keyType: 'single',
            autoEnrollNewCourses: false
        });
    };

    const startEditing = (key) => {
        // Ensure we are using the ID of the specific key clicked
        setEditingKeyId(key.id);
        setFormData({
            keyCode: key.key_code,
            maxUses: key.max_uses !== null ? key.max_uses : '',
            maxStudents: key.max_students !== null ? key.max_students : '',
            validUntil: key.valid_until ? new Date(key.valid_until).toISOString().slice(0, 16) : '',
            description: key.description || '',
            selectedCourseId: key.course_id || '',
            keyType: key.key_type || (key.course_id ? 'single' : 'global'),
            autoEnrollNewCourses: key.auto_enroll_new_courses || false
        });
        setIsEditing(true);
        setShowForm(true);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const copyToClipboard = (keyCode) => {
        navigator.clipboard.writeText(keyCode);
        setCopiedKey(keyCode);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const toggleKeyStatus = async (keyId, currentStatus) => {
        try {
            await axios.patch(`/api/enrollment/key/${keyId}`, {
                isActive: !currentStatus
            });
            await loadKeys();
        } catch (error) {
            console.error('Error toggling key:', error);
        }
    };

    const deleteKey = async (key) => {
        const isGlobal = key.key_type === 'global' || key.course_id === null;
        const warningMsg = isGlobal
            ? `⚠️ GLOBAL KEY DELETION\n\nDeleting "${key.key_code}" will immediately revoke access for ALL students who enrolled using this key across all courses.\n\nThis action cannot be undone. Continue?`
            : `Are you sure you want to delete the enrollment key "${key.key_code}"?\n\nAll students who enrolled using this key will lose access to their course.\n\nThis action cannot be undone.`;

        if (window.confirm(warningMsg)) {
            try {
                const response = await axios.delete(`/api/enrollment/key/${key.id}`);
                const revoked = response.data?.revokedEnrollments;
                await loadKeys();
                if (revoked > 0) {
                    alert(`✅ Key deleted. ${revoked} student enrollment${revoked !== 1 ? 's' : ''} have been revoked.`);
                }
            } catch (error) {
                console.error('Error deleting key:', error);
                alert('Failed to delete key');
            }
        }
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <SafeIcon icon={FiKey} className="text-blue-500" />
                        Enrollment Keys
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Scope:</span>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 underline decoration-blue-200">
                            {courseId === 'all' ? 'All Managed Courses' : courseName}
                        </span>
                        {courseId !== 'all' && <span className="text-xs text-gray-400">(ID: {courseId})</span>}
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={loadKeys}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Refresh list"
                    >
                        <SafeIcon icon={FiRefreshCw} className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            if (showForm && isEditing) resetForm();
                            else setShowForm(!showForm);
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold shadow-sm transition-colors ${showForm && isEditing ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        <SafeIcon icon={showForm && isEditing ? FiX : FiPlus} className="w-4 h-4" />
                        {showForm && isEditing ? 'Cancel Edit' : 'New Key'}
                    </motion.button>
                </div>
            </div>

            {/* Create/Edit Key Form */}
            {showForm && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-6 border-2 border-blue-100 dark:border-blue-800 shadow-sm"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <SafeIcon icon={isEditing ? FiEdit : FiPlus} className="text-blue-500" />
                            {isEditing ? 'Edit Enrollment Key' : 'Generate New Enrollment Key'}
                        </h4>
                        {isEditing && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                Editing Key ID: {editingKeyId}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Access Type Selector */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Access Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.keyType}
                                onChange={(e) => setFormData({ 
                                    ...formData, 
                                    keyType: e.target.value,
                                    selectedCourseId: e.target.value === 'global' ? '' : (courseId === 'all' ? '' : courseId)
                                })}
                                className="w-full px-4 py-3 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                            >
                                <option value="single">Single Course Access (Course-Specific Key)</option>
                                <option value="global">All Courses Access (Global Enrollment Key)</option>
                            </select>
                        </div>

                        {formData.keyType === 'single' ? (
                            courseId === 'all' ? (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Target Course <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.selectedCourseId}
                                        onChange={(e) => setFormData({ ...formData, selectedCourseId: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                                    >
                                        <option value="">Select a course...</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} (ID: {c.id})</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                        Target Course
                                    </label>
                                    <input
                                        type="text"
                                        disabled
                                        value={courseName}
                                        className="w-full px-4 py-3 border-2 border-gray-100 dark:border-gray-700 shadow-sm rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold"
                                    />
                                </div>
                            )
                        ) : (
                            <div className="md:col-span-2 bg-blue-100/30 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="autoEnrollNewCourses"
                                        checked={formData.autoEnrollNewCourses}
                                        onChange={(e) => setFormData({ ...formData, autoEnrollNewCourses: e.target.checked })}
                                        className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="autoEnrollNewCourses" className="cursor-pointer select-none">
                                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Auto-enroll in future courses</span>
                                        <span className="text-[10px] text-gray-500 font-medium">Newly created courses will be automatically accessible to users of this key</span>
                                    </label>
                                </div>
                                <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    Global Config
                                </span>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex justify-between">
                                <span>Key Code {isEditing ? '(Required)' : '(Optional - Leave empty for random)'}</span>
                                <span className={`text-[10px] ${formData.keyCode.length > 0 && (formData.keyCode.length < 4 || formData.keyCode.length > 12) ? 'text-red-500' : 'text-gray-400'}`}>
                                    {formData.keyCode.length}/12 chars (Min 4)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={formData.keyCode}
                                maxLength={12}
                                onChange={(e) => setFormData({ ...formData, keyCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
                                placeholder="e.g. SUMMER-2024"
                                className={`w-full px-4 py-3 border-2 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono uppercase tracking-widest text-lg ${formData.keyCode.length > 0 && (formData.keyCode.length < 4 || formData.keyCode.length > 12)
                                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                                    : 'border-white dark:border-gray-700'
                                    }`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Max Uses
                            </label>
                            <input
                                type="number"
                                value={formData.maxUses}
                                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                                placeholder="Unlimited (Leave empty)"
                                className="w-full px-4 py-2 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <p className="text-[10px] text-gray-500 font-semibold mt-1">LIFETIME USAGES</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Max Students
                            </label>
                            <input
                                type="number"
                                value={formData.maxStudents}
                                onChange={(e) => setFormData({ ...formData, maxStudents: e.target.value })}
                                placeholder="Unlimited (Leave empty)"
                                className="w-full px-4 py-2 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <p className="text-[10px] text-gray-500 font-semibold mt-1">MAX UNIQUE STUDENTS</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Expiration Date
                            </label>
                            <input
                                type="datetime-local"
                                value={formData.validUntil}
                                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                className="w-full px-4 py-2 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <p className="text-[10px] text-gray-500 font-semibold mt-1">LEAVE EMPTY TO NEVER EXPIRE</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Internal Description
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="e.g. Batch B - Jan 2024"
                                className="w-full px-4 py-2 border-2 border-white dark:border-gray-700 shadow-sm rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={handleSubmit}
                            className={`flex-1 py-3 px-6 text-white font-bold rounded-xl shadow-lg transition-all ${isEditing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {isEditing ? 'Update Enrollment Key' : 'Generate Key'}
                        </button>
                        <button
                            onClick={resetForm}
                            className="px-6 py-3 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold border-2 border-gray-100 dark:border-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Keys List */}
            {loading ? (
                <div className="grid place-content-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col items-center gap-4">
                        <SafeIcon icon={FiRefreshCw} className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="text-gray-500 font-medium">Validating your keys...</p>
                    </div>
                </div>
            ) : keys.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <SafeIcon icon={FiKey} className="w-10 h-10 text-gray-300" />
                    </div>
                    <h5 className="text-lg font-bold text-gray-900 dark:text-white">No Keys Found</h5>
                    <p className="text-gray-500 mt-2 max-w-sm mx-auto">
                        This course doesn't have any enrollment keys yet. Students will only be able to join if you generate a key.
                    </p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-6 text-blue-600 font-bold hover:underline"
                    >
                        Create your first key →
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {keys.map((key) => {
                        const usageRatio = key.max_uses ? (key.current_uses / key.max_uses) * 100 : 0;
                        const isExpired = key.valid_until && new Date(key.valid_until) < new Date();
                        const isAtRisk = usageRatio > 80;
                        const isKeyGlobal = key.key_type === 'global' || key.course_id === null;
                        const displayCourseName = isKeyGlobal ? 'All Courses (Global Key)' : (key.course?.name || courseName);
                        const displayCourseId = isKeyGlobal ? 'ALL' : (key.course_id || courseId);

                        return (
                            <motion.div
                                key={key.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border-2 transition-all ${key.is_active && !isExpired
                                    ? 'border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800'
                                    : 'border-red-50 border-gray-100 dark:border-red-900/20 bg-red-50/20 opacity-75'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                                                <SafeIcon icon={FiKey} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <code className="text-xl font-mono font-black text-gray-900 dark:text-white tracking-widest">
                                                        {key.key_code}
                                                    </code>
                                                    {isKeyGlobal ? (
                                                        <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-lg uppercase tracking-wider shadow-sm">
                                                            All Courses Access
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                                            Single Course Access
                                                        </span>
                                                    )}
                                                    <button
                                                        onClick={() => copyToClipboard(key.key_code)}
                                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group"
                                                        title="Copy Key"
                                                    >
                                                        <SafeIcon
                                                            icon={copiedKey === key.key_code ? FiCheck : FiCopy}
                                                            className={`w-4 h-4 ${copiedKey === key.key_code ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`}
                                                        />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-black text-gray-300 uppercase">Description:</span>
                                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                                                        {key.description || 'No description provided'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
 
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Course Reference Tooltip-style card */}
                                            <div className="bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-600">
                                                <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase mb-1">
                                                    <SafeIcon icon={FiBook} className="w-2.5 h-2.5" />
                                                    Linked Course
                                                </div>
                                                <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate">
                                                    {displayCourseName}
                                                </p>
                                                <p className="text-[9px] font-mono text-gray-400">ID: {displayCourseId}</p>
                                            </div>
 
                                            <div className="flex flex-col justify-center">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                                                    <span>Usage</span>
                                                    <span>{key.current_uses} / {key.max_uses || '∞'}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-500 ${isAtRisk ? 'bg-red-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(usageRatio, 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
 
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Max Students</span>
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                                                    <SafeIcon icon={FiUsers} className="w-4 h-4 text-purple-500" />
                                                    {key.max_students || 'No Limit'}
                                                </div>
                                            </div>
 
                                            <div className="flex flex-col justify-center">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase mb-1">Validity</span>
                                                <div className={`flex items-center gap-2 text-sm font-bold ${isExpired ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    <SafeIcon icon={FiCalendar} className="w-4 h-4" />
                                                    {key.valid_until ? new Date(key.valid_until).toLocaleDateString() : 'Lifetime'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex lg:flex-col gap-2">
                                        <button
                                            onClick={() => setViewingKey(key)}
                                            className="p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                                            title="View Details"
                                        >
                                            <SafeIcon icon={FiInfo} className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => startEditing(key)}
                                            className="p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all shadow-sm"
                                            title="Edit Key"
                                        >
                                            <SafeIcon icon={FiEdit} className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => toggleKeyStatus(key.id, key.is_active)}
                                            className={`p-3 rounded-xl transition-all shadow-sm ${key.is_active
                                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                }`}
                                            title={key.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            <SafeIcon icon={key.is_active ? FiEye : FiEyeOff} className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => deleteKey(key)}
                                            className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all shadow-sm"
                                            title="Delete permanently"
                                        >
                                            <SafeIcon icon={FiTrash2} className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center gap-2">
                                    <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${key.is_active && !isExpired
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${key.is_active && !isExpired ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        {!key.is_active ? 'Inactive' : isExpired ? 'Expired' : 'Live & Active'}
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-300 uppercase">Created: {new Date(key.created_at).toLocaleDateString()}</span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* View Details Modal */}
            {viewingKey && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-700"
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
                                    <SafeIcon icon={FiInfo} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">Key Details</h4>
                            </div>
                            <button onClick={() => setViewingKey(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <SafeIcon icon={FiX} className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                                <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Active Enrollment Key</span>
                                <code className="text-2xl font-mono font-black text-blue-600 dark:text-blue-400 tracking-tighter block">
                                    {viewingKey.key_code}
                                </code>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700 col-span-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Access Scope</span>
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {viewingKey.key_type === 'global' || viewingKey.course_id === null ? 'All Courses Access (Global Key)' : 'Single Course Access'}
                                    </p>
                                </div>
                                {viewingKey.key_type !== 'global' && viewingKey.course_id !== null ? (
                                    <>
                                        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Course</span>
                                            <p className="font-bold text-gray-900 dark:text-white truncate">{viewingKey.course?.name || courseName}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700">
                                            <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Course ID</span>
                                            <p className="font-bold text-gray-900 dark:text-white font-mono">{viewingKey.course_id || courseId}</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700 col-span-2">
                                        <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Auto-enroll in future courses</span>
                                        <p className="font-bold text-gray-900 dark:text-white">
                                            {viewingKey.auto_enroll_new_courses ? 'Enabled (Automatically enroll in new courses)' : 'Disabled'}
                                        </p>
                                    </div>
                                )}
                                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Total Usages</span>
                                    <p className="font-bold text-gray-900 dark:text-white">{viewingKey.current_uses}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border-2 border-gray-50 dark:border-gray-700">
                                    <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Limit</span>
                                    <p className="font-bold text-gray-900 dark:text-white">{viewingKey.max_uses || 'None'}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setViewingKey(null)}
                                className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black rounded-2xl text-center hover:opacity-90 transition-opacity"
                            >
                                Close Details
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default EnrollmentKeyManager;
