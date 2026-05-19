import React, { useState, useEffect } from 'react';
import { courseService } from '../../services/api';
import EnrollmentKeyManager from './EnrollmentKeyManager';

const AdminEnrollmentKeys = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await courseService.getAll();
            setCourses(response.data || []);
        } catch (error) {
            console.error('Error fetching courses for keys manager:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center flex flex-col items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-blue-600 dark:text-blue-400 font-bold">Loading enrollment system...</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 transition-all">
            <EnrollmentKeyManager
                courseId="all"
                courseName="All Courses"
                courses={courses}
                isTutorView={false}
            />
        </div>
    );
};

export default AdminEnrollmentKeys;
