import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, questionService } from '../../services/api';

const { FiTrendingUp, FiTarget, FiClock, FiAward, FiCalendar, FiBarChart2, FiActivity } = FiIcons;

const ProgressTracker = ({ courseId }) => {
  const [progressData, setProgressData] = useState({
    weeklyProgress: [],
    monthlyStats: {},
    topicPerformance: [],
    studyStreak: 0,
    totalStudyTime: 0,
    averageScores: { Easy: 0, Medium: 0, Hard: 0 },
    completionRates: {},
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week');

  useEffect(() => {
    loadProgressData();
  }, [courseId]);

  const loadProgressData = async () => {
    try {
      // Mock progress data - in real app, fetch from API
      const mockData = {
        weeklyProgress: [
          { day: 'Mon', score: 75, questions: 15, time: 45 },
          { day: 'Tue', score: 82, questions: 20, time: 60 },
          { day: 'Wed', score: 78, questions: 18, time: 55 },
          { day: 'Thu', score: 85, questions: 22, time: 65 },
          { day: 'Fri', score: 90, questions: 25, time: 70 },
          { day: 'Sat', score: 88, questions: 20, time: 60 },
          { day: 'Sun', score: 92, questions: 24, time: 68 }
        ],
        monthlyStats: {
          totalQuestions: 342,
          averageScore: 83,
          studyTime: 28, // hours
          improvement: 12, // percentage
          completedQuizzes: 18
        },
        topicPerformance: [
          { topic: 'Algebra', score: 85, questions: 45, trend: 'up' },
          { topic: 'Geometry', score: 78, questions: 38, trend: 'down' },
          { topic: 'Reading Comprehension', score: 92, questions: 52, trend: 'up' },
          { topic: 'Grammar', score: 88, questions: 41, trend: 'stable' }
        ],
        studyStreak: 7,
        totalStudyTime: 28,
        averageScores: { Easy: 88, Medium: 82, Hard: 76 },
        completionRates: { Easy: 100, Medium: 65, Hard: 30 },
        recentActivity: [
          { type: 'quiz', topic: 'Algebra - Easy', score: 92, time: '2 hours ago' },
          { type: 'practice', topic: 'Geometry - Medium', duration: '45 min', time: '5 hours ago' },
          { type: 'quiz', topic: 'Reading - Hard', score: 78, time: '1 day ago' },
          { type: 'ai_tutor', topic: 'Algebra Concepts', duration: '15 min', time: '1 day ago' }
        ]
      };
      setProgressData(mockData);
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <FiTrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <FiTrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default: return <FiActivity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Study Streak</p>
              <p className="text-2xl font-bold text-orange-600">{progressData.studyStreak} days</p>
            </div>
            <SafeIcon icon={FiAward} className="w-8 h-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Study Time</p>
              <p className="text-2xl font-bold text-blue-600">{progressData.totalStudyTime}h</p>
            </div>
            <SafeIcon icon={FiClock} className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Score</p>
              <p className="text-2xl font-bold text-green-600">{progressData.monthlyStats.averageScore}%</p>
            </div>
            <SafeIcon icon={FiTarget} className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Improvement</p>
              <p className="text-2xl font-bold text-purple-600">+{progressData.monthlyStats.improvement}%</p>
            </div>
            <SafeIcon icon={FiTrendingUp} className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </motion.div>

      {/* Performance Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          <div className="flex space-x-2">
            {['week', 'month'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  timeRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {progressData.weeklyProgress.map((day, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-12 text-sm text-gray-600">{day.day}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">Score: {day.score}%</span>
                  <span className="text-xs text-gray-500">{day.questions} questions</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${day.score}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">{day.time}min</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Topic Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance</h3>
        <div className="space-y-4">
          {progressData.topicPerformance.map((topic, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <SafeIcon icon={FiBarChart2} className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{topic.topic}</h4>
                  <p className="text-sm text-gray-600">{topic.questions} questions</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{topic.score}%</div>
                  <div className="flex items-center space-x-1">
                    {getTrendIcon(topic.trend)}
                    <span className="text-xs text-gray-600">
                      {topic.trend === 'up' ? 'Improving' : topic.trend === 'down' ? 'Needs work' : 'Stable'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <SafeIcon icon={FiCalendar} className="w-5 h-5 mr-2 text-blue-600" />
          Recent Activity
        </h3>
        <div className="space-y-3">
          {progressData.recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'quiz' ? 'bg-green-500' :
                  activity.type === 'practice' ? 'bg-blue-500' :
                  'bg-purple-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {activity.type === 'quiz' ? 'Quiz' :
                     activity.type === 'practice' ? 'Practice' :
                     'AI Tutor'} - {activity.topic}
                  </p>
                  <p className="text-xs text-gray-600">
                    {activity.score ? `Score: ${activity.score}%` : `Duration: ${activity.duration}`}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ProgressTracker;