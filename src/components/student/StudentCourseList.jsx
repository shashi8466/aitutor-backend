import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, enrollmentService, planService, gradingService } from '../../services/api';
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
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [planAccess, setPlanAccess] = useState([]);
  const [topicCourseIds, setTopicCourseIds] = useState(new Set());
  const [studentSubmissionsMap, setStudentSubmissionsMap] = useState({});

  const isPremium = (user?.plan_type || '').toLowerCase() === 'premium';

  const COURSE_CATEGORIES = {
    'SAT': ['SAT Math', 'SAT Reading & Writing'],
    'ACT': ['ACT Math', 'ACT English', 'ACT Science', 'ACT Reading'],
    'AP': [
      'AP Biology',
      'AP Calculus AB',
      'AP Calculus BC',
      'AP Chemistry',
      'AP English Language and Composition',
      'AP Environmental Science',
      'AP Physics 1: Algebra-Based',
      'AP Physics C: Mechanics',
      'AP Psychology',
      'AP United States Government and Politics',
      'AP United States History'
    ],
    'FULL LENGTH TESTS': ['SAT', 'ACT', 'Linear SAT']
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
      'Unit 6 - Rhetorical Skills (Part 2)': ['Move a Sentence or Paragraph', 'Writer\'s Goal']
    },
    'ACT Science': {
      'Unit 1: Data Representation': ['Data Representation'],
      'Unit 2: Research Summary': ['Research Summary'],
      'Unit 3: Conflicting Viewpoints': ['Conflicting Viewpoints']
    },
    'ACT Reading': [
      'Vocabulary-in-Context Questions',
      'Inference Questions',
      'Paraphrase Questions',
      'Point-of-View Questions',
      "Author's Intention Questions",
      'Assumption Questions',
      'Main Idea Questions',
      'Strengthen / Weaken the Argument Questions',
      'Analogous Situation Questions',
      'Tone / Attitude Questions'
    ]
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
        if (Array.isArray(subtopics) && subtopics.some(s => n === s.toLowerCase() || n.includes(s.toLowerCase()))) {
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

      // Fetch student submissions for accurate attempt/completion tracking
      const subsMap = {};
      const addSubToMap = (s) => {
        if (!s) return;
        const keys = new Set();
        if (s.course_id) keys.add(String(s.course_id));
        if (s.course?.id) keys.add(String(s.course.id));
        if (s.courses?.id) keys.add(String(s.courses.id));

        const cName = (s.course?.name || s.courses?.name || s.course_name || s.test_name || s.topic || '').toLowerCase().trim();
        if (cName) keys.add(cName);

        try {
          const meta = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {});
          if (meta.topic) keys.add(String(meta.topic).toLowerCase().trim());
          if (meta.topicName) keys.add(String(meta.topicName).toLowerCase().trim());
          if (meta.courseName) keys.add(String(meta.courseName).toLowerCase().trim());
        } catch (e) { /* ignore */ }

        keys.forEach(k => {
          if (!subsMap[k]) subsMap[k] = [];
          if (!subsMap[k].some(existing => existing.id === s.id)) {
            subsMap[k].push(s);
          }
        });
      };

      try {
        const scoresRes = await gradingService.getAllMyScores(user.id);
        const apiSubs = scoresRes.data?.submissions || scoresRes.submissions || [];
        apiSubs.forEach(s => addSubToMap(s));
      } catch (e) {
        console.warn("API scores fetch warning:", e.message);
      }

      try {
        const { data: dbSubs } = await supabase
          .from('test_submissions')
          .select('id, user_id, course_id, level, raw_score, scaled_score, total_questions, raw_score_percentage, test_duration_seconds, is_completed, test_date, created_at, courses:courses(id, name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        (dbSubs || []).forEach(s => addSubToMap(s));
      } catch (subErr) {
        console.warn("Submissions fetch warning:", subErr);
      }

      setStudentSubmissionsMap(subsMap);

      // Indirect Access: Fetch course IDs that have assigned topics
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

      if (response.data?.free || response.data?.redirectTo) {
        console.log('🆓 Enrolled in free course, redirecting:', response.data.redirectTo);
        navigate(response.data.redirectTo || `/student/course/${cId}`);
      } else if (response.data?.url) {
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
    
    // 0. Access Filter:
    const hasDirectAccess = planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(c.id) && a.plan_type === userPlan);
    const hasTopicAccess = topicCourseIds.has(c.id);
    if (!hasDirectAccess && !hasTopicAccess) return false;

    // 1. Must NOT be an official practice course (unless it is adaptive OR an ACT full-length test)
    const isACTFullLength = c.is_practice === true && (
      (c.tutor_type || '').toUpperCase().includes('ACT') ||
      (c.main_category || '').toUpperCase() === 'ACT' ||
      (c.category || '').toUpperCase().includes('ACT')
    );
    if (c.is_practice && !c.is_adaptive && !isACTFullLength) return false;

    // 2. Must be active
    if (c.status && c.status !== 'active') return false;

    // 3. Category Filter Match
    let mainCat = c.main_category || (
        (c.is_adaptive || (c.tutor_type || '').toLowerCase().includes('sat')) ? 'SAT' :
        (c.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
        ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science', 'psychology', 'history', 'government', 'english', 'environmental'].some(kw => (c.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
    );

    if (mainCat === 'FULL LENGTH TESTs' || c.is_adaptive || (c.tutor_type || '').toUpperCase() === 'LINEAR SAT') {
      mainCat = 'FULL LENGTH TESTS';
    }
    
    if (activeCategory !== mainCat) return false;

    // 4. Subcategory Filter
    if (activeSubcategory !== 'All') {
      if (mainCat === 'SAT') {
        const tax = getCourseTaxonomy(c);
        if (tax.section !== activeSubcategory) return false;
      } else if (mainCat === 'FULL LENGTH TESTS') {
        const tutorType = (c.tutor_type || '').toUpperCase();
        if (activeSubcategory === 'SAT' && !c.is_adaptive && !tutorType.includes('FULL-LENGTH SAT')) return false;
        if (activeSubcategory === 'ACT' && !tutorType.includes('ACT')) return false;
        if (activeSubcategory === 'Linear SAT' && tutorType !== 'LINEAR SAT') return false;
      } else if (c.tutor_type !== activeSubcategory) {
        return false;
      }
    }

    // 5. Search match
    if (!filter || !filter.trim()) return true;
    const searchTerm = filter.trim().toLowerCase();
    const courseName = (c.name || '').toLowerCase();
    const courseDesc = (c.description || '').toLowerCase();
    const courseCat = (c.category || '').toLowerCase();
    const courseTutor = (c.tutor_type || '').toLowerCase();
    
    return (
      courseName.includes(searchTerm) ||
      courseDesc.includes(searchTerm) ||
      courseCat.includes(searchTerm) ||
      courseTutor.includes(searchTerm)
    );
  });

  const sortCourses = (coursesList) => {
    return [...coursesList].sort((a, b) => {
      if (sortBy === 'recent') {
        const dateA = new Date(a.created_at || a.updated_at || 0).getTime() || Number(a.id || 0);
        const dateB = new Date(b.created_at || b.updated_at || 0).getTime() || Number(b.id || 0);
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(a.created_at || a.updated_at || 0).getTime() || Number(a.id || 0);
        const dateB = new Date(b.created_at || b.updated_at || 0).getTime() || Number(b.id || 0);
        return dateA - dateB;
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'progress') {
        const progA = Number(a.progress || 0);
        const progB = Number(b.progress || 0);
        return progB - progA;
      }
      return 0;
    });
  };

  const enrolledCourses = filteredCourses.filter(c => enrolledIds.has(c.id));
  const availableCourses = filteredCourses.filter(c => !enrolledIds.has(c.id));

  const getSubmissionsForCourse = (course, subsMap = {}) => {
    if (!course) return [];
    const idKey = String(course.id);
    const nameKey = (course.name || '').toLowerCase().trim();
    
    const fromId = subsMap[idKey] || [];
    const fromName = subsMap[nameKey] || [];

    const combined = [...fromId, ...fromName];
    const uniqueMap = new Map();
    combined.forEach(s => {
      if (s && s.id && !uniqueMap.has(s.id)) {
        uniqueMap.set(s.id, s);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => new Date(b.created_at || b.test_date || 0) - new Date(a.created_at || a.test_date || 0));
  };

  const renderCourseGrid = (coursesList, isEnrolledFlag) => {
    const sortedList = sortCourses(coursesList);

    if (activeCategory === 'SAT') {
      const groups = {};
      sortedList.forEach(c => {
        const tax = getCourseTaxonomy(c);
        const cat = tax.category;
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c);
      });

      let categoryKeys = Object.keys(groups);
      if (expandedCategory) {
        categoryKeys = categoryKeys.filter(cat => cat === expandedCategory);
      }

      const sortedGroups = categoryKeys.sort((a,b) => {
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        return a.localeCompare(b);
      });

      return (
        <div>
          {expandedCategory && (
            <div className="flex items-center justify-between bg-[#11131A] p-3 px-4 rounded-xl border border-[#1C202B] mb-6">
              <span className="text-xs sm:text-sm font-semibold text-gray-300">
                Showing courses for: <strong className="text-purple-400">{expandedCategory}</strong>
              </span>
              <button 
                onClick={() => setExpandedCategory(null)}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
              >
                ← Back to All Categories
              </button>
            </div>
          )}
          {sortedGroups.map((cat, index) => {
            const catIcons = [FiIcons.FiStar, FiIcons.FiUser, FiIcons.FiSettings, FiIcons.FiTriangle, FiIcons.FiBox, FiIcons.FiActivity];
            const catColors = ['text-purple-500', 'text-red-500', 'text-teal-500', 'text-purple-400', 'text-blue-500', 'text-orange-500'];
            const Icon = catIcons[index % catIcons.length];
            const colorClass = catColors[index % catColors.length];

            return (
            <div key={cat} className="mb-8">
              {cat !== 'General' && (
                 <div className="flex justify-between items-center mb-6 mt-4 border-b border-[#1C202B] pb-2">
                   <h3 className="text-[15px] font-bold text-gray-300 flex items-center gap-2">
                     <SafeIcon icon={Icon} className={`w-4 h-4 ${colorClass}`} /> {cat}
                   </h3>
                   {expandedCategory === cat ? (
                     <button 
                       onClick={() => setExpandedCategory(null)}
                       className="text-purple-500 hover:text-purple-400 text-xs font-bold flex items-center gap-1 transition-colors"
                     >
                       Show All Categories
                     </button>
                   ) : (
                     <button 
                       onClick={() => setExpandedCategory(cat)}
                       className="text-purple-500 hover:text-purple-400 text-xs font-bold flex items-center gap-1 transition-colors"
                     >
                       View All <SafeIcon icon={FiIcons.FiArrowRight} className="w-3 h-3" />
                     </button>
                   )}
                 </div>
              )}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {groups[cat].map((course, idx) => {
                    const courseSubmissions = getSubmissionsForCourse(course, studentSubmissionsMap);
                    const courseIsEnrolled = isEnrolledFlag || enrolledIds.has(course.id) || courseSubmissions.length > 0;
                    return (
                      <CourseCard
                        key={course.id}
                        course={course}
                        index={idx}
                        isEnrolled={courseIsEnrolled}
                        submissions={courseSubmissions}
                        isPremiumRestricted={!courseIsEnrolled && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
                        isLoading={enrollLoading === course.id}
                        onAction={() => {
                          if (courseIsEnrolled) {
                            navigate(`/student/course/${course.id}`);
                          } else {
                            handleEnroll(course.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {groups[cat].map((course, idx) => {
                    const courseSubmissions = getSubmissionsForCourse(course, studentSubmissionsMap);
                    const courseIsEnrolled = isEnrolledFlag || enrolledIds.has(course.id) || courseSubmissions.length > 0;
                    return (
                      <CourseListRow
                        key={course.id}
                        course={course}
                        index={idx}
                        isEnrolled={courseIsEnrolled}
                        submissions={courseSubmissions}
                        isPremiumRestricted={!courseIsEnrolled && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
                        isLoading={enrollLoading === course.id}
                        onAction={() => {
                          if (courseIsEnrolled) {
                            navigate(`/student/course/${course.id}`);
                          } else {
                            handleEnroll(course.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>
      );
    }

    return viewMode === 'grid' ? (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {sortedList.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx}
            isEnrolled={isEnrolledFlag}
            submissions={getSubmissionsForCourse(course, studentSubmissionsMap)}
            isPremiumRestricted={!isEnrolledFlag && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
            isLoading={enrollLoading === course.id}
            onAction={() => {
              if (isEnrolledFlag) {
                const isLinearSAT = course.category === 'Linear SAT' || course.tutor_type === 'Linear SAT' || (course.name || '').toLowerCase().includes('linear sat');
                const isAdaptiveSAT = course.is_adaptive || (course.category || '').toLowerCase().includes('full-length sat') || (course.tutor_type || '').toLowerCase().includes('full-length sat');
                if (isLinearSAT || isAdaptiveSAT) {
                  navigate(`/student/adaptive-pre-test/${course.id}`);
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
    ) : (
      <div className="flex flex-col gap-3">
        {sortedList.map((course, idx) => (
          <CourseListRow
            key={course.id}
            course={course}
            index={idx}
            isEnrolled={isEnrolledFlag}
            submissions={getSubmissionsForCourse(course, studentSubmissionsMap)}
            isPremiumRestricted={!isEnrolledFlag && !isPremium && !planAccess.some(a => a.content_type === 'course' && String(a.content_id) === String(course.id) && a.plan_type === 'free') && !topicCourseIds.has(course.id)}
            isLoading={enrollLoading === course.id}
            onAction={() => {
              if (isEnrolledFlag) {
                const isLinearSAT = course.category === 'Linear SAT' || course.tutor_type === 'Linear SAT' || (course.name || '').toLowerCase().includes('linear sat');
                const isAdaptiveSAT = course.is_adaptive || (course.category || '').toLowerCase().includes('full-length sat') || (course.tutor_type || '').toLowerCase().includes('full-length sat');
                if (isLinearSAT || isAdaptiveSAT) {
                  navigate(`/student/adaptive-pre-test/${course.id}`);
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
    <div className="max-w-6xl mx-auto space-y-8 pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            Courses <FiIcons.FiAward className="text-purple-400 w-8 h-8" />
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Master each topic and boost your scores!</p>
        </div>

        {/* Search Box */}
        <div className="relative w-full sm:w-72 group">
          <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-purple-500 transition-colors" />
          <input
            type="text"
            placeholder="Search courses..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-9 py-2.5 bg-[#11131A] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-purple-500 transition-colors text-sm shadow-sm"
          />
          {filter && (
            <button 
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs p-1"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Top Category Buttons (Compact & Balanced) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        {[
           { id: 'SAT', title: 'SAT', subtitle: 'Digital SAT Prep', icon: FiIcons.FiBookOpen, bg: 'bg-[#181033]', border: 'border-[#7C3AED]', text: 'text-[#c4b5fd]' },
           { id: 'ACT', title: 'ACT', subtitle: 'ACT Prep', icon: FiIcons.FiActivity, bg: 'bg-[#064E3B]', border: 'border-green-500', text: 'text-green-300' },
           { id: 'AP', title: 'AP', subtitle: 'AP Courses', icon: FiIcons.FiGrid, bg: 'bg-[#332210]', border: 'border-orange-500', text: 'text-orange-300' },
           { id: 'FULL LENGTH TESTS', title: 'FULL LENGTH TESTS', subtitle: 'Real Exam Simulation', icon: FiIcons.FiClipboard, bg: 'bg-[#0F172A]', border: 'border-blue-500', text: 'text-blue-300' }
        ].map(cat => (
          <button
            key={cat.id}
            disabled={cat.id === 'ACT' && user?.email !== 'ssky57771@gmail.com' && user?.email !== 'admink338@gmail.com'}
            onClick={() => {
              setActiveCategory(cat.id);
              setActiveSubcategory('All');
              setExpandedCategory(null);
            }}
            className={`px-4 py-3 rounded-2xl border flex items-center gap-3.5 transition-all duration-200 ${
              activeCategory === cat.id 
                ? `${cat.bg} ${cat.border} shadow-[0_0_18px_rgba(124,58,237,0.25)] ring-1 ring-purple-500/30` 
                : 'bg-[#131622] border-[#252A3C] hover:border-purple-500/40 hover:bg-[#1A1F30]'
            } disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer group`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 transition-colors ${
              activeCategory === cat.id 
                ? `border-purple-400/30 bg-purple-500/10 ${cat.text}` 
                : 'border-[#2D3448] bg-[#1B2030] text-slate-400 group-hover:text-slate-200 group-hover:border-purple-500/40'
            }`}>
              <SafeIcon icon={cat.icon} className="w-4 h-4" />
            </div>
            <div className="text-left min-w-0">
              <h3 className={`font-bold text-xs sm:text-sm truncate tracking-tight ${activeCategory === cat.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{cat.title}</h3>
              <p className={`text-[10px] truncate ${activeCategory === cat.id ? 'text-purple-200/80' : 'text-slate-400'}`}>{cat.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Subcategory Pills & Sort/View Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start gap-5 mb-8 w-full">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
          <button
            onClick={() => {
              setActiveSubcategory('All');
              setExpandedCategory(null);
            }}
            className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center justify-center cursor-pointer whitespace-nowrap ${
              activeSubcategory === 'All' 
                ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]' 
                : 'bg-[#131726] border-[#262D42] text-slate-300 hover:border-purple-500/40 hover:bg-[#1A2035] hover:text-white'
            }`}
          >
            All
          </button>
          {COURSE_CATEGORIES[activeCategory]?.map(sub => (
            <button
              key={sub}
              onClick={() => {
                setActiveSubcategory(sub);
                setExpandedCategory(null);
              }}
              className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
                activeSubcategory === sub 
                  ? 'bg-[#181033] border-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.25)]' 
                  : 'bg-[#131726] border-[#262D42] text-slate-300 hover:border-purple-500/40 hover:bg-[#1A2035] hover:text-white'
              }`}
            >
              <SafeIcon icon={FiIcons.FiBookOpen} className={`w-3 h-3 flex-shrink-0 ${activeSubcategory === sub ? 'text-purple-300' : 'text-slate-400'}`} />
              <span className="truncate">{sub}</span>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 text-xs font-bold text-gray-400 shrink-0">
           <div className="flex items-center gap-1.5">
             <span className="text-gray-400 hidden sm:inline">Sort by:</span>
             <select
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value)}
               className="bg-[#11131A] border border-[#1C202B] text-white text-xs font-bold px-3 h-9 rounded-lg focus:outline-none focus:border-purple-500 cursor-pointer hover:border-gray-700 transition-colors"
             >
               <option value="recent">Recent</option>
               <option value="name">Name (A-Z)</option>
               <option value="progress">Progress</option>
               <option value="oldest">Oldest</option>
             </select>
           </div>
           
           <div className="flex gap-1.5 bg-[#11131A] p-1 rounded-lg border border-[#1C202B] h-9 items-center">
              <button 
                title="Grid View"
                onClick={() => setViewMode('grid')}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                  viewMode === 'grid' 
                    ? 'bg-[#181033] border border-[#7C3AED] text-[#c4b5fd]' 
                    : 'bg-transparent text-gray-400 hover:text-white'
                }`}
              >
                 <SafeIcon icon={FiIcons.FiGrid} className="w-3.5 h-3.5" />
              </button>
              <button 
                title="List View"
                onClick={() => setViewMode('list')}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                  viewMode === 'list' 
                    ? 'bg-[#181033] border border-[#7C3AED] text-[#c4b5fd]' 
                    : 'bg-transparent text-gray-400 hover:text-white'
                }`}
              >
                 <SafeIcon icon={FiIcons.FiList} className="w-3.5 h-3.5" />
              </button>
           </div>
        </div>
      </div>

      {/* Enrolled Section */}
      {enrolledCourses.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-[#1C202B] pb-3">
            <SafeIcon icon={FiCheckCircle} className="text-green-500" /> My Enrollments
          </h2>
          {renderCourseGrid(enrolledCourses, true)}
        </section>
      )}

      {/* Available Section */}
      <section>
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-[#1C202B] pb-3">
          <SafeIcon icon={FiIcons.FiBookOpen} className="text-purple-400" /> Available Courses
        </h2>
        {availableCourses.length > 0 ? (
          renderCourseGrid(availableCourses, false)
        ) : filter ? (
          <div className="text-center py-12 bg-[#11131A] rounded-2xl border border-dashed border-[#1C202B]">
            <p className="text-gray-500">No courses match your search.</p>
          </div>
        ) : enrolledCourses.length > 0 ? (
          <div className="text-center py-12 bg-[#11131A] rounded-2xl border border-dashed border-[#1C202B]">
            <p className="text-gray-500">You're enrolled in all available courses for this category.</p>
          </div>
        ) : (
          <div className="text-center py-12 bg-[#11131A] rounded-2xl border border-dashed border-[#1C202B]">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-[#7C3AED]/15 text-[#c4b5fd] border border-[#7C3AED]/40 shadow-[0_0_15px_rgba(124,58,237,0.2)]">
              Coming Soon
            </span>
          </div>
        )}
      </section>
    </div>
  );
};

const getCourseStatusInfo = (course, submissions = []) => {
  const latestSub = submissions.length > 0 ? submissions[0] : null;

  const isTest = Boolean(
    course.is_adaptive ||
    (course.category || '').toLowerCase().includes('full-length') ||
    (course.tutor_type || '').toLowerCase().includes('full-length') ||
    (course.tutor_type || '').toLowerCase().includes('linear sat') ||
    (course.name || '').toLowerCase().includes('full length') ||
    (course.name || '').toLowerCase().includes('linear sat')
  );

  let isCompleted = false;
  let isInProgress = false;
  let isNotAttempted = false;
  let progressPct = 0;

  if (isTest) {
    // Full Length SAT / Adaptive Test status logic
    isCompleted = Boolean(
      (latestSub && (
        latestSub.status === 'completed' ||
        latestSub.is_completed === true ||
        (latestSub.raw_score_percentage !== undefined && latestSub.raw_score_percentage !== null) ||
        (latestSub.scaled_score !== undefined && latestSub.scaled_score > 0)
      )) ||
      course.user_progress === 100 ||
      course.progress === 100
    );
    const hasAttempt = Boolean(latestSub || Number(course.user_progress) > 0 || Number(course.progress) > 0);
    isInProgress = !isCompleted && hasAttempt;
    isNotAttempted = !isCompleted && !isInProgress;
    progressPct = isCompleted ? 100 : isInProgress ? 50 : 0;
  } else {
    // SAT Regular Course Topic (Easy, Medium, Hard) status logic
    const completedLevels = new Set(
      submissions
        .filter(s => s && (s.is_completed !== false || s.raw_score !== undefined || s.scaled_score !== undefined || s.total_questions > 0))
        .map(s => (s.level || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const hasEasy = completedLevels.has('easy');
    const hasMedium = completedLevels.has('medium');
    const hasHard = completedLevels.has('hard');
    const distinctLevelsCount = [hasEasy, hasMedium, hasHard].filter(Boolean).length;

    if (
      distinctLevelsCount >= 3 || 
      (hasEasy && hasMedium && hasHard) || 
      submissions.length >= 3 || 
      course.user_progress === 100 || 
      course.progress === 100 ||
      submissions.some(s => s.level === 'combined' || s.is_completed === true)
    ) {
      isCompleted = true;
      progressPct = 100;
    } else if (distinctLevelsCount > 0 || submissions.length > 0 || Number(course.user_progress) > 0 || Number(course.progress) > 0) {
      isInProgress = true;
      if (distinctLevelsCount === 2 || submissions.length === 2) {
        progressPct = 67;
      } else {
        progressPct = 33;
      }
    } else {
      isNotAttempted = true;
      progressPct = 0;
    }
  }

  let primaryBtnText = isTest ? 'Start Test' : 'Start Course';
  if (isInProgress) {
    primaryBtnText = isTest ? 'Continue Test' : 'Continue Course';
  } else if (isCompleted) {
    primaryBtnText = 'View Results';
  }

  return {
    isTest,
    isCompleted,
    isInProgress,
    isNotAttempted,
    progressPct,
    latestSub,
    primaryBtnText
  };
};

const CourseCard = ({ course, index, isEnrolled, onAction, isLoading, isPremiumRestricted, submissions = [] }) => {
  const navigate = useNavigate();
  const statusInfo = getCourseStatusInfo(course, submissions);
  const { isTest, isCompleted, isInProgress, isNotAttempted, progressPct, latestSub, primaryBtnText } = statusInfo;

  const isMath = (course.tutor_type || '').toLowerCase().includes('math') || (course.tutor_type || '').toLowerCase().includes('quant');
  const isReading = (course.tutor_type || '').toLowerCase().includes('reading') || (course.tutor_type || '').toLowerCase().includes('writing') || (course.tutor_type || '').toLowerCase().includes('english');
  
  const tagTheme = isMath 
      ? { bg: 'bg-blue-500/20', text: 'text-blue-400', iconBg: 'bg-[#181033]', iconText: 'text-purple-400' } 
      : isReading 
      ? { bg: 'bg-orange-500/20', text: 'text-orange-400', iconBg: 'bg-[#332210]', iconText: 'text-orange-400' }
      : { bg: 'bg-indigo-500/20', text: 'text-indigo-400', iconBg: 'bg-[#181033]', iconText: 'text-indigo-400' };

  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="bg-[#131726] rounded-2xl shadow-sm border border-[#262D42] overflow-hidden hover:border-purple-500/30 transition-all group flex flex-col h-full"
  >
    <div className="p-5 md:p-6 flex-1">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${tagTheme.iconBg} ${tagTheme.iconText}`}>
              <SafeIcon icon={isPremiumRestricted ? FiIcons.FiLock : (course.is_adaptive ? FiIcons.FiActivity : FiIcons.FiBook)} className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center w-fit mb-1.5 ${tagTheme.bg} ${tagTheme.text}`}>
                {course.tutor_type || 'General'}
              </span>
              <h3 className="font-bold text-sm md:text-[15px] text-white leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors flex items-start gap-1">
                {course.name}
                {isPremiumRestricted && <FiIcons.FiZap className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0 mt-0.5" />}
              </h3>
            </div>
        </div>
        <button className="text-gray-500 hover:text-white transition-colors">
            <FiIcons.FiMoreVertical className="w-4 h-4" />
        </button>
      </div>

      {isEnrolled && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-gray-300">{progressPct}% Completed</span>
            {isCompleted ? (
              <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 text-[9px]">
                <SafeIcon icon={FiIcons.FiCheckCircle} className="w-2.5 h-2.5 text-blue-400" /> Completed
              </span>
            ) : isInProgress ? (
              <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 text-[9px]">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></div> In Progress
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2 py-0.5 rounded-full border border-gray-800 text-[9px]">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div> Not Attempted
              </span>
            )}
          </div>
          <div className="h-1.5 bg-[#1C202B] rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                isCompleted ? 'bg-gradient-to-r from-blue-500 to-purple-500' : isInProgress ? 'bg-blue-500' : 'bg-gray-600'
              }`} 
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>

    <div className="p-4 border-t border-[#1C202B]">
      {!isEnrolled ? (
        <button
          onClick={onAction}
          disabled={isLoading}
          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border ${
            isPremiumRestricted
              ? 'bg-transparent border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
              : 'bg-transparent border-purple-500/50 text-purple-400 hover:bg-purple-500/10'
          } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <SafeIcon icon={FiIcons.FiLoader} className="w-4 h-4 animate-spin" />
          ) : isPremiumRestricted ? (
            <><SafeIcon icon={FiIcons.FiZap} className="w-3 h-3" /> Unlock Premium</>
          ) : (
            <><SafeIcon icon={FiIcons.FiPlusCircle} className="w-3 h-3" /> Enroll Now</>
          )}
        </button>
      ) : isCompleted ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isTest) {
                if (latestSub?.id) {
                  navigate(`/student/report/${latestSub.id}`);
                } else {
                  onAction();
                }
              } else {
                navigate(`/student/topic-report/${course.id}`);
              }
            }}
            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.3)] cursor-pointer"
          >
            <SafeIcon icon={FiIcons.FiFileText} className="w-3.5 h-3.5" /> View Results
          </button>
          <button
            onClick={() => {
              const isLinearSAT = course.category === 'Linear SAT' || course.tutor_type === 'Linear SAT' || (course.name || '').toLowerCase().includes('linear sat');
              const isAdaptiveSAT = course.is_adaptive || (course.category || '').toLowerCase().includes('full-length sat') || (course.tutor_type || '').toLowerCase().includes('full-length sat');
              if (isLinearSAT || isAdaptiveSAT) {
                navigate(`/student/adaptive-pre-test/${course.id}?retake=true`);
              } else {
                navigate(`/student/course/${course.id}?retake=true`);
              }
            }}
            className="px-3 py-2.5 rounded-xl font-bold text-xs bg-transparent border border-purple-500/30 hover:border-purple-500/60 text-purple-300 hover:text-white hover:bg-purple-500/10 transition-all flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer"
            title="Start a new test attempt while keeping prior history"
          >
            <SafeIcon icon={FiIcons.FiRefreshCw} className="w-3 h-3" /> Start Again
          </button>
        </div>
      ) : (
        <button
          onClick={onAction}
          disabled={isLoading}
          className="w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 bg-transparent border border-[#1C202B] text-gray-200 hover:border-gray-600 hover:text-white cursor-pointer"
        >
          {isLoading ? (
            <SafeIcon icon={FiIcons.FiLoader} className="w-4 h-4 animate-spin" />
          ) : (
            <><SafeIcon icon={FiIcons.FiPlay} className="w-3 h-3" /> {primaryBtnText}</>
          )}
        </button>
      )}
    </div>
  </motion.div>
  );
};

const CourseListRow = ({ course, index, isEnrolled, onAction, isLoading, isPremiumRestricted, submissions = [] }) => {
  const navigate = useNavigate();
  const statusInfo = getCourseStatusInfo(course, submissions);
  const { isTest, isCompleted, isInProgress, isNotAttempted, progressPct, latestSub, primaryBtnText } = statusInfo;

  const isMath = (course.tutor_type || '').toLowerCase().includes('math') || (course.tutor_type || '').toLowerCase().includes('quant');
  const isReading = (course.tutor_type || '').toLowerCase().includes('reading') || (course.tutor_type || '').toLowerCase().includes('writing') || (course.tutor_type || '').toLowerCase().includes('english');
  
  const tagTheme = isMath 
      ? { bg: 'bg-blue-500/20', text: 'text-blue-400', iconBg: 'bg-[#181033]', iconText: 'text-purple-400' } 
      : isReading 
      ? { bg: 'bg-orange-500/20', text: 'text-orange-400', iconBg: 'bg-[#332210]', iconText: 'text-orange-400' }
      : { bg: 'bg-indigo-500/20', text: 'text-indigo-400', iconBg: 'bg-[#181033]', iconText: 'text-indigo-400' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-[#131726] rounded-2xl p-4 border border-[#262D42] hover:border-purple-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
    >
      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${tagTheme.iconBg} ${tagTheme.iconText}`}>
          <SafeIcon icon={isPremiumRestricted ? FiIcons.FiLock : (course.is_adaptive ? FiIcons.FiActivity : FiIcons.FiBook)} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${tagTheme.bg} ${tagTheme.text}`}>
              {course.tutor_type || 'General'}
            </span>
            {course.category && (
              <span className="text-[10px] text-gray-400 font-medium truncate">
                • {course.category}
              </span>
            )}
          </div>
          <h3 className="font-bold text-sm md:text-base text-white leading-tight truncate group-hover:text-blue-400 transition-colors flex items-start sm:items-center gap-1.5">
            {course.name}
            {isPremiumRestricted && <FiIcons.FiZap className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />}
          </h3>
          {course.description && (
            <p className="text-gray-400 text-xs mt-1 line-clamp-1">{course.description}</p>
          )}
          {isEnrolled && (
            <div className="mt-2 flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-1 bg-[#1C202B] rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-gradient-to-r from-blue-500 to-purple-500' : isInProgress ? 'bg-blue-500' : 'bg-gray-600'
                  }`} 
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
              <span className={`text-[10px] font-bold whitespace-nowrap ${isCompleted ? 'text-blue-400' : 'text-gray-400'}`}>
                {isCompleted ? 'Completed · 100%' : isInProgress ? `In Progress · ${progressPct}%` : 'Not Attempted · 0%'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:self-center flex-shrink-0 w-full sm:w-auto border-t sm:border-t-0 border-[#1C202B] pt-3 sm:pt-0">
        {!isEnrolled ? (
          <button
            onClick={onAction}
            disabled={isLoading}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border whitespace-nowrap ${
              isPremiumRestricted
                ? 'bg-transparent border-amber-500/50 text-amber-400 hover:bg-amber-500/10'
                : 'bg-transparent border-purple-500/50 text-purple-400 hover:bg-purple-500/10'
            } ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <SafeIcon icon={FiIcons.FiLoader} className="w-4 h-4 animate-spin" />
            ) : isPremiumRestricted ? (
              <><SafeIcon icon={FiIcons.FiZap} className="w-3 h-3" /> Unlock Premium</>
            ) : (
              <><SafeIcon icon={FiIcons.FiPlusCircle} className="w-3 h-3" /> Enroll Now</>
            )}
          </button>
        ) : isCompleted ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (isTest) {
                  if (latestSub?.id) {
                    navigate(`/student/report/${latestSub.id}`);
                  } else {
                    onAction();
                  }
                } else {
                  navigate(`/student/topic-report/${course.id}`);
                }
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.3)] whitespace-nowrap cursor-pointer"
            >
              <SafeIcon icon={FiIcons.FiFileText} className="w-3.5 h-3.5" /> View Results
            </button>
            <button
              onClick={() => {
                const isLinearSAT = course.category === 'Linear SAT' || course.tutor_type === 'Linear SAT' || (course.name || '').toLowerCase().includes('linear sat');
                const isAdaptiveSAT = course.is_adaptive || (course.category || '').toLowerCase().includes('full-length sat') || (course.tutor_type || '').toLowerCase().includes('full-length sat');
                if (isLinearSAT || isAdaptiveSAT) {
                  navigate(`/student/adaptive-pre-test/${course.id}?retake=true`);
                } else {
                  navigate(`/student/course/${course.id}?retake=true`);
                }
              }}
              className="px-3 py-2.5 rounded-xl font-bold text-xs bg-transparent border border-purple-500/30 hover:border-purple-500/60 text-purple-300 hover:text-white hover:bg-purple-500/10 transition-all flex items-center justify-center gap-1 whitespace-nowrap"
              title="Start a new test attempt while keeping prior history"
            >
              <SafeIcon icon={FiIcons.FiRefreshCw} className="w-3 h-3" /> Start Again
            </button>
          </div>
        ) : (
          <button
            onClick={onAction}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-[#1C202B] text-gray-200 hover:border-gray-600 hover:text-white whitespace-nowrap"
          >
            {isLoading ? (
              <SafeIcon icon={FiIcons.FiLoader} className="w-4 h-4 animate-spin" />
            ) : (
              <><SafeIcon icon={FiIcons.FiPlay} className="w-3 h-3" /> {primaryBtnText}</>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default StudentCourseList;