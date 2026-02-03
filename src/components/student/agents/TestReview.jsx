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
        <div className="grid grid-cols-1 gap-4">
          {submissions.map((sub, idx) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-5 flex-1 w-full">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 flex-shrink-0">
                  <SafeIcon icon={FiFileText} className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {sub.course?.name || 'General Test'}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${sub.level === 'Hard' ? 'bg-red-100 text-red-700' :
                        sub.level === 'Medium' ? 'bg-orange-100 text-orange-700' :
                          'bg-green-100 text-green-700'
                      }`}>
                      {sub.level || 'Practice'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1">
                      <SafeIcon icon={FiClock} className="w-3 h-3" />
                      {new Date(sub.test_date).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <SafeIcon icon={FiTrendingUp} className="w-3 h-3" />
                      Accuracy: {sub.raw_score_percentage}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 font-black uppercase">Score</p>
                  <p className="text-2xl font-black text-blue-600">{sub.scaled_score || 0}</p>
                </div>
                <button
                  onClick={() => navigate(`/student/detailed-review/${sub.id}`)}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  Review Details <SafeIcon icon={FiArrowRight} />
                </button>
              </div>
            </motion.div>
          ))}
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