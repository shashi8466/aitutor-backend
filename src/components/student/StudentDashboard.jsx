import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CircularProgress from '../../components/common/CircularProgress';
import Skeleton from '../../components/common/Skeleton';

// Services
import { courseService, enrollmentService, progressService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateStudentScore, calculateSessionScore } from '../../utils/scoreCalculator';

const {
  FiBook, FiCheckSquare, FiFileText, FiActivity, FiArrowLeft, FiPlay
} = FiIcons;

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    scores: { total: 0, math: 0, rw: 0, target: 1500 },
    counts: { lessons: 0, tests: 0, worksheets: 0, sessions: 0 },
    maxCounts: { lessons: 50, tests: 20, worksheets: 30, sessions: 24 }, // Baselines
    enrollments: [],
    plan: null
  });

  // Load Data
  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [enrollmentsRes, progressRes, planRes] = await Promise.all([
        enrollmentService.getStudentEnrollments(user.id),
        progressService.getAllUserProgress(user.id),
        planService.getPlan(user.id)
      ]);

      const planData = planRes.data?.generated_plan || null;
      const diagnosticData = planRes.data?.diagnostic_data || null;
      const progress = progressRes.data || [];
      const calculatedScores = calculateStudentScore(progress, diagnosticData);
      const passedLevels = progress.filter(p => p.passed).length;
      const lessonsCount = Math.min(50, passedLevels * 3 + 5);
      const testsTaken = progress.length;
      const enrollments = enrollmentsRes.data || [];

      // Organize scores by level for each enrollment
      const enrollmentProgress = enrollments.map(e => {
        const courseProgress = progress.filter(p => p.course_id === e.course_id);
        const levelScores = { Easy: 0, Medium: 0, Hard: 0 };
        const levelScaled = { Easy: 0, Medium: 0, Hard: 0 };

        const type = (e.courses?.tutor_type || '').toLowerCase();
        const name = (e.courses?.name || '').toLowerCase();
        const category = (type.includes('math') || type.includes('quant') || name.includes('math') || name.includes('algebra')) ? 'MATH' : 'RW';

        courseProgress.forEach(p => {
          const lvl = p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase();
          if (p.score > levelScores[lvl]) {
            levelScores[lvl] = p.score;
            levelScaled[lvl] = calculateSessionScore(category, lvl, p.score);
          }
        });

        const bestScaled = Math.max(levelScaled.Easy, levelScaled.Medium, levelScaled.Hard, 200);

        return {
          ...e.courses,
          levelScores,
          levelScaled,
          courseScaledScore: bestScaled
        };
      });

      setDashboardData({
        scores: {
          total: calculatedScores.current,
          math: calculatedScores.math,
          rw: calculatedScores.rw,
          target: calculatedScores.target
        },
        counts: {
          lessons: lessonsCount,
          tests: testsTaken,
          worksheets: 14,
          sessions: Math.floor(lessonsCount / 2)
        },
        maxCounts: { lessons: 50, tests: 20, worksheets: 30, sessions: 24 },
        enrollments: enrollmentProgress.filter(e => !e.is_practice),
        progress: progress,
        plan: planData
      });
    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const { scores, counts, maxCounts, enrollments } = dashboardData;
  const progressPercent = Math.min(100, Math.round((scores.total / scores.target) * 100));

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-12 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* 1. Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Welcome back, {user.name?.split(' ')[0] || 'Student'}!
            </h1>
            <p className="text-gray-500 mt-1">Here is your daily progress overview.</p>
          </div>
        </div>

        {/* 2. Profile Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-200">
              {user.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name || 'Student Name'}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="truncate max-w-[200px]">{user.email}</span>
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-md tracking-wider">Active Student</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto justify-start md:justify-end">
            <Badge label="Class" value="SAT Prep" color="bg-blue-50 text-blue-700 border-blue-100" />
            <Badge label="Current Score" value={`${scores.total}/1600`} color="bg-purple-50 text-purple-700 border-purple-100" />
            <Badge label="Target Score" value={`${scores.target}/1600`} color="bg-green-50 text-green-700 border-green-100" />
          </div>
        </div>

        {/* 3. Main Dashboard Content */}
        <div className="space-y-6">

          {/* Top Row: Score & Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Score Summary Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-800">Score Performance</h3>
                <button
                  onClick={() => navigate('/student/test-review')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Review Tests
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col md:flex-row items-center gap-8 animate-pulse">
                  <Skeleton className="w-[140px] h-[140px]" variant="circle" />
                  <div className="flex-1 w-full space-y-6">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Circular Progress */}
                  <div className="flex flex-col items-center">
                    <CircularProgress
                      value={scores.total}
                      max={1600}
                      size={140}
                      strokeWidth={12}
                      color="#3B82F6"
                    />
                    <div className="mt-4 text-center">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Current Score</p>
                      <p className="text-2xl font-extrabold text-gray-900">{scores.total}</p>
                      <p className="text-xs text-green-500 font-bold">+{(scores.total - 800) > 0 ? scores.total - 800 : 0} pts gained</p>
                    </div>
                  </div>

                  {/* Bars Breakdown */}
                  <div className="flex-1 w-full space-y-6">
                    {/* Section Scores */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase mb-3">Section Scores</p>
                      <div className="space-y-4">
                        {/* Math */}
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1">
                            <span className="text-gray-700">SAT Math</span>
                            <span className="text-gray-900">{scores.math}/800</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(scores.math / 800) * 100}%` }}
                              className="h-full bg-blue-500 rounded-full"
                            />
                          </div>
                        </div>
                        {/* RW */}
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1">
                            <span className="text-gray-700">Reading & Writing</span>
                            <span className="text-gray-900">{scores.rw}/800</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(scores.rw / 800) * 100}%` }}
                              className="h-full bg-green-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target Progress */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase">Goal Progress</p>
                          <p className="text-2xl font-bold text-purple-600">{scores.target}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-500">{scores.total}/{scores.target}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          className="h-full bg-purple-500 rounded-full"
                        />
                      </div>
                      <p className="text-right text-[10px] text-gray-400 mt-1">{Math.max(0, scores.target - scores.total)} points to goal</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Course Activity Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
              <h3 className="font-bold text-lg text-gray-800 mb-6">Learning Activity</h3>
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {loading ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : (
                  <>
                    <ProgressRow
                      icon={FiBook} color="text-blue-500" bg="bg-blue-500"
                      label="Lessons Completed" count={counts.lessons} max={maxCounts.lessons}
                    />
                    <ProgressRow
                      icon={FiCheckSquare} color="text-purple-500" bg="bg-purple-500"
                      label="Quizzes Taken" count={counts.tests} max={maxCounts.tests}
                    />
                    <ProgressRow
                      icon={FiFileText} color="text-yellow-500" bg="bg-yellow-500"
                      label="Worksheets Done" count={counts.worksheets} max={maxCounts.worksheets}
                    />
                    <ProgressRow
                      icon={FiActivity} color="text-orange-500" bg="bg-orange-500"
                      label="Active Sessions" count={counts.sessions} max={maxCounts.sessions}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Active Courses */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-gray-800">Continue Learning</h3>
              <button onClick={() => navigate('/student/courses')} className="text-blue-600 text-sm font-bold hover:underline">View All Courses</button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
            ) : enrollments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrollments.slice(0, 3).map(course => {
                  const maxLevelScore = Math.max(course.levelScores?.Easy || 0, course.levelScores?.Medium || 0, course.levelScores?.Hard || 0);
                  const courseType = (course.tutor_type || '').toLowerCase().includes('math') ? 'MATH' : 'RW';

                  return (
                    <div key={course.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-xl hover:border-blue-100 transition-all group flex flex-col h-full">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${courseType === 'MATH' ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600' : 'bg-green-50 text-green-600 group-hover:bg-green-600'} group-hover:text-white`}>
                            <SafeIcon icon={FiBook} className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-gray-900 leading-tight">{course.name}</h4>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{courseType === 'MATH' ? 'Quant Section' : 'Verbal Section'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-gray-400 block mb-0.5">EST. SCORE</span>
                          <span className={`text-lg font-black ${courseType === 'MATH' ? 'text-blue-600' : 'text-green-600'}`}>
                            {course.courseScaledScore}
                          </span>
                        </div>
                      </div>

                      {/* Level Breakdown */}
                      <div className="flex-1 space-y-3 mb-6">
                        <LevelScore label="Easy" score={course.levelScores?.Easy} color={courseType === 'MATH' ? 'bg-blue-400' : 'bg-green-400'} />
                        <LevelScore label="Medium" score={course.levelScores?.Medium} color={courseType === 'MATH' ? 'bg-blue-500' : 'bg-green-500'} />
                        <LevelScore label="Hard" score={course.levelScores?.Hard} color={courseType === 'MATH' ? 'bg-blue-600' : 'bg-green-600'} />
                      </div>

                      {/* Footer */}
                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-[10px] font-bold text-gray-500 uppercase">Resume Study</span>
                        </div>
                        <button
                          onClick={() => navigate(`/student/course/${course.id}`)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${courseType === 'MATH' ? 'bg-blue-50 text-blue-600 hover:bg-blue-600' : 'bg-green-50 text-green-600 hover:bg-green-600'} hover:text-white`}
                        >
                          <SafeIcon icon={FiPlay} className="w-3.5 h-3.5 ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500 text-sm">You haven't enrolled in any courses yet.</p>
                <button onClick={() => navigate('/student/courses')} className="mt-2 text-blue-600 font-bold text-sm hover:underline">Browse Course Catalog</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const Badge = ({ label, value, color }) => (
  <div className={`px-4 py-3 rounded-xl border flex flex-col justify-center min-w-[120px] ${color}`}>
    <span className="text-[10px] uppercase font-bold opacity-70 mb-0.5">{label}</span>
    <span className="text-sm font-extrabold">{value}</span>
  </div>
);

const ProgressRow = ({ icon, color, bg, label, count, max }) => {
  const percent = Math.min(100, (count / max) * 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <SafeIcon icon={icon} className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-bold text-gray-700">{label}</span>
        </div>
        <span className="text-xs font-bold text-gray-500">{count}/{max}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full rounded-full ${bg}`}
        />
      </div>
    </div>
  );
};

const LevelScore = ({ label, score, color }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-tighter">{label}</span>
      <span className="text-xs font-black text-gray-900">{score || 0}%</span>
    </div>
    <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score || 0}%` }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  </div>
);

export default StudentDashboard;