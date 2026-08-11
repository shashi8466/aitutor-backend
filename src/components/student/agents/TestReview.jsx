import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { gradingService, tutorService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiActivity, FiClock, FiAward, FiArrowRight, FiFileText, FiTrendingUp, FiDownload, FiCheckCircle, FiXCircle } = FiIcons;

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
    ? (durationSec < 60 ? `${durationSec} sec` : `${Math.floor(durationSec / 60)} min`)
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

      {submissions.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {submissions.map((sub, idx) => {
            const stats = getTestAttemptStats(sub);

            return (
              <motion.div
                key={sub.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all"
              >
                {/* Header */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-4 rounded-2xl flex-shrink-0 ${
                      stats.performanceColor === 'green' ? 'bg-green-50 text-green-600' :
                      stats.performanceColor === 'blue' ? 'bg-blue-50 text-blue-600' :
                      stats.performanceColor === 'yellow' ? 'bg-yellow-50 text-yellow-600' :
                      stats.performanceColor === 'orange' ? 'bg-orange-50 text-orange-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <SafeIcon icon={FiFileText} className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white leading-tight">
                          {stats.courseName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap ${
                            stats.performanceColor === 'green' ? 'bg-green-100 text-green-700' :
                            stats.performanceColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                            stats.performanceColor === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                            stats.performanceColor === 'orange' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {stats.performanceLevel}
                          </span>
                          <span className={`px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
                            sub.level === 'Hard' ? 'bg-red-100 text-red-700' :
                            sub.level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {sub.level || 'Practice'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-2">
                          <SafeIcon icon={FiClock} className="w-4 h-4" />
                          {stats.testDate.toLocaleDateString()} at {stats.testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-2">
                          <SafeIcon icon={FiTrendingUp} className="w-4 h-4" />
                          Accuracy: {stats.accuracy}%
                        </span>
                        <span className="flex items-center gap-2">
                          <SafeIcon icon={FiAward} className="w-4 h-4" />
                          {stats.durationText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className="flex flex-col items-center lg:flex-row gap-4 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-gray-700">
                    <div className="text-center lg:text-right flex-1 lg:flex-none">
                      <p className="text-[10px] text-gray-400 font-black uppercase mb-1 tracking-widest">Score</p>
                      <p className={`text-2xl sm:text-3xl font-black ${
                        stats.performanceColor === 'green' ? 'text-green-600' :
                        stats.performanceColor === 'blue' ? 'text-blue-600' :
                        stats.performanceColor === 'yellow' ? 'text-yellow-600' :
                        stats.performanceColor === 'orange' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {stats.displayScore}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1 font-bold">
                        {stats.scoreLabel}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-4 lg:mt-0 w-full lg:w-auto">
                      <button
                        onClick={() => navigate(`${basePath}/report/${sub.id}`)}
                        className="flex-1 lg:flex-none px-4 py-2.5 sm:px-6 sm:py-3 bg-white hover:bg-gray-50 text-blue-600 border-2 border-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm sm:text-base cursor-pointer"
                      >
                        <SafeIcon icon={FiFileText} />
                        View Report
                      </button>
                      <button
                        onClick={() => navigate(`${basePath}/detailed-review/${sub.id}`)}
                        className="flex-1 lg:flex-none px-4 py-2.5 sm:px-6 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none text-sm sm:text-base cursor-pointer"
                      >
                        <SafeIcon icon={FiArrowRight} />
                        Question-wise Analysis
                      </button>
                      <button
                        onClick={() => navigate(`${basePath}/report/${sub.id}?download=true`)}
                        className="flex-1 lg:flex-none px-4 py-2.5 sm:px-6 sm:py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm sm:text-base cursor-pointer"
                        title="Download PDF"
                      >
                        <SafeIcon icon={FiDownload} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Performance</p>
                    <p className={`text-sm font-bold ${
                      stats.performanceColor === 'green' ? 'text-green-600' :
                      stats.performanceColor === 'blue' ? 'text-blue-600' :
                      stats.performanceColor === 'yellow' ? 'text-yellow-600' :
                      stats.performanceColor === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {stats.performanceLevel}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Test ID</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">#{sub.id}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Questions</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {stats.totalQuestions || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Duration</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {stats.durationText}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default TestReview;