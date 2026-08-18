import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { gradingService, tutorService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiActivity, FiClock, FiAward, FiArrowRight, FiFileText, FiTrendingUp, FiDownload, FiCheckCircle, FiXCircle, FiLayers, FiAlertCircle } = FiIcons;

const REQUIRED_LEVELS = ['Easy', 'Medium', 'Hard'];

const PRIMARY_CATEGORIES = [
  { id: 'SAT', title: 'SAT', subtitle: 'Digital SAT Prep', icon: 'FiBookOpen', bg: 'bg-[#181033]', border: 'border-[#7C3AED]', text: 'text-[#c4b5fd]' },
  { id: 'ACT', title: 'ACT', subtitle: 'ACT Prep', icon: 'FiActivity', bg: 'bg-[#064E3B]', border: 'border-green-500', text: 'text-green-300' },
  { id: 'AP', title: 'AP', subtitle: 'AP Courses', icon: 'FiGrid', bg: 'bg-[#332210]', border: 'border-orange-500', text: 'text-orange-300' },
  { id: 'FULL LENGTH TESTS', title: 'FULL LENGTH TESTS', subtitle: 'Real Exam Simulation', icon: 'FiClipboard', bg: 'bg-[#0F172A]', border: 'border-blue-500', text: 'text-blue-300' }
];

// Classifies a submission into a primary category (SAT/ACT/AP/FULL LENGTH TESTS) and a
// subcategory, mirroring the same main_category/is_adaptive convention used across the app
// (StudentCourseList.jsx, the universal leaderboard) rather than inventing a new one.
const classifySubmission = (sub) => {
  const courseObj = sub.course || sub.courses || {};
  const name = (courseObj.name || sub.courseName || sub.test_name || '').toLowerCase();
  const mainCategoryField = (courseObj.main_category || '').toUpperCase();
  const tutorType = courseObj.tutor_type || '';
  const tutorTypeUpper = tutorType.toUpperCase();
  const isAdaptive = courseObj.is_adaptive === true;

  let mainCat;
  if (mainCategoryField === 'FULL LENGTH TESTS' || isAdaptive || name.includes('full length') || name.includes('full-length') || name.includes('linear sat')) {
    mainCat = 'FULL LENGTH TESTS';
  } else if (mainCategoryField === 'AP' || tutorTypeUpper.startsWith('AP') || /\bap\b/.test(name)) {
    mainCat = 'AP';
  } else if (mainCategoryField === 'ACT' || tutorTypeUpper.includes('ACT') || name.includes('act')) {
    mainCat = 'ACT';
  } else {
    mainCat = 'SAT';
  }

  let subCat;
  if (mainCat === 'SAT') {
    if (tutorType === 'SAT Math' || tutorType === 'SAT Reading & Writing') {
      subCat = tutorType;
    } else {
      const mathKeywords = ['math', 'algebra', 'linear', 'nonlinear', 'equivalent', 'geometry', 'triangle', 'circle', 'trigonometry', 'data', 'ratio', 'percentage', 'probability', 'statistic'];
      subCat = mathKeywords.some(k => name.includes(k)) ? 'SAT Math' : 'SAT Reading & Writing';
    }
  } else if (mainCat === 'ACT') {
    if (['ACT Math', 'ACT English', 'ACT Reading', 'ACT Science'].includes(tutorType)) {
      subCat = tutorType;
    } else if (name.includes('math')) subCat = 'ACT Math';
    else if (name.includes('english')) subCat = 'ACT English';
    else if (name.includes('science')) subCat = 'ACT Science';
    else subCat = 'ACT Reading';
  } else if (mainCat === 'AP') {
    // Dynamic: the actual AP course name, not a hardcoded list.
    subCat = courseObj.name || 'AP Course';
  } else {
    // Dynamic: the actual full-length test name, not a hardcoded list.
    subCat = courseObj.name || 'Full-Length Test';
  }

  return { mainCat, subCat };
};

