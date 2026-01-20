import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService, tutorService } from '../../services/api';

const { FiMail, FiLink, FiCopy, FiPlus, FiCalendar, FiUsers, FiX, FiCheck, FiInfo, FiTrash2, FiClock, FiAlertCircle } = FiIcons;

const TutorInvitations = () => {
    const [invitations, setInvitations] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [copyStatus, setCopyStatus] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        courseId: '',
        maxUses: '',
        validUntil: '',
        description: 'Student Invitation'
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [keysRes, dashboardRes] = await Promise.all([
                enrollmentService.getKeys(),
                tutorService.getDashboard()
            ]);
            // Filter keys to only show those that are "Invitations" (optional logic, but here we show all tutor keys)
            setInvitations(keysRes.data.keys || []);
            setCourses(dashboardRes.data.courses || []);
        } catch (error) {
            console.error('Error loading invitations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLink = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const res = await enrollmentService.createKey(formData);
            if (res.data.key) {
                setShowModal(false);
                setFormData({ courseId: '', maxUses: '', validUntil: '', description: 'Student Invitation' });
                loadData();
            }
        } catch (err) {
            console.error('Error creating invitation:', err);
            const errMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to create invitation link';
            setError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const generateLink = (keyCode) => {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}#/signup?key=${keyCode}`;
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopyStatus(id);
        setTimeout(() => setCopyStatus(null), 2000);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to disable this invitation link? Students will no longer be able to use it.')) return;
        try {
            await enrollmentService.deleteKey(id);
            loadData();
        } catch (error) {
            console.error('Error deleting key:', error);
        }
    };

    if (loading && invitations.length === 0) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading invitations...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Invitation Links</h2>
                    <p className="text-gray-500 dark:text-gray-400">Generate secure signup links with auto-enrollment</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 dark:shadow-none transition-all"
                >
                    <SafeIcon icon={FiPlus} /> Generate New Link
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {invitations.length === 0 ? (
                    <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-700 text-center">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <SafeIcon icon={FiMail} className="w-10 h-10 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Invitation Links</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                            Create a course-specific link to invite students. They will be auto-enrolled upon registration.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="text-blue-600 font-bold hover:underline"
                        >
                            + Generate your first link
                        </button>
                    </div>
                ) : (
                    invitations.map(invite => (
                        <motion.div
                            key={invite.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col gap-4 relative group"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                                        <SafeIcon icon={FiLink} className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{invite.course?.name || 'Assigned Course'}</h4>
                                        <p className="text-xs text-gray-500 font-medium">Code: <span className="text-indigo-600 font-black">{invite.key_code}</span></p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${invite.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/20' : 'bg-red-100 text-red-700 dark:bg-red-900/20'}`}>
                                        {invite.is_active ? 'Active' : 'Disabled'}
                                    </span>
                                    <button
                                        onClick={() => handleDelete(invite.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Shareable Invitation Link</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        readOnly
                                        value={generateLink(invite.key_code)}
                                        className="flex-1 bg-white dark:bg-gray-800 border-none text-xs font-medium text-gray-600 dark:text-gray-400 truncate py-1 px-2 rounded-lg"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(generateLink(invite.key_code), invite.id)}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${copyStatus === invite.id ? 'bg-green-500 text-white' : 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'}`}
                                    >
                                        <SafeIcon icon={copyStatus === invite.id ? FiCheck : FiCopy} />
                                        {copyStatus === invite.id ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold">
                                    <SafeIcon icon={FiUsers} className="text-blue-500" />
                                    <span>{invite.usage_count || 0} / {invite.max_uses || '∞'} Uses</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold justify-end">
                                    <SafeIcon icon={FiCalendar} className="text-indigo-500" />
                                    <span>Exp: {invite.valid_until ? new Date(invite.valid_until).toLocaleDateString() : 'Never'}</span>
                                </div>
                            </div>

                            {invite.usage_count >= invite.max_uses && invite.max_uses !== null && (
                                <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-[2px] rounded-3xl flex items-center justify-center p-6 text-center z-10 transition-opacity">
                                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl shadow-xl">
                                        <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                        <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Limit Reached</p>
                                        <p className="text-xs text-gray-500 mt-1">This invitation link is no longer valid.</p>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Create Invitation</h3>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                                    <SafeIcon icon={FiX} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateLink} className="space-y-4">
                                {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2"><SafeIcon icon={FiAlertCircle} /> {error}</div>}

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Target Course</label>
                                    <select
                                        required
                                        value={formData.courseId}
                                        onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                                    >
                                        <option value="">Select a course</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>{course.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Usage Limit (Max Students)</label>
                                        <div className="relative">
                                            <SafeIcon icon={FiUsers} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="number"
                                                placeholder="Unlimited"
                                                value={formData.maxUses}
                                                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                                        <div className="relative">
                                            <SafeIcon icon={FiCalendar} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="date"
                                                value={formData.validUntil}
                                                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl flex gap-3">
                                    <SafeIcon icon={FiInfo} className="text-blue-500 mt-1 flex-shrink-0" />
                                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                                        Students who register using this link will be <strong>automatically enrolled</strong> in the selected course.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {submitting ? <SafeIcon icon={FiClock} className="animate-spin" /> : <SafeIcon icon={FiLink} />}
                                    Generate Invitation Link
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TutorInvitations;
