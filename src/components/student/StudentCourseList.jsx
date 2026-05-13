import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, enrollmentService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../supabase/supabase';

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
  const [planAccess, setPlanAccess] = useState([]);
  const [topicCourseIds, setTopicCourseIds] = useState(new Set());

  const isPremium = (user?.plan_type || '').toLowerCase() === 'premium';

  const COURSE_CATEGORIES = {
    'SAT': ['SAT Math', 'SAT Reading & Writing', 'FULL LENGTH TEST'],
    'ACT': ['ACT Math', 'ACT English', 'ACT Science'],
    'AP': ['AP Physics', 'AP Chemistry', 'AP Biology', 'AP Pre-Calculus', 'Algebra 1', 'Algebra 2', 'Geometry']
  };

  const COURSE_TAXONOMY = {
    'SAT Math': {
      'Algebra': [
        'Linear equations in one variable',
        'Linear functions',
        'Linear equations in two variables',
        'Systems of two linear equations in two variables',
        'Linear inequalities in one or two variables'
      ],
      'Advanced Math': [
        'Nonlinear functions',
        'Nonlinear equations in one variable and systems of equations in two variables',
        'Equivalent expressions'
      ],
      'Problem-Solving and Data Analysis': [
        'Ratios, rates, proportional relationships, and units',
        'Percentages',
        'One-variable data: Distributions and measures of center and spread',
        'Two-variable data: Models and scatterplots',
        'Probability and conditional probability',
        'Inference from sample statistics and margin of error',
        'Evaluating statistical claims: Observational studies and experiments'
      ],
      'Geometry and Trigonometry': [
        'Area and volume',
        'Lines, angles, and triangles',
        'Right triangles and trigonometry',
        'Circles'
      ]
    },
    'SAT Reading & Writing': {
      'Craft and Structure': [
        'Words in Context',
        'Text Structure and Purpose',
        'Cross-Text Connections'
      ],
      'Information and Ideas': [
        'Central Ideas and Details',
        'Command of Evidence',
        'Inferences'
      ],
      'Standard English Conventions': [
        'Boundaries',
        'Form, Structure, and Sense'
      ],
      'Expression of Ideas': [
        'Transitions',
        'Rhetorical Synthesis'
      ]
    }
  };

  const getCourseTaxonomy = (course) => {
    if (course.is_adaptive) {
      return { 
        section: 'FULL LENGTH TEST', 
        category: 'FULL LENGTH TEST' 
      };
    }

    // If explicit category exists, use it
    if (course.category && course.category.trim() !== '') {
      return { 
        section: course.tutor_type || 'Other', 
        category: course.category 
      };
    }

    // Fallback: Guess category (Topic) based on name from COURSE_TAXONOMY
    const n = (course.name || '').toLowerCase().trim();
    for (const [section, categories] of Object.entries(COURSE_TAXONOMY)) {
      // Only match if the course's tutor_type matches the section (e.g. 'SAT Math')
      if (course.tutor_type && course.tutor_type !== section) continue;

      for (const [cat, subtopics] of Object.entries(categories)) {
        if (subtopics.some(s => n === s.toLowerCase() || n.includes(s.toLowerCase()))) {
          return { section, category: cat };
        }
      }
    }

    // Fallback based on keywords
    const tutorTypeLower = (course.tutor_type || '').toLowerCase();
    if (tutorTypeLower.includes('math') || n.includes('math')) return { section: 'SAT Math', category: 'General' };
    if (tutorTypeLower.includes('reading') || tutorTypeLower.includes('writing') || n.includes('reading') || n.includes('writing')) return { section: 'SAT Reading & Writing', category: 'General' };
    
    return { section: course.tutor_type || 'Other', category: 'General' };
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load courses with a safe fallback
      const safeFetch = async (promise) => {
        try {
          const res = await promise;
          return res.data || [];
        } catch (err) {
          console.warn("Partial service fetch failed:", err.message);
          return [];
        }
      };

      const [coursesData, enrollmentsData, accessData] = await Promise.all([
        safeFetch(courseService.getAll()),
        safeFetch(enrollmentService.getStudentEnrollments(user.id)),
        safeFetch(planService.getContentAccess())
      ]);

      setAllCourses(coursesData);
      setPlanAccess(accessData);
      const ids = new Set(enrollmentsData.map(e => e.course_id));
      setEnrolledIds(ids);

      // Indirect Access: Fetch course IDs that have assigned topics
      // Only for non-premium to determine restricted UI
      if (user?.plan_type !== 'premium') {
        const assignedTopics = accessData
          .filter(a => a.content_type === 'topic' && a.plan_type === 'free')
          .map(a => a.content_id);

        if (assignedTopics.length > 0) {
          try {
            const { data: topicMaps } = await supabase
              .from('questions')
              .select('course_id')
              .in('topic', assignedTopics);
            const tIds = new Set((topicMaps || []).map(m => m.course_id));
            setTopicCourseIds(tIds);
          } catch (e) { console.warn("Topic check failed"); }
        }
      }

    } catch (error) {
      console.error("Global load courses error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId) => {
    // Check if course is restricted for free users
    const isRestricted = !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(courseId) && a.plan_type === 'free');
    
    if (isRestricted) {
      navigate('/student/upgrade');
      return;
    }

    try {
      setEnrollLoading(courseId);
      const cId = parseInt(courseId, 10);

      const response = await enrollmentService.initiateEnrollment(user.id, cId);

      if (response.data?.requiresKey) {
        navigate('/student/enroll', { state: { courseId: cId, courseName: response.data.courseName || 'Course' } });
        return;
      }

      if (response.data?.error && (response.data.error.includes('key') || response.data.error.includes('Key'))) {
        navigate('/student/enroll', { state: { courseId: cId, courseName: response.data.courseName || 'Course' } });
        return;
      }

      if (response.data?.url) {
        console.log('🔗 Redirecting to Stripe Checkout:', response.data.url);
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
    const userPlan = (user?.plan_type || 'free').toLowerCase();
    const isUserPremium = userPlan === 'premium';
    
    // 0. Access Filter: 
    // - Premium students see all active courses by default.
    // - Non-premium students see only what is explicitly assigned to their plan.
    if (!isUserPremium) {
      const hasDirectAccess = planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(c.id) && a.plan_type === userPlan);
      const hasTopicAccess = topicCourseIds.has(c.id);
      if (!hasDirectAccess && !hasTopicAccess) return false;
    }

    // 1. Must NOT be an official practice course (unless it is adaptive)
    if (c.is_practice && !c.is_adaptive) return false;

    // 2. Must be active (if status column exists)
    if (c.status && c.status !== 'active') return false;

    // 3. Category Filter Match
    let mainCat = c.main_category || (
        (c.is_adaptive || (c.tutor_type || '').toLowerCase().includes('sat')) ? 'SAT' :
        (c.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
        ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science'].some(kw => (c.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
    );

    // Force FULL LENGTH TESTs to appear under SAT category
    if (c.is_adaptive || mainCat === 'FULL LENGTH TESTs') {
        mainCat = 'SAT';
    }
    
    if (activeCategory !== mainCat) return false;

    // 4. Subcategory Filter
    if (activeSubcategory !== 'All') {
      if (mainCat === 'SAT') {
        const tax = getCourseTaxonomy(c);
        if (tax.section !== activeSubcategory) return false;
      } else if (c.tutor_type !== activeSubcategory) {
        return false;
      }
    }

    // 5. Search match
    return (
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.description?.toLowerCase().includes(filter.toLowerCase())
    );
  });

  const enrolledCourses = filteredCourses.filter(c => enrolledIds.has(c.id));
  const availableCourses = filteredCourses.filter(c => !enrolledIds.has(c.id));

  const renderCourseGrid = (coursesList, isEnrolledFlag) => {
    if (activeCategory === 'SAT') {
      const groups = {};
      coursesList.forEach(c => {
        const tax = getCourseTaxonomy(c);
        const cat = tax.category;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c);
      });

      const sortedGroups = Object.keys(groups).sort((a,b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });

      return sortedGroups.map(cat => (
        <div key={cat} className="mb-4">
          {cat !== 'General' && (
             <div className="bg-[#1e293b] rounded-t-xl px-4 py-2 border-b border-gray-100/10 mb-4 shadow-sm relative overflow-hidden">
               <h3 className="relative z-10 text-[14px] font-bold text-white tracking-wide">{cat}</h3>
             </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {groups[cat].map((course, idx) => (
              <CourseCard
                key={course.id}
                course={course}
                index={idx}
                isEnrolled={isEnrolledFlag}
                isPremiumRestricted={!isEnrolledFlag && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
                isLoading={enrollLoading === course.id}
                onAction={() => {
                  if (isEnrolledFlag) {
                    if (course.is_adaptive) {
                      navigate(`/student/course/${course.id}`);
                    } else {
                      navigate(`/student/course/${course.id}`);
                    }
                  } else {
                    handleEnroll(course.id);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ));
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {coursesList.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx}
            isEnrolled={isEnrolledFlag}
            isPremiumRestricted={!isEnrolledFlag && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
            isLoading={enrollLoading === course.id}
            onAction={() => {
              if (isEnrolledFlag) {
                if (course.is_adaptive) {
                  navigate(`/student/course/${course.id}`);
                } else {
                  navigate(`/student/course/${course.id}`);
                }
              } else {
                handleEnroll(course.id);
              }
            }}
          />
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <SafeIcon icon={FiLoader} className="w-8 h-8 text-[#E53935] animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-gray-100 dark:border-gray-800/50 pb-8 px-4 sm:px-0">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Courses</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-lg font-bold uppercase tracking-widest">Master each topic and boost your scores!</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Subject Switch */}
          <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full flex relative shadow-inner border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar scrollbar-hide">
            {['SAT', 'ACT', 'AP'].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setActiveSubcategory('All');
                }}
                className={`relative px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all z-10 flex-shrink-0 ${
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
      <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto no-scrollbar scrollbar-hide px-4 sm:px-0 animate-in fade-in slide-in-from-top-4 duration-500 pb-2">
        <button
          onClick={() => setActiveSubcategory('All')}
          className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all border flex-shrink-0 ${activeSubcategory === 'All' ? 'bg-[#E53935] border-[#E53935] text-white shadow-md shadow-red-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#E53935] hover:text-[#E53935]'}`}
        >
          All
        </button>
        {COURSE_CATEGORIES[activeCategory].map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubcategory(sub)}
            className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all border flex-shrink-0 ${activeSubcategory === sub ? 'bg-[#E53935] border-[#E53935] text-white shadow-md shadow-red-500/20' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#E53935] hover:text-[#E53935]'}`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Enrolled Section */}
      {enrolledCourses.length > 0 && (
        <section className="px-4 sm:px-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <SafeIcon icon={FiCheckCircle} className="text-green-500" /> My Enrollments
          </h2>
          {renderCourseGrid(enrolledCourses, true)}
        </section>
      )}

      {/* Available Section */}
      <section className="px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <SafeIcon icon={FiBook} className="text-[#E53935]" /> Available Courses
        </h2>
        {availableCourses.length > 0 ? (
          renderCourseGrid(availableCourses, false)
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

const CourseCard = ({ course, index, isEnrolled, onAction, isLoading, isPremiumRestricted }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group flex flex-col h-full"
  >
    <div className="p-5 md:p-6 flex-1">
      <div className="flex items-center gap-3 md:gap-4 mb-4">
        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm ${isEnrolled ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : isPremiumRestricted ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 group-hover:bg-[#E53935] group-hover:text-white'}`}>
          <SafeIcon icon={isPremiumRestricted ? FiIcons.FiLock : (course.is_adaptive ? FiIcons.FiActivity : FiBook)} className="w-5 h-5 md:w-7 md:h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md mb-1 md:mb-1.5 inline-block ${
            (course.tutor_type || '').toLowerCase().includes('math') || (course.tutor_type || '').toLowerCase().includes('quant')
              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
              : (course.tutor_type || '').toLowerCase().includes('reading') || (course.tutor_type || '').toLowerCase().includes('writing') || (course.tutor_type || '').toLowerCase().includes('english')
              ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400'
              : 'bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-400'
          }`}>
            {course.tutor_type || 'General'}
          </span>
          <h3 className="font-extrabold text-sm md:text-lg text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-[#E53935] transition-colors flex items-center gap-1 md:gap-2">
            {course.name}
            {isPremiumRestricted && <FiIcons.FiZap className="w-3 h-3 md:w-4 md:h-4 text-amber-500 fill-amber-500 flex-shrink-0" />}
          </h3>
        </div>
      </div>
      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{course.description}</p>

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
        ) : isPremiumRestricted ? (
          <><SafeIcon icon={FiIcons.FiZap} className="w-4 h-4" /> Unlock Premium</>
        ) : (
          <><SafeIcon icon={FiPlusCircle} className="w-4 h-4" /> Enroll Now</>
        )}
      </button>
    </div>
  </motion.div>
);

export default StudentCourseList;