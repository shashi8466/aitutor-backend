import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService } from '../../services/api';

const { FiCheckCircle, FiLoader, FiAlertCircle } = FiIcons;

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [verifying, setVerifying] = useState(true);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState('');
    const [courseInfo, setCourseInfo] = useState(null);

    useEffect(() => {
        verifyPayment();
    }, []);

    const verifyPayment = async () => {
        const sessionId = searchParams.get('session_id');
        const courseId = searchParams.get('course_id');

        if (!sessionId) {
            setError('No payment session found');
            setVerifying(false);
            return;
        }

        try {
            // Verify the payment with backend
            const response = await enrollmentService.verifyPaymentSession(sessionId);

            if (response.data.success) {
                setVerified(true);
                setCourseInfo({
                    id: response.data.courseId,
                    name: response.data.courseName
                });

                // Redirect to course after 3 seconds
                setTimeout(() => {
                    navigate(`/student/course/${response.data.courseId}`);
                }, 3000);
            } else {
                setError('Payment verification failed. Please contact support.');
            }
        } catch (err) {
            console.error('Payment verification error:', err);
            setError('Failed to verify payment. Please contact support with your payment receipt.');
        } finally {
            setVerifying(false);
        }
    };

    if (verifying) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-12 max-w-md w-full text-center"
                >
                    <SafeIcon icon={FiLoader} className="w-16 h-16 text-blue-600 mx-auto animate-spin mb-6" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying Payment</h2>
                    <p className="text-gray-600 dark:text-gray-400">Please wait while we confirm your payment...</p>
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-12 max-w-md w-full text-center"
                >
                    <SafeIcon icon={FiAlertCircle} className="w-16 h-16 text-red-600 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Failed</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/student/courses')}
                        className="px-6 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-colors"
                    >
                        Return to Courses
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 100 }}
                className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-12 max-w-md w-full text-center"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <SafeIcon icon={FiCheckCircle} className="w-12 h-12 text-green-600" />
                </motion.div>

                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Payment Successful!</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You have successfully enrolled in{' '}
                    <span className="font-bold text-[#E53935]">{courseInfo?.name || 'the course'}</span>
                </p>

                <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-500" />
                        <span>Payment verified</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-500" />
                        <span>Enrollment confirmed</span>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                        Redirecting you to the course in 3 seconds...
                    </p>
                </div>

                <button
                    onClick={() => navigate(`/student/course/${courseInfo?.id}`)}
                    className="mt-6 w-full px-6 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] transition-colors shadow-lg shadow-red-200 dark:shadow-none"
                >
                    Start Learning Now
                </button>
            </motion.div>
        </div>
    );
};

export default PaymentSuccess;
