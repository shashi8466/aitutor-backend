import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import { Link } from 'react-router-dom';
import axios from 'axios';

const { FiBook, FiUsers, FiClock, FiChevronRight, FiTrendingUp } = FiIcons;

const TutorCourses = () => {
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

    if (loading) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading assigned courses...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Assigned Courses</h2>
                    <p className="text-gray-500 dark:text-gray-400">Courses you are authorized to manage</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.length === 0 ? (
                    <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <SafeIcon icon={FiBook} className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Courses Assigned</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">Contact an administrator to be assigned to courses.</p>

                        {/* Debug Section */}
                        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 text-left">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Access Diagnostics</h4>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await axios.get('/api/tutor/diagnostics');
                                        alert(JSON.stringify(res.data, null, 2));
                                    } catch (e) {
                                        alert('Failed to fetch diagnostics: ' + e.message);
                                    }
                                }}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                            >
                                Verify My Access Permissions →
                            </button>
                        </div>
                    </div>
                ) : (
                    courses.map(course => (
                        <motion.div
                            key={course.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                        <SafeIcon icon={FiBook} className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">
                                        Active
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {course.name}
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2">
                                    {course.description || 'No description provided.'}
                                </p>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enrolled</span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                            <SafeIcon icon={FiUsers} className="w-3 h-3 text-blue-500" />
                                            {typeof course.enrolled_count === 'object' ? (course.enrolled_count.count || 0) : (course.enrolled_count || 0)} Students
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Created</span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                            <SafeIcon icon={FiClock} className="w-3 h-3 text-indigo-500" />
                                            {new Date(course.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 flex gap-2">
                                    <Link
                                        to={`/tutor/grades?courseId=${course.id}`}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-black dark:hover:bg-blue-600 hover:text-white transition-all"
                                    >
                                        <SafeIcon icon={FiTrendingUp} /> Analytics
                                    </Link>
                                    <Link
                                        to={`/tutor/students?courseId=${course.id}`}
                                        className="p-2 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                    >
                                        <SafeIcon icon={FiUsers} />
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TutorCourses;
