import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const { FiKey, FiCheck, FiX, FiLoader, FiAlertCircle, FiCheckCircle } = FiIcons;

const EnrollmentKeyInput = ({ onSuccess }) => {
    const [keyCode, setKeyCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [validationInfo, setValidationInfo] = useState(null);
    const location = useLocation(); // Get location to access state
    const navigate = useNavigate(); // For navigation

    // Check if we came from a course that requires a key
    const fromCourse = location.state?.courseId;
    const courseNameFromState = location.state?.courseName;

    useEffect(() => {
        // If we came from a specific course, show a message
        if (fromCourse && courseNameFromState) {
            setError(`This course (${courseNameFromState}) requires an enrollment key. Please enter the key below.`);
        }
    }, [fromCourse, courseNameFromState]);

    const validateKey = async (code) => {
        if (!code || code.length < 4 || code.length > 12) {
            setValidationInfo(null);
            return;
        }

        setValidating(true);
        try {
            const response = await axios.post('/api/enrollment/validate-key', { keyCode: code });
            setValidationInfo(response.data);
            setError('');
        } catch (err) {
            setValidationInfo(null);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            }
        } finally {
            setValidating(false);
        }
    };

    const handleChange = (e) => {
        const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        setKeyCode(value);
        setError('');
        setSuccess('');

        // Auto-validate when key looks long enough
        if (value.length >= 4) {
            validateKey(value);
        } else {
            setValidationInfo(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (keyCode.length < 4 || keyCode.length > 12) {
            setError('Enrollment Key must be between 4 and 12 characters.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post('/api/enrollment/use-key', { keyCode });

            if (response.data.enrolled) {
                setSuccess(`Successfully enrolled! Welcome to the course.`);
                setKeyCode('');
                setValidationInfo(null);

                if (onSuccess) {
                    setTimeout(() => onSuccess(), 2000);
                } else {
                    // If we came from a specific course enrollment, redirect back to that course
                    if (fromCourse) {
                        setTimeout(() => {
                            navigate(`/student/course/${fromCourse}`);
                        }, 2000);
                    }
                }
            }
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to use enrollment key. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                    <SafeIcon icon={FiKey} className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        Enter Enrollment Key
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Got a key from your tutor? Enter it below
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Key Input */}
                <div>
                    <label htmlFor="enrollmentKey" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Enrollment Key
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            id="enrollmentKey"
                            value={keyCode}
                            onChange={handleChange}
                            maxLength={12}
                            placeholder="E.G. SUMMER-2024"
                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono font-bold tracking-widest text-lg uppercase"
                            required
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {validating ? (
                                <SafeIcon icon={FiLoader} className="w-5 h-5 text-gray-400 animate-spin" />
                            ) : validationInfo?.valid ? (
                                <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-green-500" />
                            ) : error ? (
                                <SafeIcon icon={FiAlertCircle} className="w-5 h-5 text-red-500" />
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Validation Info */}
                {validationInfo?.valid && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <SafeIcon icon={FiCheckCircle} className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-green-900 dark:text-green-100 mb-1">
                                    Valid Key!
                                </p>
                                <p className="text-sm text-green-800 dark:text-green-200">
                                    Course: <strong>{validationInfo.courseName}</strong>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Error Message */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <SafeIcon icon={FiAlertCircle} className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                            <p className="flex-1 text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    </motion.div>
                )}

                {/* Success Message */}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
                    >
                        <div className="flex items-start gap-3">
                            <SafeIcon icon={FiCheckCircle} className="w-6 h-6 text-green-600 dark:text-green-400" />
                            <div className="flex-1">
                                <p className="font-semibold text-green-900 dark:text-green-100 mb-1">
                                    Enrollment Successful!
                                </p>
                                <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading || !validationInfo?.valid || success}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-lg transition-all ${success
                        ? 'bg-green-600 cursor-not-allowed'
                        : validationInfo?.valid
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                            : 'bg-gray-400 cursor-not-allowed'
                        }`}
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                            Enrolling...
                        </span>
                    ) : success ? (
                        <span className="flex items-center justify-center gap-2">
                            <SafeIcon icon={FiCheck} className="w-5 h-5" />
                            Enrolled Successfully!
                        </span>
                    ) : (
                        'Enroll in Course'
                    )}
                </motion.button>
            </form>

            {/* Help Text */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Don't have an enrollment key?
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Ask your tutor or administrator for a key</li>
                    <li>• Check your email for an invitation link</li>
                    <li>• Enrollment keys are usually 10-15 characters</li>
                </ul>
            </div>
        </div>
    );
};

export default EnrollmentKeyInput;
