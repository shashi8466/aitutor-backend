import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService, tutorService } from '../../services/api';
import EnrollmentKeyManager from '../admin/EnrollmentKeyManager'; // Reuse existing logic

const TutorEnrollmentKeys = ({ dashboardData, isParentLoading }) => {
    const [courses, setCourses] = useState(dashboardData?.courses || []);
    const [loading, setLoading] = useState(!dashboardData && isParentLoading);

    useEffect(() => {
        if (dashboardData?.courses) {
            setCourses(dashboardData.courses);
            setLoading(false);
        } else if (!isParentLoading && !dashboardData) {
            fetchCourses();
        } else if (isParentLoading) {
            setLoading(true);
        }
    }, [dashboardData, isParentLoading]);

    const fetchCourses = async () => {
        if (!dashboardData) setLoading(true);
        const timeoutId = setTimeout(() => {
            if (loading) setLoading(false);
        }, 10000);

        try {
            const response = await tutorService.getDashboard();
            setCourses(response.data.courses || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="p-12 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-600 font-bold">Loading enrollment system...</p>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Enrollment Key Management</h2>
                <p className="text-gray-500 dark:text-gray-400">Create codes for student self-enrollment</p>
            </div>

            <EnrollmentKeyManager
                courseId="all"
                courses={courses}
                isTutorView={true}
            />
        </div>
    );
};

export default TutorEnrollmentKeys;
