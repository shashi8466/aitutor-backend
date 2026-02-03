import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FiUser, FiMail, FiLock, FiBell, FiSave, FiShield } from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const TutorSettings = () => {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        emailNotifications: true,
        testCompletions: true
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulation of API call
        setTimeout(() => {
            setIsLoading(false);
            alert('Profile updated successfully');
            setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        }, 1500);
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
                <p className="text-gray-500 dark:text-gray-400">Manage your profile details and preferences</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <SafeIcon icon={FiUser} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Profile Information</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Update your public profile information</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</label>
                            <div className="relative">
                                <SafeIcon icon={FiUser} className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Your Name"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email Address</label>
                            <div className="relative">
                                <SafeIcon icon={FiMail} className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    disabled
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 cursor-not-allowed"
                                />
                            </div>
                            <p className="text-xs text-gray-500">Contact admin to change your email address</p>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                            <SafeIcon icon={FiShield} className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Security</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your password and security</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Password</label>
                            <div className="relative">
                                <SafeIcon icon={FiLock} className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={formData.newPassword}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Leave blank to keep current"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications Section */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
                        <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                            <SafeIcon icon={FiBell} className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Control what emails you receive</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Email Notifications</span>
                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input type="checkbox" name="emailNotifications" checked={formData.emailNotifications} onChange={handleChange} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                                <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.emailNotifications ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                            </div>
                        </label>
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Student Test Completions</span>
                            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                <input type="checkbox" name="testCompletions" checked={formData.testCompletions} onChange={handleChange} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" />
                                <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.testCompletions ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <SafeIcon icon={FiSave} className="w-5 h-5" />
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* CSS for custom toggle switch */}
            <style jsx>{`
                .toggle-checkbox:checked {
                    right: 0;
                    border-color: #3B82F6;
                }
                .toggle-checkbox {
                    right: 24px;
                    transition: all 0.3s;
                }
            `}</style>
        </div>
    );
};

export default TutorSettings;
