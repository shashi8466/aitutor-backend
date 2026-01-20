import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, enrollmentService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiBook, FiPlay, FiLoader, FiSearch, FiPlusCircle, FiCheckCircle } = FiIcons;

const StudentCourseList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allCourses, setAllCourses] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [enrollLoading, setEnrollLoading] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [coursesRes, enrollmentsRes] = await Promise.all([
        courseService.getAll(),
        enrollmentService.getStudentEnrollments(user.id)
      ]);

      setAllCourses(coursesRes.data || []);

      const ids = new Set((enrollmentsRes.data || []).map(e => e.course_id));
      setEnrolledIds(ids);
    } catch (error) {
      console.error("Failed to load courses", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    if (!user || !user.id) {
      alert("Please log in to enroll.");
      return;
    }

    try {
      setEnrollLoading(courseId);
      const cId = parseInt(courseId, 10);

      // START FIX: Check if course requires key first
      // We do this by checking the 'enrollment_key' requirement directly if possible, or handling the specific failure

      // Better approach: We should know if the course requires a key from the course object itself if possible,
      // but since we might not have that flag, we can rely on the initiateEnrollment response more robustly

      // However, the issue is initiateEnrollment might be returning an error that is not being caught correctly above
      // OR we need to preemptively redirect if we know it's a key-based course.

      // Let's rely on the initiateEnrollment response but make sure we catch the specific case
      const response = await enrollmentService.initiateEnrollment(user.id, cId);

      // Check if the response explicitly tells us a key is required
      if (response.data?.requiresKey) {
        navigate('/student/enroll', { state: { courseId: cId, courseName: response.data.courseName || 'Course' } });
        return;
      }

      // If it returns an error saying key is required (backup check)
      if (response.data?.error && (response.data.error.includes('key') || response.data.error.includes('Key'))) {
        navigate('/student/enroll', { state: { courseId: cId, courseName: response.data.courseName || 'Course' } });
        return;
      }

      // For paid courses, redirect to Stripe Checkout
      if (response.data?.url) {
        console.log('🔗 Redirecting to Stripe Checkout:', response.data.url);
        // CRITICAL: Redirect to Stripe's hosted checkout page
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }

    } catch (error) {
      console.error("Enrollment initiation failed", error);
      alert(error.response?.data?.error || "Enrollment failed. Please try again or contact support.");
    } finally {
      setEnrollLoading(null);
    }
  };

  const filteredCourses = allCourses.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    c.description?.toLowerCase().includes(filter.toLowerCase())
  );

  const enrolledCourses = filteredCourses.filter(c => enrolledIds.has(c.id));
  const availableCourses = filteredCourses.filter(c => !enrolledIds.has(c.id));

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <SafeIcon icon={FiLoader} className="w-8 h-8 text-[#E53935] animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Courses</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your learning journey.</p>
        </div>

        <div className="relative w-full md:w-72">
          <SafeIcon icon={FiSearch} className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search courses..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none text-sm transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Enrolled Section */}
      {enrolledCourses.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <SafeIcon icon={FiCheckCircle} className="text-green-500" /> My Enrollments
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledCourses.map((course, idx) => (
              <CourseCard
                key={course.id}
                course={course}
                index={idx}
                isEnrolled={true}
                onAction={() => navigate(`/student/course/${course.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Available Section */}
      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <SafeIcon icon={FiBook} className="text-[#E53935]" /> Available Courses
        </h2>
        {availableCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map((course, idx) => (
              <CourseCard
                key={course.id}
                course={course}
                index={idx}
                isEnrolled={false}
                isLoading={enrollLoading === course.id}
                onAction={() => handleEnroll(course.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              {filter ? 'No courses match your search.' : 'No new courses available at the moment.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

const CourseCard = ({ course, index, isEnrolled, onAction, isLoading }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group flex flex-col h-full"
  >
    <div className="p-6 flex-1">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isEnrolled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 group-hover:bg-[#E53935] group-hover:text-white'}`}>
          <SafeIcon icon={FiBook} className="w-6 h-6" />
        </div>
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{course.tutor_type || 'General'}</span>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight line-clamp-1">{course.name}</h3>
        </div>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{course.description}</p>

      {isEnrolled && (
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-1/3 rounded-full"></div>
          </div>
          <span className="text-xs font-bold text-gray-500">Active</span>
        </div>
      )}
    </div>

    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
      <button
        onClick={onAction}
        disabled={isLoading}
        className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2
          ${isEnrolled
            ? 'bg-white border border-gray-200 text-gray-900 hover:border-[#E53935] hover:text-[#E53935]'
            : 'bg-[#E53935] text-white hover:bg-[#d32f2f] shadow-md shadow-red-500/20'
          } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
        ) : isEnrolled ? (
          <><SafeIcon icon={FiPlay} className="w-4 h-4" /> Continue Learning</>
        ) : (
          <><SafeIcon icon={FiPlusCircle} className="w-4 h-4" /> Enroll Now</>
        )}
      </button>
    </div>
  </motion.div>
);

export default StudentCourseList;