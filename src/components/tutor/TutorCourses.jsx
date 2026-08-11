import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { tutorService } from '../../services/api';
import { Link } from 'react-router-dom';
import axios from 'axios';

const { FiBook, FiUsers, FiClock, FiChevronRight, FiTrendingUp, FiSearch, FiBookOpen, FiActivity, FiGrid, FiClipboard, FiAward, FiList, FiStar, FiSettings, FiTriangle, FiBox, FiArrowRight } = FiIcons;


const COURSE_CATEGORIES = {
    'SAT': ['SAT Math', 'SAT Reading & Writing'],
    'ACT': ['ACT Math', 'ACT English', 'ACT Science', 'ACT Reading'],
    'AP': [
        'AP Biology', 'AP Calculus AB', 'AP Calculus BC', 'AP Chemistry',
        'AP English Language and Composition', 'AP Environmental Science',
        'AP Physics 1: Algebra-Based', 'AP Physics C: Mechanics',
        'AP Psychology', 'AP United States Government and Politics',
        'AP United States History'
    ],
    'FULL LENGTH TESTS': ['SAT', 'ACT', 'Linear SAT']
};

const COURSE_TAXONOMY = {
    'SAT Math': {
        'Algebra': ['Linear equations in one variable', 'Linear functions', 'Linear equations in two variables', 'Systems of two linear equations in two variables', 'Linear inequalities in one or two variables'],
        'Advanced Math': ['Nonlinear functions', 'Nonlinear equations in one variable and systems of equations in two variables', 'Equivalent expressions'],
        'Problem-Solving and Data Analysis': ['Ratios, rates, proportional relationships, and units', 'Percentages', 'One-variable data: Distributions and measures of center and spread', 'Two-variable data: Models and scatterplots', 'Probability and conditional probability', 'Inference from sample statistics and margin of error', 'Evaluating statistical claims: Observational studies and experiments'],
        'Geometry and Trigonometry': ['Area and volume', 'Lines, angles, and triangles', 'Right triangles and trigonometry', 'Circles']
    },
    'SAT Reading & Writing': {
        'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
        'Information and Ideas': ['Central Ideas and Details', 'Command of Evidence', 'Inferences'],
        'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
        'Expression of Ideas': ['Transitions', 'Rhetorical Synthesis']
    }
};

const getCourseTaxonomy = (course) => {
    if (course.is_adaptive) {
        return { section: 'FULL LENGTH TEST', category: 'FULL LENGTH TEST' };
    }
    if (course.category && course.category.trim() !== '') {
        return { section: course.tutor_type || 'Other', category: course.category };
    }
    const n = (course.name || '').toLowerCase().trim();
    for (const [section, categories] of Object.entries(COURSE_TAXONOMY)) {
        if (course.tutor_type && course.tutor_type !== section) continue;
        for (const [cat, subtopics] of Object.entries(categories)) {
            if (Array.isArray(subtopics) && subtopics.some(s => n === s.toLowerCase() || n.includes(s.toLowerCase()))) {
                return { section, category: cat };
            }
        }
    }
    const tutorTypeLower = (course.tutor_type || '').toLowerCase();
    if (tutorTypeLower.includes('math') || n.includes('math')) return { section: 'SAT Math', category: 'General' };
    if (tutorTypeLower.includes('reading') || tutorTypeLower.includes('writing') || n.includes('reading') || n.includes('writing')) return { section: 'SAT Reading & Writing', category: 'General' };
    return { section: course.tutor_type || 'Other', category: 'General' };
};

