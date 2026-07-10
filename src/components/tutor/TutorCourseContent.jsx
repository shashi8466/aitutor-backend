import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, tutorService, enrollmentService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import supabase from '../../supabase/supabase';

const {
  FiBook, FiPlay, FiLoader, FiSearch, FiCheckCircle, FiActivity,
  FiFilter, FiRefreshCw
} = FiIcons;

// ─── Taxonomy (mirrors StudentCourseList) ────────────────────────────────────
const COURSE_CATEGORIES = {
  'SAT': ['SAT Math', 'SAT Reading & Writing', 'FULL LENGTH TEST'],
  'ACT': ['ACT Math', 'ACT English', 'ACT Science', 'ACT Reading', 'ACT Full-Length Test'],
  'AP': [
    'AP Biology', 'AP Calculus AB', 'AP Calculus BC', 'AP Chemistry',
    'AP English Language and Composition', 'AP Environmental Science',
    'AP Physics 1: Algebra-Based', 'AP Physics C: Mechanics',
    'AP Psychology', 'AP United States Government and Politics',
    'AP United States History'
  ]
};

const COURSE_TAXONOMY = {
  'SAT Math': {
    'Algebra': [
      'Linear equations in one variable', 'Linear functions',
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
      'Ratios, rates, proportional relationships, and units', 'Percentages',
      'One-variable data: Distributions and measures of center and spread',
      'Two-variable data: Models and scatterplots',
      'Probability and conditional probability',
      'Inference from sample statistics and margin of error',
      'Evaluating statistical claims: Observational studies and experiments'
    ],
    'Geometry and Trigonometry': [
      'Area and volume', 'Lines, angles, and triangles',
      'Right triangles and trigonometry', 'Circles'
    ]
  },
  'SAT Reading & Writing': {
    'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
    'Information and Ideas': ['Central Ideas and Details', 'Command of Evidence', 'Inferences'],
    'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
    'Expression of Ideas': ['Transitions', 'Rhetorical Synthesis']
  },
  'ACT Math': {
    'Unit 1 - Tips, Techniques, and Strategies': ['Pick Your Own Numbers', 'Solving Backwards'],
    'Unit 2 - Pre-Algebra': ['Integers', 'Digits', 'Even & Odd', 'Positives, Negatives, and Zero', 'Fractions', 'Divisibility, Factors & Multiples', 'Prime Numbers', 'Combinations', 'Permutations & Probabilities', 'Percents'],
    'Unit 3 - Elementary Algebra': ['Translation', 'Roots & Exponents', 'Solve for the Whole Expression', 'Ratios & Proportions', 'Rates', 'Mean, Median, and Mode'],
    'Unit 4 - Plane Geometry': ['Related Angles', 'Triangles', 'Circles', 'Polygons'],
    'Unit 5 - Intermediate Algebra': ['F.O.I.L. & Factor', 'Absolute Value', 'Inequalities', 'Matrices', 'Sequences'],
    'Unit 6 - Functions': ['Functions', 'Linear Equations', 'Function Tables', 'Funky Function Symbols', 'Real Life Functions', 'Quadratic Functions', 'Squiggly Functions'],
    'Unit 7 - Coordinate Geometry': ['Distances & Midpoints', 'Shapes on a Coordinate Plane', 'Circles & Ellipses'],
    'Unit 8 - Trigonometry & Logarithms': ['Trigonometry', 'Logarithms', 'Complex Numbers']
  },
  'ACT English': {
    'Unit 1 - Grammar & Punctuation': ['Parts of Speech', 'Adjectives vs. Adverbs', 'Possessive, Plural, and Contraction'],
    'Unit 2 - Sentence Structure': ['Sentences & Fragments', 'Run-On Sentences', 'Colons, Dashes, and Semicolons'],
    'Unit 3 - Usage & Mechanics (Part 1)': ['Subject Verb Agreement', 'Verb Tense', 'Pronoun Errors', 'Comparative vs. Superlative'],
    'Unit 4 - Rhetorical Skills (Part 1)': ['Redundancy & Wordiness', 'Transitions & Conclusions', 'Relevance: Adding & Removing Info'],
    'Unit 5 - Usage & Mechanics (Part 2)': ['Parallelism', 'Misplaced Modifier'],
    'Unit 6 - Rhetorical Skills (Part 2)': ['Move a Sentence or Paragraph', "Writer's Goal"]
  },
  'ACT Science': {
    'Unit 1: Data Representation': ['Data Representation'],
    'Unit 2: Research Summary': ['Research Summary'],
    'Unit 3: Conflicting Viewpoints': ['Conflicting Viewpoints']
  },
  'ACT Reading': [
    'Vocabulary-in-Context Questions', 'Inference Questions', 'Paraphrase Questions',
    'Point-of-View Questions', "Author's Intention Questions", 'Assumption Questions',
    'Main Idea Questions', 'Strengthen / Weaken the Argument Questions',
    'Analogous Situation Questions', 'Tone / Attitude Questions'
  ]
};

