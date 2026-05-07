import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { gradingService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiActivity, FiClock, FiAward, FiArrowRight, FiFileText, FiTrendingUp } = FiIcons;

const TestReview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadScores();
  }, [user]);

  const loadScores = async () => {
    try {
      setLoading(true);
      const response = await gradingService.getAllMyScores();
      setSubmissions(response.data.submissions || []);
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
      <div className="flex justify-between items-center">
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

      {submissions.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {submissions.map((sub, idx) => {
            const score = sub.scaled_score || Math.round(200 + ((sub.raw_score_percentage || 0) / 100) * 600);
            const testDate = new Date(sub.test_date || sub.created_at);
            const courseName = sub.courses?.name || 'General Test';
            const isSAT = courseName.toLowerCase().includes('sat') || courseName.toLowerCase().includes('full length');

            // Determine performance level
            const getPerformanceLevel = (score) => {
              if (isSAT) {
                if (score >= 1400) return { level: 'Excellent', color: 'green' };
                if (score >= 1200) return { level: 'Good', color: 'blue' };
                if (score >= 1000) return { level: 'Average', color: 'yellow' };
                if (score >= 800) return { level: 'Below Average', color: 'orange' };
                return { level: 'Needs Improvement', color: 'red' };
              } else {
                if (score >= 90) return { level: 'Excellent', color: 'green' };
                if (score >= 80) return { level: 'Good', color: 'blue' };
                if (score >= 70) return { level: 'Average', color: 'yellow' };
                if (score >= 60) return { level: 'Below Average', color: 'orange' };
                return { level: 'Needs Improvement', color: 'red' };
              }
            };

            const performance = getPerformanceLevel(score);

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
                      performance.color === 'green' ? 'bg-green-50 text-green-600' :
                      performance.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                      performance.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' :
                      performance.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <SafeIcon icon={FiFileText} className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white">
                          {courseName}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          performance.color === 'green' ? 'bg-green-100 text-green-700' :
                          performance.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          performance.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          performance.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {performance.level}
                        </span>
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                          sub.level === 'Hard' ? 'bg-red-100 text-red-700' :
                          sub.level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {sub.level || 'Practice'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-2">
                          <SafeIcon icon={FiClock} className="w-4 h-4" />
                          {testDate.toLocaleDateString()} at {testDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-2">
                          <SafeIcon icon={FiTrendingUp} className="w-4 h-4" />
                          Accuracy: {sub.raw_score_percentage || 'N/A'}%
                        </span>
                        {sub.test_duration_seconds && (
                          <span className="flex items-center gap-2">
                            <SafeIcon icon={FiAward} className="w-4 h-4" />
                            {Math.floor(sub.test_duration_seconds / 60)} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className="flex flex-col items-center lg:flex-row gap-4">
                    <div className="text-center lg:text-right">
                      <p className="text-xs text-gray-400 font-black uppercase mb-1">Score</p>
                      <p className={`text-3xl font-black ${
                        performance.color === 'green' ? 'text-green-600' :
                        performance.color === 'blue' ? 'text-blue-600' :
                        performance.color === 'yellow' ? 'text-yellow-600' :
                        performance.color === 'orange' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {score}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {isSAT ? 'SAT Score' : 'Test Score'}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/student/detailed-review/${sub.id}`)}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                    >
                      <SafeIcon icon={FiArrowRight} />
                      Detailed Review
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Performance</p>
                    <p className={`text-sm font-bold ${
                      performance.color === 'green' ? 'text-green-600' :
                      performance.color === 'blue' ? 'text-blue-600' :
                      performance.color === 'yellow' ? 'text-yellow-600' :
                      performance.color === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {performance.level}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Test ID</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">#{sub.id}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Questions</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {sub.total_questions || sub.question_count || 'N/A'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-black uppercase">Duration</p>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                      {sub.test_duration_seconds ? Math.floor(sub.test_duration_seconds / 60) + ' min' : 'N/A'}
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
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold"
          >
            Go to Practice Tests
          </button>
        </div>
      )}
    </div>
  );
};

export default TestReview;