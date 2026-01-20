import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import { useLocation, Link } from 'react-router-dom';

const { FiUsers, FiSearch, FiFilter, FiMail, FiBarChart2, FiCalendar, FiBook } = FiIcons;

const TutorStudents = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const initialCourseFilter = queryParams.get('courseId') || '';

    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [courseFilter, setCourseFilter] = useState(initialCourseFilter);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, [courseFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [studentsRes, dashboardRes] = await Promise.all([
                tutorService.getStudents(courseFilter || null),
                tutorService.getDashboard()
            ]);
            setStudents(studentsRes.data.students || []);
            setCourses(dashboardRes.data.courses || []);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading && students.length === 0) return <div className="p-8 text-center text-blue-600 font-bold animate-pulse">Loading students...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Student Roster</h2>
                    <p className="text-gray-500 dark:text-gray-400">View and track student performance across your courses</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <SafeIcon icon={FiSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Find student..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm">
                        <SafeIcon icon={FiFilter} className="text-gray-400 w-4 h-4" />
                        <select
                            value={courseFilter}
                            onChange={(e) => setCourseFilter(e.target.value)}
                            className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none"
                        >
                            <option value="">All Courses</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Student</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Enrolled Course</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Enrollment Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Progress</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery || courseFilter ? 'No students match your filters.' : 'No students found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map(student => (
                                    <tr key={`${student.id}-${student.enrolled_course_id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-black text-sm uppercase">
                                                    {student.name?.charAt(0) || 'S'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{student.name}</p>
                                                    <p className="text-xs text-gray-500">{student.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                <SafeIcon icon={FiBook} className="text-gray-400" />
                                                {courses.find(c => String(c.id) === String(student.enrolled_course_id))?.name || 'Assigned Course'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <SafeIcon icon={FiCalendar} className="text-gray-400" />
                                                {new Date(student.enrolled_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.min((student.progress_count || 0) * 10, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                    {typeof student.progress_count === 'object' ? (student.progress_count.count || 0) : (student.progress_count || 0)} Lessons
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => window.location.href = `mailto:${student.email}`}
                                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                                    title="Send Email"
                                                >
                                                    <SafeIcon icon={FiMail} />
                                                </button>
                                                <Link
                                                    to={`/tutor/grades?studentId=${student.id}&courseId=${student.enrolled_course_id}`}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                                    title="View Detailed Progress"
                                                >
                                                    <SafeIcon icon={FiBarChart2} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TutorStudents;
