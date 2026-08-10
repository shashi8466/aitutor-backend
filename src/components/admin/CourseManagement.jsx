import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService } from '../../services/api';
import CourseForm from './CourseForm';
import AdaptiveCourseForm from './AdaptiveCourseForm';
import CourseCard from './CourseCard';

const { FiPlus, FiBook, FiFilter, FiSearch, FiRefreshCw } = FiIcons;

const CourseManagement = ({ onStatsUpdate }) => {
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAdaptiveForm, setShowAdaptiveForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [activeCategory, setActiveCategory] = useState('SAT');
  const [activeSubcategory, setActiveSubcategory] = useState('All');
  const [allCoursesRaw, setAllCoursesRaw] = useState([]);

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
    'FULL LENGTH TESTs': ['Full-Length SAT', 'Full-Length ACT', 'Linear SAT']
  };

  useEffect(() => {
    loadCourses();
  }, [filters, activeCategory, activeSubcategory]);

  const getMainCategory = (c) => {
    let mainCat = c.main_category;
    if (mainCat && mainCat.toUpperCase() === 'FULL LENGTH TESTS') return 'FULL LENGTH TESTs';
    if (mainCat) return mainCat;

    if (c.is_adaptive || (COURSE_CATEGORIES['FULL LENGTH TESTs'] && COURSE_CATEGORIES['FULL LENGTH TESTs'].includes(c.tutor_type))) {
      return 'FULL LENGTH TESTs';
    }
    const type = (c.tutor_type || '').toLowerCase();
    if (type.includes('sat')) return 'SAT';
    if (type.includes('act')) return 'ACT';
    return 'AP';
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const response = await courseService.getAll();
      const rawData = response?.data || [];
      setAllCoursesRaw(rawData);
      let filteredCourses = [...rawData];

      if (filters.status) {
        filteredCourses = filteredCourses.filter(c => c.status === filters.status);
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        filteredCourses = filteredCourses.filter(c =>
          c.name.toLowerCase().includes(term) ||
          (c.description && c.description.toLowerCase().includes(term))
        );
      }

      // Hierarchy Filter
      filteredCourses = filteredCourses.filter(c => {
        const mainCat = getMainCategory(c);
        if (mainCat !== activeCategory) return false;
        if (activeSubcategory !== 'All') {
          return c.tutor_type === activeSubcategory;
        }
        return true;
      });

      setCourses(filteredCourses);
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]); // Set to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    // Removed window.confirm to avoid sandbox errors
    await courseService.delete(courseId);
    loadCourses();
  };

  return (
    <div className="space-y-6 bg-[#0f1115] min-h-screen p-6 rounded-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-white">Course Management</h2>
          <p className="text-sm text-gray-400">Manage courses, questions, content, and settings</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="bg-[#1e3a8a] text-blue-400 border border-[#1e40af] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-900 transition-colors shadow-sm text-sm font-semibold"
          >
            <SafeIcon icon={FiPlus} className="w-4 h-4" />
            <span>Regular Course</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAdaptiveForm(true)}
            className="bg-[#4c1d95] text-purple-300 border border-[#5b21b6] px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-purple-900 transition-colors shadow-sm text-sm font-semibold"
          >
            <SafeIcon icon={FiPlus} className="w-4 h-4" />
            <span>Full Length Test</span>
          </motion.button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeCategory === 'FULL LENGTH TESTs' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 animate-in fade-in duration-700`}>
          {/* Dynamic Subject Cards based on Category */}
          {activeCategory === 'SAT' ? (
            <>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-blue-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBriefcase} className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">SAT MATH</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'SAT' && (c.tutor_type || '').toLowerCase().includes('math')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-green-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBookOpen} className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">SAT E&W</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'SAT' && (c.tutor_type || '').toLowerCase().includes('reading')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
            </>
          ) : activeCategory === 'ACT' ? (
            <>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-emerald-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBriefcase} className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">ACT MATH</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'ACT' && (c.tutor_type || '').toLowerCase().includes('math')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-amber-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBookOpen} className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">ACT ENGLISH/SCIENCE</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'ACT' && !(c.tutor_type || '').toLowerCase().includes('math')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
            </>
          ) : activeCategory === 'AP' ? (
            <>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-purple-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBriefcase} className="w-6 h-6 text-purple-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">AP SCIENCES</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'AP' && ['physics', 'chemistry', 'biology', 'science', 'environmental'].some(s => (c.tutor_type || '').toLowerCase().includes(s))).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-indigo-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBookOpen} className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">AP MATH/HUMANITIES</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'AP' && !['physics', 'chemistry', 'biology', 'science', 'environmental'].some(s => (c.tutor_type || '').toLowerCase().includes(s))).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-blue-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBriefcase} className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">FULL-LENGTH SAT</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'FULL LENGTH TESTs' && (c.tutor_type || '').toLowerCase().includes('sat') && !(c.tutor_type || '').toLowerCase().includes('linear')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-emerald-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiBookOpen} className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">FULL-LENGTH ACT</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'FULL LENGTH TESTs' && (c.tutor_type || '').toLowerCase().includes('act')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
              <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
                  <div className="bg-orange-900/30 p-3 rounded-2xl">
                     <SafeIcon icon={FiIcons.FiActivity} className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">LINEAR SAT</span>
                     <span className="text-2xl font-black text-white">
                       {allCoursesRaw.filter(c => getMainCategory(c) === 'FULL LENGTH TESTs' && (c.tutor_type || '').toLowerCase().includes('linear')).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                     </span>
                  </div>
              </div>
            </>
          )}

          <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
              <div className="bg-yellow-900/30 p-3 rounded-2xl">
                 <SafeIcon icon={FiIcons.FiFileText} className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">{activeCategory} TOTAL</span>
                 <span className="text-2xl font-black text-white">
                   {allCoursesRaw.filter(c => getMainCategory(c) === activeCategory).reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                 </span>
              </div>
          </div>

          <div className="bg-[#1b2028] p-4 rounded-2xl border border-gray-800 flex items-center gap-4 shadow-sm">
              <div className="bg-purple-900/30 p-3 rounded-2xl">
                 <SafeIcon icon={FiIcons.FiAward} className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">GRAND TOTAL</span>
                 <span className="text-2xl font-black text-white">
                   {allCoursesRaw.reduce((sum, c) => sum + (c.questions_count || 0), 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">Questions</span>
                 </span>
              </div>
          </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-col space-y-4">
        <div className="flex space-x-6 border-b border-gray-800">
          {Object.keys(COURSE_CATEGORIES).map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setActiveSubcategory('All');
              }}
              className={`pb-2 text-sm font-semibold transition-all relative ${
                activeCategory === cat 
                  ? 'text-blue-500 border-b-2 border-blue-500' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subcategory Tabs */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-scrollbar scrollbar-hide">
          <button
            onClick={() => setActiveSubcategory('All')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              activeSubcategory === 'All' 
                ? 'bg-[#1e293b] border-[#334155] text-blue-400' 
                : 'bg-transparent border-[#1e293b] text-gray-400 hover:border-gray-500'
            }`}
          >
            All Subcourses
          </button>
          {COURSE_CATEGORIES[activeCategory].map(sub => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                activeSubcategory === sub 
                  ? 'bg-[#1e293b] border-[#334155] text-blue-400' 
                  : 'bg-transparent border-[#1e293b] text-gray-400 hover:border-gray-500'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1b2028] rounded-xl border border-gray-800 p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <SafeIcon icon={FiFilter} className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-white">Filters</h3>
          </div>
          <button onClick={loadCourses} className="text-gray-400 hover:text-white text-xs flex items-center bg-[#1f2937] px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
            <SafeIcon icon={FiRefreshCw} className="w-3 h-3 mr-2" />
            Refresh
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-none sm:w-1/4">
            <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full pl-3 pr-8 py-2 bg-[#0f1115] border border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-white text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="flex-1 relative mt-auto">
            <input
              type="text"
              placeholder="Search courses..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-4 pr-10 py-2 bg-[#0f1115] border border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-white text-sm"
            />
            <SafeIcon icon={FiSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          </div>
        </div>
      </motion.div>

      {/* Courses Grid */}
      {(loading && (!courses || courses.length === 0)) ? (
        <div className="text-center py-12">
          <SafeIcon icon={FiRefreshCw} className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-2 text-gray-500">Loading courses...</p>
        </div>
      ) : (!courses || courses.length === 0) ? (
        <div className="text-center py-12 bg-white rounded-xl shadow border border-gray-200">
          <p className="text-gray-500">No courses found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              index={index}
              onDelete={handleDeleteCourse}
              manageLink={course.is_adaptive ? `/admin/full-length-test/${course.id}` : `/admin/regular-course/${course.id}`}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CourseForm
          onClose={() => setShowForm(false)}
          onSave={() => {
            loadCourses();
          }}
        />
      )}

      {showAdaptiveForm && (
        <AdaptiveCourseForm
          onClose={() => setShowAdaptiveForm(false)}
          onSave={() => {
            loadCourses();
          }}
        />
      )}
    </div>
  );
};

export default CourseManagement;