// Helper to compute real attempt stats for any course/test type
const getTestAttemptStats = (sub) => {
  const courseName = sub.course?.name || sub.courses?.name || sub.courseName || sub.test_name || 'Practice Test';
  const nameLower = courseName.toLowerCase();
  
  const isACT = nameLower.includes('act');
  const isAP = nameLower.includes('ap');
  const isSAT = nameLower.includes('sat') || nameLower.includes('digital sat') || nameLower.includes('linear sat');
  const isFullLength = nameLower.includes('full length') || nameLower.includes('full-length') || sub.is_full_length;

  const totalQuestions = sub.total_questions || sub.question_count || sub.totalQuestions || 
    ((sub.incorrect_questions?.length || 0) + (sub.correct_questions?.length || 0)) || 0;
  
  const rawScore = sub.raw_score !== undefined && sub.raw_score !== null 
    ? sub.raw_score 
    : (sub.correct_questions?.length || 0);

  const accuracy = sub.raw_score_percentage !== undefined && sub.raw_score_percentage !== null
    ? Math.round(sub.raw_score_percentage)
    : (totalQuestions > 0 ? Math.round((rawScore / totalQuestions) * 100) : 0);

  const wrongCount = totalQuestions > 0 ? Math.max(0, totalQuestions - rawScore) : 0;
  const durationSec = sub.test_duration_seconds || sub.duration || sub.time_spent || 0;
  const durationText = durationSec > 0 
    ? (durationSec < 60 ? `${durationSec} sec` : `${Math.floor(durationSec / 60)} min ${durationSec % 60} sec`)
    : 'N/A';

  let displayScore = 0;
  let scoreLabel = 'Test Score';
  let performanceLevel = 'Needs Improvement';
  let performanceColor = 'red';

  if (isACT) {
    scoreLabel = 'ACT Score';
    if (sub.scaled_score && sub.scaled_score >= 1 && sub.scaled_score <= 36) {
      displayScore = sub.scaled_score;
    } else {
      displayScore = Math.max(1, Math.min(36, Math.round(1 + (accuracy / 100) * 35)));
    }
    if (displayScore >= 30) { performanceLevel = 'Excellent'; performanceColor = 'green'; }
    else if (displayScore >= 24) { performanceLevel = 'Good'; performanceColor = 'blue'; }
    else if (displayScore >= 18) { performanceLevel = 'Average'; performanceColor = 'yellow'; }
    else if (displayScore >= 14) { performanceLevel = 'Below Average'; performanceColor = 'orange'; }
    else { performanceLevel = 'Needs Improvement'; performanceColor = 'red'; }
  } else if (isAP) {
    scoreLabel = 'AP Score';
    if (sub.scaled_score && sub.scaled_score >= 1 && sub.scaled_score <= 5) {
      displayScore = sub.scaled_score;
    } else {
      displayScore = accuracy >= 85 ? 5 : accuracy >= 70 ? 4 : accuracy >= 55 ? 3 : accuracy >= 40 ? 2 : 1;
    }
    if (displayScore >= 5) { performanceLevel = 'Excellent'; performanceColor = 'green'; }
    else if (displayScore >= 4) { performanceLevel = 'Good'; performanceColor = 'blue'; }
    else if (displayScore >= 3) { performanceLevel = 'Average'; performanceColor = 'yellow'; }
    else if (displayScore >= 2) { performanceLevel = 'Below Average'; performanceColor = 'orange'; }
    else { performanceLevel = 'Needs Improvement'; performanceColor = 'red'; }
  } else if (isSAT || isFullLength) {
    scoreLabel = 'SAT Score';
    if (sub.scaled_score && sub.scaled_score >= 200) {
      displayScore = sub.scaled_score;
    } else if (sub.math_scaled_score && sub.reading_scaled_score) {
      displayScore = sub.math_scaled_score + sub.reading_scaled_score;
    } else {
      displayScore = Math.round(400 + (accuracy / 100) * 1200);
    }
    if (displayScore >= 1400) { performanceLevel = 'Excellent'; performanceColor = 'green'; }
    else if (displayScore >= 1200) { performanceLevel = 'Good'; performanceColor = 'blue'; }
    else if (displayScore >= 1000) { performanceLevel = 'Average'; performanceColor = 'yellow'; }
    else if (displayScore >= 800) { performanceLevel = 'Below Average'; performanceColor = 'orange'; }
    else { performanceLevel = 'Needs Improvement'; performanceColor = 'red'; }
  } else {
    // Modular / Practice / Topic Tests
    if (sub.scaled_score && sub.scaled_score > 0) {
      displayScore = sub.scaled_score;
    } else {
      displayScore = accuracy;
    }
    scoreLabel = 'Test Score';
    if (accuracy >= 90) { performanceLevel = 'Excellent'; performanceColor = 'green'; }
    else if (accuracy >= 80) { performanceLevel = 'Good'; performanceColor = 'blue'; }
    else if (accuracy >= 70) { performanceLevel = 'Average'; performanceColor = 'yellow'; }
    else if (accuracy >= 60) { performanceLevel = 'Below Average'; performanceColor = 'orange'; }
    else { performanceLevel = 'Needs Improvement'; performanceColor = 'red'; }
  }

  return {
    courseName,
    displayScore,
    scoreLabel,
    performanceLevel,
    performanceColor,
    accuracy,
    rawScore,
    wrongCount,
    totalQuestions,
    durationText,
    testDate: new Date(sub.test_date || sub.created_at)
  };
};