const TutorCourses = ({ dashboardData, isParentLoading }) => {
    
    const [courses, setCourses] = useState(dashboardData?.courses || []);
    const [loading, setLoading] = useState(!dashboardData && isParentLoading);
    
    // New UI Filter states
    const [filter, setFilter] = useState('');
    const [activeCategory, setActiveCategory] = useState('SAT');
    const [activeSubcategory, setActiveSubcategory] = useState('All');
    const [sortBy, setSortBy] = useState('recent');
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [viewMode, setViewMode] = useState('grid');

    // Filtering logic
    const filteredCourses = courses.filter(c => {
        // Must be active
        if (c.status && c.status !== 'active') return false;

        let mainCat = c.main_category || (
            (c.is_adaptive || (c.tutor_type || '').toLowerCase().includes('sat')) ? 'SAT' :
            (c.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
            ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science', 'psychology', 'history', 'government', 'english', 'environmental'].some(kw => (c.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
        );

        if (mainCat === 'FULL LENGTH TESTs' || c.is_adaptive || (c.tutor_type || '').toUpperCase() === 'LINEAR SAT') {
            mainCat = 'FULL LENGTH TESTS';
        }
        
        if (activeCategory !== mainCat) return false;

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
            return 0;
        });
    };

    const sortedFilteredCourses = sortCourses(filteredCourses);


    useEffect(() => {
        if (dashboardData?.courses) {
            setCourses(dashboardData.courses);
            setLoading(false);
        } else if (!isParentLoading && !dashboardData) {
            // Only fetch if parent is NOT loading but data is still missing
            fetchCourses();
        } else if (isParentLoading) {
            setLoading(true);
        }
    }, [dashboardData, isParentLoading]);

    const fetchCourses = async () => {
        if (!dashboardData) setLoading(true);
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn('Dashboard fetch timed out');
                setLoading(false);
            }
        }, 10000); // 10s timeout

        try {
            const response = await tutorService.getDashboard();
            setCourses(response.data.courses || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="p-12 text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-600 font-bold">Loading assigned courses...</p>
            <button
                onClick={fetchCourses}
                className="mt-4 text-xs text-gray-400 hover:text-blue-600 underline"
            >
                Taking too long? Click to retry
            </button>
        </div>
    );

    return (

        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-2">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">My Assigned Courses <FiAward className="text-blue-500 w-6 h-6" /></h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Courses you are authorized to manage</p>
                </div>
                
                {/* Search Box */}
                <div className="relative w-full sm:w-72 group">
                    <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search assigned courses..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-11 pr-9 py-2.5 bg-white dark:bg-[#11131A] border border-gray-200 dark:border-[#1C202B] text-gray-900 dark:text-white rounded-xl focus:outline-none focus:border-blue-500 transition-colors text-sm shadow-sm"
                    />
                    {filter && (
                        <button 
                            onClick={() => setFilter('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs p-1"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Top Category Buttons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
                {[
                    { id: 'SAT', title: 'SAT', subtitle: 'Digital SAT Prep', icon: FiBookOpen, bg: 'bg-[#181033]', border: 'border-[#7C3AED]', text: 'text-[#c4b5fd]' },
                    { id: 'ACT', title: 'ACT', subtitle: 'ACT Prep', icon: FiActivity, bg: 'bg-[#064E3B]', border: 'border-green-500', text: 'text-green-300' },
                    { id: 'AP', title: 'AP', subtitle: 'AP Courses', icon: FiGrid, bg: 'bg-[#332210]', border: 'border-orange-500', text: 'text-orange-300' },
                    { id: 'FULL LENGTH TESTS', title: 'FULL LENGTH TESTS', subtitle: 'Real Exam Simulation', icon: FiClipboard, bg: 'bg-[#0F172A]', border: 'border-blue-500', text: 'text-blue-300' }
                ].map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setActiveCategory(cat.id);
                            setActiveSubcategory('All');
                            setExpandedCategory(null);
                        }}
                        className={`px-4 py-3 rounded-2xl border flex items-center gap-3.5 transition-all duration-200 ${
                            activeCategory === cat.id 
                                ? `${cat.bg} ${cat.border} shadow-[0_0_18px_rgba(124,58,237,0.25)] ring-1 ring-purple-500/30` 
                                : 'bg-[#131622] border-[#252A3C] hover:border-purple-500/40 hover:bg-[#1A1F30]'
                        } cursor-pointer group`}
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

            {/* Subcategory Pills & Sort Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex flex-nowrap sm:flex-wrap gap-2.5 overflow-x-auto no-scrollbar px-1 py-1 w-full sm:w-auto">
                    <button
                        onClick={() => {
                            setActiveSubcategory('All');
                            setExpandedCategory(null);
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                            activeSubcategory === 'All' 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.35)]' 
                                : 'bg-white dark:bg-[#131726] border-gray-200 dark:border-[#262D42] text-gray-600 dark:text-slate-300 hover:border-blue-500/40 hover:bg-gray-50 dark:hover:bg-[#1A2035] hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        All
                    </button>
                    {(COURSE_CATEGORIES[activeCategory] || []).map(sub => (
                        <button
                            key={sub}
                            onClick={() => {
                                setActiveSubcategory(sub);
                                setExpandedCategory(null);
                            }}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                                activeSubcategory === sub 
                                    ? 'bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-white shadow-sm' 
                                    : 'bg-white dark:bg-[#131726] border-gray-200 dark:border-[#262D42] text-gray-600 dark:text-slate-300 hover:border-blue-500/40 hover:bg-gray-50 dark:hover:bg-[#1A2035] hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                            <SafeIcon icon={FiBookOpen} className={`w-3 h-3 ${activeSubcategory === sub ? 'text-blue-500 dark:text-blue-300' : 'text-gray-400 dark:text-slate-400'}`} />
                            {sub}
                        </button>
                    ))}
                </div>
                
                <div className="flex items-center gap-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <span className="hidden sm:inline">Sort by:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-white dark:bg-[#11131A] border border-gray-200 dark:border-[#1C202B] text-gray-700 dark:text-white text-xs font-bold py-1.5 px-3 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-sm"
                        >
                            <option value="recent">Recent</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="oldest">Oldest</option>
                        </select>
                    </div>
                    
                    <div className="flex gap-1.5 bg-white dark:bg-[#11131A] p-1 rounded-lg border border-gray-200 dark:border-[#1C202B]">
                        <button 
                            title="Grid View"
                            onClick={() => setViewMode('grid')}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                                viewMode === 'grid' 
                                    ? 'bg-blue-50 border border-blue-500 text-blue-600 dark:bg-[#181033] dark:border-[#7C3AED] dark:text-[#c4b5fd]' 
                                    : 'bg-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                             <SafeIcon icon={FiGrid} className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            title="List View"
                            onClick={() => setViewMode('list')}
                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                                viewMode === 'list' 
                                    ? 'bg-blue-50 border border-blue-500 text-blue-600 dark:bg-[#181033] dark:border-[#7C3AED] dark:text-[#c4b5fd]' 
                                    : 'bg-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                        >
                             <SafeIcon icon={FiList} className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {(() => {
                if (sortedFilteredCourses.length === 0) {
                    return (
                        <div className="col-span-full bg-white dark:bg-gray-800 p-12 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <SafeIcon icon={FiBook} className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Courses Found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">No assigned courses match your current filters.</p>
                            <button
                                onClick={() => {
                                    setFilter('');
                                    setActiveSubcategory('All');
                                }}
                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    );
                }

                const groups = {};
                sortedFilteredCourses.forEach(c => {
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

                const renderCourseCard = (course) => (
                    <motion.div
                        key={course.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-all group flex flex-col h-full"
                    >
                        <div className="p-6 flex-1 flex flex-col">
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
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 line-clamp-2 flex-1">
                                {course.description || 'No description provided.'}
                            </p>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Enrolled</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                        <SafeIcon icon={FiUsers} className="w-3 h-3 text-blue-500" />
                                        {typeof course.enrolled_count === 'object' ? (course.enrolled_count.count || 0) : (course.enrolled_count || 0)}
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
                );

                const renderCourseListRow = (course) => (
                    <motion.div
                        key={course.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:border-blue-500 dark:hover:border-blue-500 transition-all group flex flex-col sm:flex-row items-center p-4 gap-4"
                    >
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                            <SafeIcon icon={FiBook} className="w-6 h-6 text-blue-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                                {course.name}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {course.description || 'No description provided.'}
                            </p>
                        </div>

                        <div className="flex items-center gap-6 text-sm font-medium text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                                <SafeIcon icon={FiUsers} className="w-4 h-4 text-blue-500" />
                                <span>{typeof course.enrolled_count === 'object' ? (course.enrolled_count.count || 0) : (course.enrolled_count || 0)} Students</span>
                            </div>
                            <div className="flex items-center gap-2 hidden md:flex">
                                <SafeIcon icon={FiClock} className="w-4 h-4 text-indigo-500" />
                                <span>{new Date(course.created_at).toLocaleDateString()}</span>
                            </div>
                            <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">
                                Active
                            </span>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                            <Link
                                to={`/tutor/grades?courseId=${course.id}`}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold hover:bg-black dark:hover:bg-blue-600 hover:text-white transition-all"
                            >
                                <SafeIcon icon={FiTrendingUp} /> Analytics
                            </Link>
                            <Link
                                to={`/tutor/students?courseId=${course.id}`}
                                className="p-2 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center justify-center"
                            >
                                <SafeIcon icon={FiUsers} />
                            </Link>
                        </div>
                    </motion.div>
                );

                return (
                    <div>
                        {expandedCategory && (
                            <div className="flex items-center justify-between bg-white dark:bg-[#11131A] p-3 px-4 rounded-xl border border-gray-200 dark:border-[#1C202B] mb-6">
                                <span className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-300">
                                    Showing courses for: <strong className="text-blue-600 dark:text-purple-400">{expandedCategory}</strong>
                                </span>
                                <button 
                                    onClick={() => setExpandedCategory(null)}
                                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-purple-400 dark:hover:text-purple-300 font-bold flex items-center gap-1"
                                >
                                    ← Back to All Categories
                                </button>
                            </div>
                        )}
                        
                        {sortedGroups.map((cat, index) => {
                            const catIcons = [FiStar, FiUsers, FiSettings, FiTriangle, FiBox, FiActivity];
                            const catColors = ['text-purple-500', 'text-red-500', 'text-teal-500', 'text-blue-500', 'text-orange-500', 'text-green-500'];
                            const Icon = catIcons[index % catIcons.length];
                            const colorClass = catColors[index % catColors.length];
                            
                            return (
                                <div key={cat} className="mb-8">
                                    {cat !== 'General' && (
                                        <div className="flex justify-between items-center mb-6 mt-4 border-b border-gray-200 dark:border-[#1C202B] pb-2">
                                            <h3 className="text-[15px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                <SafeIcon icon={Icon} className={`w-4 h-4 ${colorClass}`} /> {cat}
                                            </h3>
                                            {expandedCategory === cat ? (
                                                <button 
                                                    onClick={() => setExpandedCategory(null)}
                                                    className="text-blue-500 hover:text-blue-600 dark:text-purple-500 dark:hover:text-purple-400 text-xs font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    Show All Categories
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => setExpandedCategory(cat)}
                                                    className="text-blue-500 hover:text-blue-600 dark:text-purple-500 dark:hover:text-purple-400 text-xs font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    View All <SafeIcon icon={FiArrowRight} className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {groups[cat].map(course => renderCourseCard(course))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {groups[cat].map(course => renderCourseListRow(course))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
};

export default TutorCourses;