// ─── Helper ──────────────────────────────────────────────────────────────────
const getCourseTaxonomy = (course) => {
  if (course.is_adaptive) return { section: 'FULL LENGTH TEST', category: 'FULL LENGTH TEST' };
  if (course.category && course.category.trim() !== '') {
    return { section: course.tutor_type || 'Other', category: course.category };
  }
  const n = (course.name || '').toLowerCase().trim();
  for (const [section, categories] of Object.entries(COURSE_TAXONOMY)) {
    if (course.tutor_type && course.tutor_type !== section) continue;
    for (const [cat, subtopics] of Object.entries(categories)) {
      if (Array.isArray(subtopics)) {
        if (subtopics.some(s => n === s.toLowerCase() || n.includes(s.toLowerCase()))) {
          return { section, category: cat };
        }
      }
    }
  }
  const tl = (course.tutor_type || '').toLowerCase();
  if (tl.includes('math') || n.includes('math')) return { section: 'SAT Math', category: 'General' };
  if (tl.includes('reading') || tl.includes('writing') || n.includes('reading') || n.includes('writing'))
    return { section: 'SAT Reading & Writing', category: 'General' };
  return { section: course.tutor_type || 'Other', category: 'General' };
};

// ─── Course Card ─────────────────────────────────────────────────────────────
const CourseCard = ({ course, index, isEnrolled, onAction, onEnroll, isLoading, enrollLoading }) => {
  const isCardLoading = isLoading || enrollLoading === course.id;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all group flex flex-col h-full"
    >
      <div className="p-5 md:p-6 flex-1">
        <div className="flex items-center gap-3 md:gap-4 mb-4">
          <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm ${
            isEnrolled
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 group-hover:bg-blue-500 group-hover:text-white'
          }`}>
            <SafeIcon
              icon={course.is_adaptive ? FiActivity : FiBook}
              className="w-5 h-5 md:w-7 md:h-7"
            />
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
            <h3 className="font-extrabold text-sm md:text-lg text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
              {course.name}
            </h3>
          </div>
        </div>
        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {course.description || 'No description provided.'}
        </p>

        {isEnrolled && (
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 w-full rounded-full" />
            </div>
            <span className="text-xs font-bold text-green-600 dark:text-green-400">Enrolled</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={isEnrolled ? onAction : onEnroll}
          disabled={isCardLoading}
          className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2
            ${isEnrolled
              ? 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-600 text-gray-900 dark:text-white hover:border-blue-500 hover:text-blue-600'
              : 'bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20'
            } ${isCardLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isCardLoading ? (
            <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />
          ) : isEnrolled ? (
            <><SafeIcon icon={FiPlay} className="w-4 h-4" /> View Content</>
          ) : (
            <><SafeIcon icon={FiIcons.FiPlusCircle} className="w-4 h-4" /> Enroll Now</>
          )}
        </button>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const TutorCourseContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allCourses, setAllCourses] = useState([]);
  const [assignedCourseIds, setAssignedCourseIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState('SAT');
  const [activeSubcategory, setActiveSubcategory] = useState('All');

  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [enrollLoading, setEnrollLoading] = useState(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      const safeFetch = async (promise) => {
        try {
          const res = await promise;
          return res.data || [];
        } catch (err) {
          console.warn('TutorCourseContent: fetch failed:', err.message);
          return [];
        }
      };

      const [coursesData, dashboardData, enrollmentsData] = await Promise.all([
        safeFetch(courseService.getAll()),
        safeFetch(tutorService.getDashboard()),
        safeFetch(enrollmentService.getStudentEnrollments(user.id))
      ]);

      setAllCourses(coursesData);

      // Build set of assigned course IDs from tutor dashboard
      const tutorCourses = Array.isArray(dashboardData)
        ? dashboardData
        : (dashboardData?.courses || []);
      const ids = new Set(tutorCourses.map(c => String(c.id)));
      setAssignedCourseIds(ids);

      const eIds = new Set(enrollmentsData.map(e => String(e.course_id)));
      setEnrolledIds(eIds);

    } catch (err) {
      console.error('TutorCourseContent: global error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Filter logic (mirrors StudentCourseList) ───────────────────────────────
  const filteredCourses = allCourses.filter(c => {
    // Access Control: Tutors only see assigned courses
    if (!assignedCourseIds.has(String(c.id))) return false;

    // Only non-practice courses (unless adaptive or ACT full-length)
    const isACTFullLength = c.is_practice === true && (
      (c.tutor_type || '').toUpperCase().includes('ACT') ||
      (c.main_category || '').toUpperCase() === 'ACT' ||
      (c.category || '').toUpperCase().includes('ACT')
    );
    if (c.is_practice && !c.is_adaptive && !isACTFullLength) return false;

    // Active only
    if (c.status && c.status !== 'active') return false;

    // Main category
    let mainCat = c.main_category || (
      (c.is_adaptive || (c.tutor_type || '').toLowerCase().includes('sat')) ? 'SAT' :
      (c.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
      ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science', 'psychology', 'history', 'government', 'english', 'environmental'].some(kw =>
        (c.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
    );

    if (mainCat === 'FULL LENGTH TESTs') {
      const tt = (c.tutor_type || '').toUpperCase();
      mainCat = (c.is_adaptive || tt.includes('SAT')) ? 'SAT' : tt.includes('ACT') ? 'ACT' : 'SAT';
    } else if (c.is_adaptive) {
      mainCat = 'SAT';
    }

    if (activeCategory !== mainCat) return false;

    // Subcategory
    if (activeSubcategory !== 'All') {
      if (mainCat === 'SAT') {
        const tax = getCourseTaxonomy(c);
        if (tax.section !== activeSubcategory) return false;
      } else if (activeSubcategory === 'ACT Full-Length Test') {
        if (!(c.tutor_type || '').toUpperCase().includes('FULL') || !(c.tutor_type || '').toUpperCase().includes('ACT')) return false;
      } else if (c.tutor_type !== activeSubcategory) {
        return false;
      }
    }

    // Search
    return (
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(filter.toLowerCase())
    );
  });

  const handleEnroll = async (courseId) => {
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
      if (response.data?.free || response.data?.redirectTo) {
        navigate(`/tutor/course-content/course/${cId}`);
      } else if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      alert('Failed to initiate enrollment. Please try again later.');
    } finally {
      setEnrollLoading(null);
    }
  };

  // ── Render grid (same structure as StudentCourseList) ────────────────────
  const renderCourseGrid = (coursesList) => {
    if (activeCategory === 'SAT') {
      const groups = {};
      coursesList.forEach(c => {
        const tax = getCourseTaxonomy(c);
        const cat = tax.category;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c);
      });

      const sortedGroups = Object.keys(groups).sort((a, b) => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {groups[cat].map((course, idx) => (
              <CourseCard
                key={course.id}
                course={course}
                index={idx}
                isEnrolled={enrolledIds.has(String(course.id))}
                isLoading={false}
                enrollLoading={enrollLoading}
                onAction={() => navigate(`/tutor/course-content/course/${course.id}`)}
                onEnroll={() => handleEnroll(course.id)}
              />
            ))}
          </div>
        </div>
      ));
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {coursesList.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx}
            isEnrolled={enrolledIds.has(String(course.id))}
            isLoading={false}
            enrollLoading={enrollLoading}
            onAction={() => navigate(`/tutor/course-content/course/${course.id}`)}
            onEnroll={() => handleEnroll(course.id)}
          />
        ))}
      </div>
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <SafeIcon icon={FiLoader} className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-gray-100 dark:border-gray-800/50 pb-8 px-4 sm:px-0">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
            Course Content
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm sm:text-lg font-bold uppercase tracking-widest">
            Browse & preview all available course content
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Category Tabs */}
          <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full flex relative shadow-inner border border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar scrollbar-hide">
            {['SAT', 'ACT', 'AP'].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setActiveSubcategory('All');
                }}
                className={`relative px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all z-10 flex-shrink-0 ${
                  activeCategory === category ? 'text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {category}
                {activeCategory === category && (
                  <motion.div
                    layoutId="tutorActiveTab"
                    className="absolute inset-0 bg-blue-600 rounded-full -z-10 shadow-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64 group">
            <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="Search courses..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all shadow-sm"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={loadData}
            title="Refresh courses"
            className="p-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-600 transition-all shadow-sm"
          >
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subcategory Pills */}
      <div className="flex flex-nowrap sm:flex-wrap gap-2 overflow-x-auto no-scrollbar scrollbar-hide px-4 sm:px-0 animate-in fade-in slide-in-from-top-4 duration-500 pb-2">
        <button
          onClick={() => setActiveSubcategory('All')}
          className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all border flex-shrink-0 ${
            activeSubcategory === 'All'
              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600'
          }`}
        >
          All
        </button>
        {COURSE_CATEGORIES[activeCategory].map(sub => (
          <button
            key={sub}
            onClick={() => setActiveSubcategory(sub)}
            className={`px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all border flex-shrink-0 ${
              activeSubcategory === sub
                ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600'
            }`}
          >
            {sub}
          </button>
        ))}
      </div>

      <section className="px-4 sm:px-0">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <SafeIcon icon={FiBook} className="text-blue-600" />
          Assigned Courses
        </h2>
        {filteredCourses.length > 0 ? (
          renderCourseGrid(filteredCourses)
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">
              {filter ? 'No assigned courses match your search.' : 'You have no assigned courses at the moment.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default TutorCourseContent;