const TestReview = ({ studentId: propStudentId = null, basePath = '/student' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentId: paramStudentId } = useParams();
  const studentId = propStudentId || paramStudentId;
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSubcategory, setActiveSubcategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    if (user) loadScores();
  }, [user, studentId]);

  const loadScores = async () => {
    try {
      setLoading(true);
      if (studentId) {
        // Admin or Tutor viewing a student's progress
        const response = await tutorService.getStudentProgress(studentId);
        setSubmissions(response.data.submissions || []);
      } else {
        // Student viewing their own scores
        const response = await gradingService.getAllMyScores();
        setSubmissions(response.data.submissions || []);
      }
    } catch (error) {
      console.error("Failed to load test history", error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic secondary-filter options for the active primary category. AP and Full-Length
  // Tests are built from whichever courses the student actually has submissions for -
  // never a hardcoded list.
  const subcategoryOptions = useMemo(() => {
    if (activeCategory === 'All') return [];
    if (activeCategory === 'SAT') return ['SAT Math', 'SAT Reading & Writing'];
    if (activeCategory === 'ACT') return ['ACT Math', 'ACT English', 'ACT Reading', 'ACT Science'];

    const names = new Set();
    submissions.forEach(sub => {
      const { mainCat, subCat } = classifySubmission(sub);
      if (mainCat === activeCategory) names.add(subCat);
    });
    return Array.from(names).sort();
  }, [submissions, activeCategory]);

  const filteredSubmissions = useMemo(() => {
    if (activeCategory === 'All') return submissions;
    return submissions.filter(sub => {
      const { mainCat, subCat } = classifySubmission(sub);
      if (mainCat !== activeCategory) return false;
      if (activeSubcategory !== 'All' && subCat !== activeSubcategory) return false;
      return true;
    });
  }, [submissions, activeCategory, activeSubcategory]);

  // --- AGGREGATE COMBINED SAT REGULAR COURSE REPORTS ---
  const combinedTopicReports = useMemo(() => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return [];

    const grouped = {};

    filteredSubmissions.forEach(sub => {
      const cId = sub.course_id || sub.course?.id;
      if (!cId) return;

      const cName = sub.course?.name || sub.courses?.name || sub.courseName || 'SAT Topic';

      // Reuse the same main_category/is_adaptive classification used for the category filter
      // bar above, rather than re-guessing subject from the course name. The previous check
      // only matched Math-specific keywords ("linear", "nonlinear", "equivalent"), so Reading &
      // Writing topics (e.g. "Cross-Text Connections") never qualified for combining - this
      // works for every SAT regular course (Math and Reading & Writing alike) since
      // classifySubmission already excludes Full-Length Tests via its own mainCat logic.
      const { mainCat } = classifySubmission(sub);

      // Aggregate SAT Regular Course topics
      if (mainCat === 'SAT') {
        if (!grouped[cId]) {
          grouped[cId] = {
            courseId: cId,
            topicName: cName,
            attempts: [],
            levelsSeen: new Set(),
            latestDate: sub.created_at
          };
        }
        grouped[cId].attempts.push(sub);
        const levelSeen = (sub.level || '').toLowerCase().trim();
        if (levelSeen) grouped[cId].levelsSeen.add(levelSeen);
        if (new Date(sub.created_at) > new Date(grouped[cId].latestDate)) {
          grouped[cId].latestDate = sub.created_at;
        }
      }
    });

    return Object.values(grouped).map(group => {
      let totalQuestions = 0;
      let totalCorrect = 0;
      let totalIncorrect = 0;
      let totalDurationSec = 0;

      group.attempts.forEach(sub => {
        const stats = getTestAttemptStats(sub);
        totalQuestions += stats.totalQuestions;
        totalCorrect += stats.rawScore;
        totalIncorrect += stats.wrongCount;
        totalDurationSec += (sub.test_duration_seconds || sub.duration || 0);
      });

      const missingLevels = REQUIRED_LEVELS.filter(lvl => !group.levelsSeen.has(lvl.toLowerCase()));
      const isFullyCompleted = missingLevels.length === 0;

      // Don't fabricate a combined score until every required level is actually completed.
      const overallAccuracy = isFullyCompleted && totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
      // SAT Scaled Score (200 - 800 Scale)
      const overallScaledScore = isFullyCompleted && totalQuestions > 0 ? Math.round(200 + (totalCorrect / totalQuestions) * 600) : null;

      const formatTimeText = (sec) => {
        if (!sec || sec <= 0) return '0m 0s';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}m ${s}s`;
      };

      const dateObj = new Date(group.latestDate);
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
      const formattedTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        courseId: group.courseId,
        topicName: group.topicName,
        totalQuestions,
        totalCorrect,
        totalIncorrect,
        overallAccuracy,
        overallScaledScore,
        formattedTime: formatTimeText(totalDurationSec),
        dateStr: `${formattedDate} at ${formattedTimeStr}`,
        // Raw timestamp of the group's most recent attempt, used for sorting - the actual
        // attempt/submission completion time, never course/upload metadata.
        latestDateRaw: group.latestDate,
        attemptsCount: group.attempts.length,
        isFullyCompleted,
        missingLevels,
        completedLevelsCount: REQUIRED_LEVELS.length - missingLevels.length
      };
      // Latest-attempt-first: whenever a new attempt completes for this topic, its timestamp
      // becomes group.latestDate above, so this card naturally sorts back to the top.
    }).sort((a, b) => new Date(b.latestDateRaw) - new Date(a.latestDateRaw));
  }, [filteredSubmissions]);

  // Single, unified latest-first list: combined SAT topic cards and individual attempt cards
  // (ACT/AP/Full-Length, plus each level's own attempt) are merged and sorted together by their
  // actual completion timestamp, so a newly finished attempt of ANY kind always lands at the
  // top of the page instead of being stuck behind a fixed "combined cards first" block.
  const displayItems = useMemo(() => {
    const combinedItems = combinedTopicReports.map(combined => ({
      key: `combined_${combined.courseId}`,
      type: 'combined',
      data: combined,
      sortDate: new Date(combined.latestDateRaw)
    }));

    // Every SAT regular-course topic already has its own combined card above - either the
    // "fully completed" version or the "X of 3 levels" in-progress version - so its individual
    // per-level attempts shouldn't also render as separate, differently-styled duplicate cards.
    // Only submissions that can't be grouped at all (ACT/AP/Full-Length attempts) still need
    // their own individual card.
    const groupedCourseIds = new Set(combinedTopicReports.map(c => c.courseId));
    const individualItems = filteredSubmissions
      .filter(sub => !groupedCourseIds.has(sub.course_id || sub.course?.id))
      .map(sub => ({
        key: `sub_${sub.id}`,
        type: 'individual',
        data: sub,
        sortDate: new Date(sub.test_date || sub.created_at)
      }));

    return [...combinedItems, ...individualItems].sort((a, b) => b.sortDate - a.sortDate);
  }, [combinedTopicReports, filteredSubmissions]);

  const renderCombinedCard = (combined) => (
    <motion.div
      key={`combined_${combined.courseId}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#131b2e] dark:bg-[#131b2e] rounded-2xl p-6 border-2 shadow-xl text-white mb-2 ${
        combined.isFullyCompleted ? 'border-blue-500/60' : 'border-amber-500/40'
      }`}
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-4 rounded-2xl border ${
            combined.isFullyCompleted
              ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
              : 'bg-amber-600/20 text-amber-400 border-amber-500/30'
          }`}>
            <SafeIcon icon={combined.isFullyCompleted ? FiLayers : FiAlertCircle} className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h3 className="font-black text-xl text-white leading-tight">
                {combined.topicName}
              </h3>
              {combined.isFullyCompleted ? (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-blue-300 border border-slate-700">
                  Easy + Medium + Hard
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  {combined.completedLevelsCount} of {REQUIRED_LEVELS.length} Levels Completed
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-2">
                <SafeIcon icon={FiClock} className="w-4 h-4 text-blue-400" />
                {combined.dateStr}
              </span>
              {combined.isFullyCompleted && (
                <span className="flex items-center gap-2">
                  <SafeIcon icon={FiTrendingUp} className="w-4 h-4 text-blue-400" />
                  Accuracy: {combined.overallAccuracy}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Score Header Display */}
        <div className="text-left lg:text-right flex-1 lg:flex-none">
          {combined.isFullyCompleted ? (
            <>
              <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest mb-1">Overall Scaled Score</p>
              <p className="text-3xl font-black text-white tracking-tight">
                {combined.overallScaledScore} <span className="text-sm font-bold text-slate-400">/ 800</span>
              </p>
              <p className="text-[10px] font-bold text-blue-400 mt-1 uppercase">
                {combined.overallAccuracy}% Overall Accuracy
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] text-amber-300 font-black uppercase tracking-widest mb-1">Test In Progress</p>
              <p className="text-xs font-bold text-slate-400 max-w-[220px]">
                Missing: <span className="text-white">{combined.missingLevels.join(', ')}</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Quick Combined Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0a0e20] rounded-xl border border-slate-800 mb-6 text-center">
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Total Questions</p>
          <p className="text-lg font-black text-white">{combined.totalQuestions}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Total Correct</p>
          <p className="text-lg font-black text-emerald-400">{combined.totalCorrect}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Total Incorrect</p>
          <p className="text-lg font-black text-rose-400">{combined.totalIncorrect}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Total Time</p>
          <p className="text-lg font-black text-white">{combined.formattedTime}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {combined.isFullyCompleted ? (
          <>
            <button
              onClick={() => navigate(`${basePath}/topic-report/${combined.courseId}`)}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <SafeIcon icon={FiFileText} className="w-4 h-4" /> View Report
            </button>
            <button
              onClick={() => navigate(`${basePath}/topic-report/${combined.courseId}?view=question-wise`)}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <SafeIcon icon={FiArrowRight} className="w-4 h-4" /> Question-wise Analysis
            </button>
            <button
              onClick={() => navigate(`${basePath}/topic-report/${combined.courseId}?download=true`)}
              className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              <SafeIcon icon={FiDownload} className="w-4 h-4" /> Download PDF
            </button>
          </>
        ) : (
          <>
            <button
              disabled
              title="Complete all levels to view the combined report"
              className="flex-1 py-3 px-4 bg-slate-800 text-slate-500 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed"
            >
              <SafeIcon icon={FiFileText} className="w-4 h-4" /> View Report
            </button>
            <button
              disabled
              title="Complete all levels to view question-wise analysis"
              className="flex-1 py-3 px-4 bg-slate-800 text-slate-500 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed"
            >
              <SafeIcon icon={FiArrowRight} className="w-4 h-4" /> Question-wise Analysis
            </button>
            <button
              disabled
              title="Complete all levels to download the PDF report"
              className="py-3 px-6 bg-slate-800 text-slate-500 border border-slate-700 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-not-allowed"
            >
              <SafeIcon icon={FiDownload} className="w-4 h-4" /> Download PDF
            </button>
          </>
        )}
      </div>
    </motion.div>
  );

  const renderIndividualCard = (sub, idx) => {
    const stats = getTestAttemptStats(sub);

    return (
      <motion.div
        key={sub.id}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        className="bg-[#131b2e] dark:bg-[#131b2e] rounded-2xl p-6 border-2 border-blue-500/60 shadow-xl text-white mb-2"
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-4 rounded-2xl border bg-blue-600/20 text-blue-400 border-blue-500/30">
              <SafeIcon icon={FiFileText} className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h3 className="font-black text-xl text-white leading-tight">
                  {stats.courseName}
                </h3>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-800 text-blue-300 border border-slate-700">
                  {sub.level || 'Practice'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-400">
                <span className="flex items-center gap-2">
                  <SafeIcon icon={FiClock} className="w-4 h-4 text-blue-400" />
                  {stats.testDate.toLocaleDateString()} at {stats.testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="flex items-center gap-2">
                  <SafeIcon icon={FiTrendingUp} className="w-4 h-4 text-blue-400" />
                  Accuracy: {stats.accuracy}%
                </span>
              </div>
            </div>
          </div>

          {/* Score Header Display - matches the combined card's header exactly */}
          <div className="text-left lg:text-right flex-shrink-0">
            <p className="text-[10px] text-blue-300 font-black uppercase tracking-widest mb-1">{stats.scoreLabel}</p>
            <p className="text-3xl font-black text-white tracking-tight">
              {stats.displayScore}
            </p>
            <p className="text-[10px] font-bold text-blue-400 mt-1 uppercase">
              {stats.performanceLevel}
            </p>
          </div>
        </div>

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0a0e20] rounded-xl border border-slate-800 mb-6 text-center">
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Test ID</p>
            <p className="text-lg font-black text-white">#{sub.id}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Questions</p>
            <p className="text-lg font-black text-white">{stats.totalQuestions || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Performance</p>
            <p className="text-lg font-black text-white">{stats.performanceLevel}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-1">Duration</p>
            <p className="text-lg font-black text-white">{stats.durationText}</p>
          </div>
        </div>

        {/* Action Buttons - identical structure/classes to the combined card */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(`${basePath}/report/${sub.id}`)}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <SafeIcon icon={FiFileText} className="w-4 h-4" /> View Report
          </button>
          <button
            onClick={() => navigate(`${basePath}/detailed-review/${sub.id}`)}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <SafeIcon icon={FiArrowRight} className="w-4 h-4" /> Question-wise Analysis
          </button>
          <button
            onClick={() => navigate(`${basePath}/report/${sub.id}?download=true`)}
            className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl font-black flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            <SafeIcon icon={FiDownload} className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </motion.div>
    );
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Loading history...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl transition-colors text-gray-600 dark:text-gray-400"
            title="Go Back"
          >
            <SafeIcon icon={FiIcons.FiChevronLeft} className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <SafeIcon icon={FiActivity} className="text-blue-600" />
              </div>
              Test History & Review
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Analyze your past performance and learn from your mistakes.</p>
          </div>
        </div>
      </div>

      {submissions.length > 0 && (
        <>
          {/* Primary Category Filter Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
            {PRIMARY_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(activeCategory === cat.id ? 'All' : cat.id);
                  setActiveSubcategory('All');
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
                  <SafeIcon icon={FiIcons[cat.icon]} className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0">
                  <h3 className={`font-bold text-xs sm:text-sm truncate tracking-tight ${activeCategory === cat.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{cat.title}</h3>
                  <p className={`text-[10px] truncate ${activeCategory === cat.id ? 'text-purple-200/80' : 'text-slate-400'}`}>{cat.subtitle}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Subcategory Pills & View Toggle */}
          <div className="flex flex-col xl:flex-row justify-between items-start gap-4 mb-8 w-full">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
              <button
                onClick={() => setActiveSubcategory('All')}
                className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center justify-center cursor-pointer whitespace-nowrap ${
                  activeSubcategory === 'All'
                    ? 'bg-[#7C3AED] border-[#7C3AED] text-white shadow-[0_0_15px_rgba(124,58,237,0.35)]'
                    : 'bg-[#131726] border-[#262D42] text-slate-300 hover:border-purple-500/40 hover:bg-[#1A2035] hover:text-white'
                }`}
              >
                All
              </button>
              {subcategoryOptions.map(sub => (
                <button
                  key={sub}
                  onClick={() => setActiveSubcategory(sub)}
                  className={`px-4 h-9 rounded-full text-xs font-bold transition-all border flex items-center gap-2 justify-center cursor-pointer whitespace-nowrap ${
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

            <div className="flex gap-1.5 bg-[#11131A] p-1 rounded-lg border border-[#1C202B] h-10 items-center shrink-0">
              <button
                title="Grid View"
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
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
                className={`w-8 h-8 rounded-md flex items-center justify-center transition-all ${
                  viewMode === 'list'
                    ? 'bg-[#181033] border border-[#7C3AED] text-[#c4b5fd]'
                    : 'bg-transparent text-gray-400 hover:text-white'
                }`}
              >
                <SafeIcon icon={FiIcons.FiList} className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {submissions.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <SafeIcon icon={FiAward} className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Test Data Found</h3>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">Take a practice quiz to see your detailed breakdown here.</p>
          <button
            onClick={() => navigate('/student/practice-tests')}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold cursor-pointer"
          >
            Start Practice
          </button>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-20 bg-[#11131A] rounded-3xl border-2 border-dashed border-[#1C202B]">
          <SafeIcon icon={FiAward} className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white">No tests in this category yet</h3>
          <p className="text-gray-400 mt-2 max-w-sm mx-auto">Try a different category or clear the filter to see all your test history.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>

          {/* Latest-attempt-first: combined SAT topic cards and individual attempt cards
              (ACT/AP/Full-Length, plus each level's own attempt) are rendered from one unified,
              date-sorted list so a newly completed attempt of any kind always lands at the top -
              never a fixed "combined cards first, then individual cards" block. */}
          {displayItems.map((item, idx) => (
            item.type === 'combined'
              ? renderCombinedCard(item.data)
              : renderIndividualCard(item.data, idx)
          ))}
        </div>
      )}
    </div>
  );
};

export default TestReview;