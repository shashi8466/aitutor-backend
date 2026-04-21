import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/api';

const { FiUsers, FiSearch, FiX, FiArrowRight, FiShield, FiUser } = FiIcons;

const DashboardPreviewer = ({ isOpen, onClose }) => {
    const { setPreviewUser, previewUser } = useAuth();
    const [role, setRole] = useState('student');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            loadUsers(role);
        }
    }, [isOpen, role]);

    const loadUsers = async (targetRole) => {
        setLoading(true);
        try {
            const res = await authService.getProfilesByRole(targetRole);
            setUsers(res.data || []);
        } catch (err) {
            console.error('Failed to load users for preview', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user) => {
        setPreviewUser(user);
        onClose();
        // Navigating to the respective dashboard
        const roleRoutes = {
            student: '/student',
            tutor: '/tutor',
            parent: '/parent',
            admin: '/admin'
        };
        navigate(roleRoutes[user.role] || '/student');
    };

    if (!isOpen) return null;

    const filteredUsers = users.filter(u => 
        (u.name || '').toLowerCase().includes(search.toLowerCase()) || 
        (u.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                           <SafeIcon icon={FiShield} className="w-5 h-5 text-sky-500" />
                           Switch View / Preview
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">Preview any dashboard without changing your session</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <SafeIcon icon={FiX} className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
                        {['student', 'tutor', 'parent'].map(r => (
                            <button
                                key={r}
                                onClick={() => { setRole(r); setSearch(''); }}
                                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                    role === r 
                                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-md' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <div className="relative mb-6">
                        <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder={`Search ${role}s by name or email...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all dark:text-white shadow-inner"
                        />
                    </div>

                    <div className="max-h-[350px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                        {loading ? (
                            <div className="py-20 text-center">
                                <div className="animate-spin w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-500 font-bold text-sm animate-pulse">Fetching members...</p>
                            </div>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => handleSelectUser(u)}
                                    className="w-full flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-[20px] hover:border-sky-500 dark:hover:border-sky-500 hover:bg-white dark:hover:bg-slate-700/50 transition-all group shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-black text-lg">
                                            {u.name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{u.name}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">{u.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-sky-600">Enter View</span>
                                        <SafeIcon icon={FiArrowRight} className="w-4 h-4 text-sky-600" />
                                    </div>
                                </button>
                            ))
                        ) : (
                            <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                                <p className="text-slate-400 font-bold text-sm underline decoration-slate-200 underline-offset-4">No {role}s match this query</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPreviewer;
