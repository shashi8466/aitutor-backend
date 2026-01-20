import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { enrollmentService, tutorService } from '../../services/api';
import EnrollmentKeyManager from '../admin/EnrollmentKeyManager'; // Reuse existing logic

const TutorEnrollmentKeys = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await tutorService.getDashboard();
            setCourses(response.data.courses || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading enrollment system...</div>;

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
