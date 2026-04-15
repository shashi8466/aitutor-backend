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
  const [activeCategory, setActiveCategory] = useState('SAT');
  const [activeSubcategory, setActiveSubcategory] = useState('All');

  const COURSE_CATEGORIES = {
    'SAT': ['SAT Math', 'SAT Reading & Writing'],
    'ACT': ['ACT Math', 'ACT English', 'ACT Science'],
    'AP': ['AP Physics', 'AP Chemistry', 'AP Biology', 'AP Pre-Calculus', 'Algebra 1', 'Algebra 2', 'Geometry']
  };

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

  const filteredCourses = allCourses.filter(c => {
    // 1. Must NOT be an official practice course (those go to Practice section)
    if (c.is_practice) return false;

    // 2. Must be active (if status column exists)
    if (c.status && c.status !== 'active') return false;

    // 3. Category Filter Match
    const mainCat = c.main_category || (
        (c.tutor_type || '').toLowerCase().includes('sat') ? 'SAT' :
        (c.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
        ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science'].some(kw => (c.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
    );
    
    if (activeCategory !== mainCat) return false;

    // 4. Subcategory Filter
    if (activeSubcategory !== 'All' && c.tutor_type !== activeSubcategory) return false;

    // 5. Search match
    return (
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description?.toLowerCase().includes(filter.toLowerCase())
    );
  });

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
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-gray-100 dark:border-gray-800/50 pb-8">
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">Courses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">Master each topic and boost your SAT/PSAT scores!</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Subject Switch */}
          <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full flex relative shadow-inner border border-gray-200 dark:border-gray-700">
            {['SAT', 'ACT', 'AP'].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setActiveSubcategory('All');
                }}
                className={`relative px-6 py-2.5 rounded-full text-sm font-bold transition-all z-10 ${
                  activeCategory === category 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {category}
                {activeCategory === category && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-[#E53935] rounded-full -z-10 shadow-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>
            {/* Search Box */}
            <div className="relative w-full sm:w-64 group">
              <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#E53935] transition-colors w-4 h-4" />
              <input
                type="text"
                placeholder="Search courses..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#E53935]/20 focus:border-[#E53935] outline-none text-sm transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

      {/* Subcategory Pills */}
      <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <button
          onClick={() => setActiveSubcategory('All')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeSubcategory === 'All' ? 'bg-[#E53935] border-[#E53935] text-white shadow-md shadow-red-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#E53935] hover:text-[#E53935]'}`}
        >
          All {activeCategory}
        </button>
        {COURSE_CATEGORIES[activeCategory].map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubcategory(sub)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeSubcategory === sub ? 'bg-[#E53935] border-[#E53935] text-white shadow-md shadow-red-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#E53935] hover:text-[#E53935]'}`}
          >
            {sub}
          </button>
        ))}
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
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${isEnrolled ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 group-hover:bg-[#E53935] group-hover:text-white'}`}>
          <SafeIcon icon={FiBook} className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md mb-1.5 inline-block ${
            (course.tutor_type || '').toLowerCase().includes('math') || (course.tutor_type || '').toLowerCase().includes('quant')
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
              : (course.tutor_type || '').toLowerCase().includes('reading') || (course.tutor_type || '').toLowerCase().includes('writing') || (course.tutor_type || '').toLowerCase().includes('english')
              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
              : 'bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-400'
          }`}>
            {course.tutor_type || 'General'}
          </span>
          <h3 className="font-extrabold text-lg text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-[#E53935] transition-colors">{course.name}</h3>
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