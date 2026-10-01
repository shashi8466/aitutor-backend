import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { recordingService } from '../../services/api';

const { FiVideo, FiPlay, FiSearch, FiClock, FiCalendar, FiX, FiLoader, FiCheckCircle } = FiIcons;

// Deliberately mirrors StudentCourseList.jsx's own top-row categories, colors, and icons exactly
// (same bg/border/text classes) - Recordings is meant to look and behave like a second tab on My
// Courses, not a differently-styled page.
const CATEGORY_CARDS = [
  { id: 'FULL LENGTH TESTS', category: 'full_length_test', title: 'FULL LENGTH TESTS', subtitle: 'Real Exam Simulation', icon: FiIcons.FiClipboard, bg: 'bg-[#0F172A]', border: 'border-blue-500', text: 'text-blue-300' },
  { id: 'SAT', category: 'sat', title: 'SAT', subtitle: 'Digital SAT Prep', icon: FiIcons.FiBookOpen, bg: 'bg-[#181033]', border: 'border-[#7C3AED]', text: 'text-[#c4b5fd]' },
  { id: 'ACT', category: 'act', title: 'ACT', subtitle: 'ACT Prep', icon: FiIcons.FiActivity, bg: 'bg-[#064E3B]', border: 'border-green-500', text: 'text-green-300' },
  { id: 'AP', category: 'ap', title: 'AP', subtitle: 'AP Courses', icon: FiIcons.FiGrid, bg: 'bg-[#332210]', border: 'border-orange-500', text: 'text-orange-300' },
  // Not a `category` at all (that column is null on platform rows) - this card's own filter logic
  // switches on recording_type === 'platform' instead, everywhere `.category === activeCategoryKey`
  // would normally be used.
  // 'id' stays 'PLATFORM' (internal key driving isPlatformTab/filtering below) - only the
  // student/tutor-facing `title` changes per the rename request.
  { id: 'PLATFORM', category: 'platform', title: 'PREP365 TUTORIALS', subtitle: 'Tutorials & Help', icon: FiIcons.FiHelpCircle, bg: 'bg-[#0F2A2E]', border: 'border-teal-500', text: 'text-teal-300' }
];

// Same fixed subcategory pill lists as My Courses' own COURSE_CATEGORIES - shown regardless of
// whether a subject currently has a recording, exactly like My Courses shows every real subject
// pill regardless of enrollment count.
const SUBCATEGORY_OPTIONS = {
  'FULL LENGTH TESTS': ['SAT', 'ACT', 'Linear SAT'],
  SAT: ['SAT Math', 'SAT Reading & Writing'],
  ACT: ['ACT Math', 'ACT English', 'ACT Science', 'ACT Reading'],
  AP: [
    'AP Biology', 'AP Calculus AB', 'AP Calculus BC', 'AP Chemistry',
    'AP English Language and Composition', 'AP Environmental Science',
    'AP Physics 1: Algebra-Based', 'AP Physics C: Mechanics', 'AP Psychology',
    'AP United States Government and Politics', 'AP United States History'
  ]
};

const extractTrailingNumber = (name) => {
  const match = (name || '').match(/(\d+)(?!.*\d)/);
  return match ? parseInt(match[1], 10) : Infinity;
};

const getYouTubeId = (url) => {
  const match = (url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const formatDate = (d) => {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

const formatTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
};

const isMathSubject = (tutorType) => (tutorType || '').toLowerCase().includes('math') || (tutorType || '').toLowerCase().includes('quant');
const isReadingSubject = (tutorType) => {
  const t = (tutorType || '').toLowerCase();
  return t.includes('reading') || t.includes('writing') || t.includes('english');
};

/**
 * One "course-shaped" card, styled to match StudentCourseList's own CourseCard (colored icon
 * box, subject badge, title, footer button) - the badge+title identify the SAME course row My
 * Courses shows; the footer is the one thing that's genuinely different (Watch Recording instead
 * of Enroll/View Results, since a recording has no progress/enrollment state of its own).
 */
const RecordingCourseCard = ({ index, title, tutorType, recordings, onWatch }) => {
  const tagTheme = isMathSubject(tutorType)
    ? { bg: 'bg-blue-500/20', text: 'text-blue-400', iconBg: 'bg-[#181033]', iconText: 'text-purple-400' }
    : isReadingSubject(tutorType)
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
        <div className="flex gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tagTheme.iconBg} ${tagTheme.iconText}`}>
            <SafeIcon icon={FiVideo} className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center w-fit mb-1.5 ${tagTheme.bg} ${tagTheme.text}`}>
              {tutorType || 'General'}
            </span>
            <h3 className="font-bold text-sm md:text-[15px] text-white leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
              {title}
            </h3>
          </div>
        </div>

        <div className="space-y-2.5">
          {recordings.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 bg-[#0F1219] border border-[#1C202B] rounded-xl px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-200 truncate">{r.title}</p>
                {(r.recording_date || r.recording_time) && (
                  <p className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5">
                    {r.recording_date && <span className="flex items-center gap-1"><SafeIcon icon={FiCalendar} className="w-2.5 h-2.5" /> {formatDate(r.recording_date)}</span>}
                    {r.recording_time && <span className="flex items-center gap-1"><SafeIcon icon={FiClock} className="w-2.5 h-2.5" /> {formatTime(r.recording_time)}</span>}
                  </p>
                )}
                {r.deadline && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5">
                    <SafeIcon icon={FiClock} className="w-2.5 h-2.5" /> Deadline: {formatDate(r.deadline)}
                  </p>
                )}
              </div>
              <button
                onClick={() => onWatch(r)}
                className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white flex items-center justify-center transition-all"
                title="Watch Recording"
              >
                <SafeIcon icon={FiPlay} className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {recordings.length === 1 && (
        <div className="p-4 border-t border-[#1C202B]">
          <button
            onClick={() => onWatch(recordings[0])}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
          >
            <SafeIcon icon={FiPlay} className="w-3.5 h-3.5" /> Watch Recording
          </button>
        </div>
      )}
    </motion.div>
  );
};

/**
 * Student + Tutor recordings library - deliberately styled and organized to look/behave like a
 * second tab on My Courses (same category cards, same subcategory pills, same course-card look),
 * not a differently-designed page. Category/subcategory/sort/view are persistent filters on ONE
 * page (matching My Courses), never a separate drill-down screen with its own Back button.
 * Grouping is driven entirely by the real courses.tutor_type/category/name fields already joined
 * onto each recording by the server - never a second, recording-only taxonomy.
 */
const RecordingsBrowser = () => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState('FULL LENGTH TESTS');
  const [activeSubcategory, setActiveSubcategory] = useState('All');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [watching, setWatching] = useState(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const { data } = await recordingService.getAll();
      setRecordings(data.data || []);
    } catch (err) {
      console.error('Failed to load recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeCategoryKey = CATEGORY_CARDS.find((c) => c.id === activeCategory)?.category;
  const activeCategoryTitle = CATEGORY_CARDS.find((c) => c.id === activeCategory)?.title || activeCategory;
  const isPlatformTab = activeCategory === 'PLATFORM';

  const categoryRecordings = useMemo(
    () => recordings.filter((r) => (isPlatformTab ? r.recording_type === 'platform' : r.category === activeCategoryKey)),
    [recordings, activeCategoryKey, isPlatformTab]
  );

  // Platform Recordings don't have a fixed subcategory list (platform_category is an admin-curated,
  // occasionally-changing constant) - pills are computed from whatever categories are actually
  // present in this user's authorized recordings, rather than a hardcoded list that could show
  // empty pills.
  const platformSubcategoryOptions = useMemo(() => {
    if (!isPlatformTab) return [];
    const set = new Set(categoryRecordings.map((r) => r.platform_category).filter(Boolean));
    return Array.from(set).sort();
  }, [categoryRecordings, isPlatformTab]);

  const subcategoryFiltered = useMemo(() => {
    if (activeSubcategory === 'All') return categoryRecordings;
    if (isPlatformTab) return categoryRecordings.filter((r) => r.platform_category === activeSubcategory);
    if (activeCategory === 'FULL LENGTH TESTS') {
      const tutorTypeBySub = { SAT: 'Full-Length SAT', ACT: 'Full-Length ACT', 'Linear SAT': 'Linear SAT' };
      return categoryRecordings.filter((r) => r.course?.tutor_type === tutorTypeBySub[activeSubcategory]);
    }
    return categoryRecordings.filter((r) => r.course?.tutor_type === activeSubcategory);
  }, [categoryRecordings, activeCategory, activeSubcategory, isPlatformTab]);

  const searched = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return subcategoryFiltered;
    return subcategoryFiltered.filter((r) =>
      (r.title || '').toLowerCase().includes(term) ||
      (r.course?.name || '').toLowerCase().includes(term) ||
      (r.course?.category || '').toLowerCase().includes(term) ||
      (r.course?.tutor_type || '').toLowerCase().includes(term) ||
      (r.platform_category || '').toLowerCase().includes(term)
    );
  }, [subcategoryFiltered, filter]);

  const sorted = useMemo(() => {
    const list = [...searched];
    list.sort((a, b) => {
      const aTime = new Date(a.recording_date || a.created_at || 0).getTime();
      const bTime = new Date(b.recording_date || b.created_at || 0).getTime();
      return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [searched, sortBy]);

  // Group into "course cards" (one per real courses.id) - a Full-Length Test or an ACT/AP subject
  // is one card; a SAT topic is one card, nested under its real Unit heading. General (course-less)
  // recordings get their own small section so nothing published is ever lost from view.
  const { unitGroups, flatCards, generalRecordings } = useMemo(() => {
    if (isPlatformTab) {
      // Group by platform_category into the SAME { course, recordings } shape the ACT/AP flatCard
      // branch already uses (course.id/name/tutor_type) - a synthetic "course" so the existing
      // RecordingCourseCard rendering below needs no Platform-specific branch of its own.
      const byCategory = new Map();
      sorted.forEach((r) => {
        const key = r.platform_category || 'Other';
        if (!byCategory.has(key)) byCategory.set(key, { course: { id: `platform-${key}`, name: key, tutor_type: 'Platform' }, recordings: [] });
        byCategory.get(key).recordings.push(r);
      });
      const cards = Array.from(byCategory.values()).sort((a, b) => a.course.name.localeCompare(b.course.name));
      return { unitGroups: null, flatCards: cards, generalRecordings: [] };
    }

    const courseMap = new Map(); // course.id -> { course, recordings }
    const general = [];
    sorted.forEach((r) => {
      if (!r.course_id || !r.course) {
        general.push(r);
        return;
      }
      if (!courseMap.has(r.course_id)) courseMap.set(r.course_id, { course: r.course, recordings: [] });
      courseMap.get(r.course_id).recordings.push(r);
    });

    if (activeCategory === 'FULL LENGTH TESTS') {
      const cards = Array.from(courseMap.values()).sort((a, b) => extractTrailingNumber(a.course.name) - extractTrailingNumber(b.course.name));
      return { unitGroups: null, flatCards: cards, generalRecordings: general };
    }

    if (activeCategory === 'SAT') {
      // Unit -> Topic, exactly like My Courses' own "Advanced Math" / "Algebra" section headers.
      const units = new Map();
      courseMap.forEach(({ course, recordings: recs }) => {
        const unit = (course.category && course.category.trim()) || 'General';
        if (!units.has(unit)) units.set(unit, []);
        units.get(unit).push({ course, recordings: recs });
      });
      return { unitGroups: Array.from(units.entries()), flatCards: null, generalRecordings: general };
    }

    // ACT/AP: one course per subject in this data - a flat grid, same as My Courses shows for ACT.
    const cards = Array.from(courseMap.values()).sort((a, b) => (a.course.name || '').localeCompare(b.course.name || ''));
    return { unitGroups: null, flatCards: cards, generalRecordings: general };
  }, [sorted, activeCategory, isPlatformTab]);

  const hasAnyContent = (unitGroups?.length || 0) > 0 || (flatCards?.length || 0) > 0 || generalRecordings.length > 0;

  const handleWatch = (r) => setWatching(r);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <SafeIcon icon={FiLoader} className="w-8 h-8 text-[#E53935] animate-spin" />
      </div>
    );
  }

  const gridClass = viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex flex-col gap-3';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 font-sans">
      {/* Header - identical layout to StudentCourseList's own */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
            Recordings <SafeIcon icon={FiVideo} className="text-purple-400 w-8 h-8" />
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Tutorial classes, course recordings, and full-length test reviews.</p>
        </div>

        <div className="relative w-full sm:w-72 group">
          <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-purple-500 transition-colors" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-9 py-2.5 bg-[#11131A] border border-[#1C202B] text-white rounded-xl focus:outline-none focus:border-purple-500 transition-colors text-sm shadow-sm"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs p-1" title="Clear search">✕</button>
          )}
        </div>
      </div>

      {/* Category cards - same 4, same colors, same selected-state glow as My Courses */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {CATEGORY_CARDS.map((cat) => {
          const count = cat.id === 'PLATFORM'
            ? recordings.filter((r) => r.recording_type === 'platform').length
            : recordings.filter((r) => r.category === cat.category).length;
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setActiveSubcategory('All'); }}
              className={`px-4 py-3 rounded-2xl border flex items-center gap-3.5 transition-all duration-200 ${
                activeCategory === cat.id
                  ? `${cat.bg} ${cat.border} shadow-[0_0_18px_rgba(124,58,237,0.25)] ring-1 ring-purple-500/30`
                  : 'bg-[#131622] border-[#252A3C] hover:border-purple-500/40 hover:bg-[#1A1F30]'
              } cursor-pointer group`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 transition-colors ${
                activeCategory === cat.id ? `border-purple-400/30 bg-purple-500/10 ${cat.text}` : 'border-[#2D3448] bg-[#1B2030] text-slate-400 group-hover:text-slate-200 group-hover:border-purple-500/40'
              }`}>
                <SafeIcon icon={cat.icon} className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <h3 className={`font-bold text-xs sm:text-sm truncate tracking-tight ${activeCategory === cat.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{cat.title}</h3>
                <p className={`text-[10px] truncate ${activeCategory === cat.id ? 'text-purple-200/80' : 'text-slate-400'}`}>{cat.subtitle} · {count} recording{count === 1 ? '' : 's'}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subcategory pills + Sort/View controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start gap-5 w-full">
        {/* Same as My Courses (StudentCourseList.jsx) - Full-Length Tests has no real subcategory
            of its own (the All/SAT/ACT/Linear SAT pills just re-filtered the SAME enrolled-tests
            list by test type), so hiding this row goes straight to the Full-Length Tests list
            instead of an extra filtering step. SAT/ACT/AP/Platform keep their pills unchanged. */}
        {activeCategory !== 'FULL LENGTH TESTS' && (
        <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
          <button
            onClick={() => setActiveSubcategory('All')}
            className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center justify-center cursor-pointer whitespace-nowrap ${
              activeSubcategory === 'All' ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]' : 'bg-[#131726] border-[#262D42] text-slate-300 hover:border-purple-500/40 hover:bg-[#1A2035] hover:text-white'
            }`}
          >
            All
          </button>
          {(isPlatformTab ? platformSubcategoryOptions : (SUBCATEGORY_OPTIONS[activeCategory] || [])).map((sub) => (
            <button
              key={sub}
              onClick={() => setActiveSubcategory(sub)}
              className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center gap-2 justify-center cursor-pointer whitespace-nowrap ${
                activeSubcategory === sub ? 'bg-[#181033] border-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.25)]' : 'bg-[#131726] border-[#262D42] text-slate-300 hover:border-purple-500/40 hover:bg-[#1A2035] hover:text-white'
              }`}
            >
              <SafeIcon icon={FiIcons.FiBookOpen} className={`w-3 h-3 flex-shrink-0 ${activeSubcategory === sub ? 'text-purple-300' : 'text-slate-400'}`} />
              <span className="truncate">{sub}</span>
            </button>
          ))}
        </div>
        )}

        <div className="flex items-center gap-3 text-xs font-bold text-gray-400 shrink-0 xl:ml-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 hidden sm:inline">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#11131A] border border-[#1C202B] text-white text-xs font-bold px-3 h-9 rounded-lg focus:outline-none focus:border-purple-500 cursor-pointer hover:border-gray-700 transition-colors"
            >
              <option value="recent">Recent</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
          <div className="flex gap-1.5 bg-[#11131A] p-1 rounded-lg border border-[#1C202B] h-10 items-center">
            <button title="Grid View" onClick={() => setViewMode('grid')} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[#181033] border border-[#7C3AED] text-[#c4b5fd]' : 'bg-transparent text-gray-400 hover:text-white'}`}>
              <SafeIcon icon={FiIcons.FiGrid} className="w-3.5 h-3.5" />
            </button>
            <button title="List View" onClick={() => setViewMode('list')} className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-[#181033] border border-[#7C3AED] text-[#c4b5fd]' : 'bg-transparent text-gray-400 hover:text-white'}`}>
              <SafeIcon icon={FiIcons.FiList} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <section>
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-[#1C202B] pb-3">
          <SafeIcon icon={FiCheckCircle} className="text-green-500" /> {activeCategoryTitle}
        </h2>

        {!hasAnyContent ? (
          <div className="text-center py-12 bg-[#11131A] rounded-2xl border border-dashed border-[#1C202B]">
            <p className="text-gray-500">{filter ? 'No recordings match your search.' : 'No recordings published here yet.'}</p>
          </div>
        ) : unitGroups ? (
          <div className="space-y-8">
            {unitGroups.map(([unit, cards]) => (
              <div key={unit}>
                <h3 className="text-sm font-bold text-purple-300 mb-4 flex items-center gap-2">
                  <SafeIcon icon={FiIcons.FiStar} className="w-3.5 h-3.5" /> {unit}
                </h3>
                <div className={gridClass}>
                  {cards.map(({ course, recordings: recs }, idx) => (
                    <RecordingCourseCard key={course.id} index={idx} title={course.name} tutorType={course.tutor_type} recordings={recs} onWatch={handleWatch} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={gridClass}>
            {flatCards.map(({ course, recordings: recs }, idx) => (
              <RecordingCourseCard key={course.id} index={idx} title={course.name} tutorType={course.tutor_type} recordings={recs} onWatch={handleWatch} />
            ))}
          </div>
        )}

        {generalRecordings.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-bold text-purple-300 mb-4 flex items-center gap-2">
              <SafeIcon icon={FiIcons.FiStar} className="w-3.5 h-3.5" /> General
            </h3>
            <div className={gridClass}>
              {generalRecordings.map((r, idx) => (
                <RecordingCourseCard key={r.id} index={idx} title={r.title} tutorType={`All ${activeCategory}`} recordings={[r]} onWatch={handleWatch} />
              ))}
            </div>
          </div>
        )}
      </section>

      <AnimatePresence>
        {watching && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[9999]" onClick={() => setWatching(null)}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-[#11131A] border border-[#1C202B] rounded-2xl w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1C202B]">
                <h3 className="font-bold text-white text-sm truncate pr-4">{watching.title}</h3>
                <button onClick={() => setWatching(null)} className="text-slate-400 hover:text-white shrink-0"><SafeIcon icon={FiX} className="w-5 h-5" /></button>
              </div>
              {getYouTubeId(watching.video_url) ? (
                <div className="aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeId(watching.video_url)}`}
                    title={watching.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-slate-300 text-sm mb-4">This video opens in a new tab.</p>
                  <a
                    href={watching.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWatching(null)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm"
                  >
                    <SafeIcon icon={FiPlay} /> Open Recording
                  </a>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecordingsBrowser;
