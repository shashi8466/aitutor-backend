import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CircularProgress from '../../components/common/CircularProgress';
import Skeleton from '../../components/common/Skeleton';
import DashboardNotifications from '../../components/common/DashboardNotifications';

// Services
import { courseService, enrollmentService, progressService, planService, gradingService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateStudentScore, getCategory, calculateSessionScore, calculateSatScore } from '../../utils/scoreCalculator';

const {
  FiBook, FiCheckSquare, FiFileText, FiActivity, FiArrowLeft, FiPlay, FiAward, FiAlertCircle, FiLoader
} = FiIcons;

const StudentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Progressive loading states - show data as it arrives
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  
  const [rawData, setRawData] = useState({
    enrollments: [],
    progress: [],
    plan: null,
    submissions: []
  });

  // Load Data
  useEffect(() => {
    if (user && !authLoading) {
      loadAllData().catch(err => {
        console.error('💥 Dashboard initialization error:', err);
        setError(err.message || 'Failed to load dashboard');
        setLoading(false);
      });
    }
  }, [user, authLoading]);

  const loadAllData = async () => {
    if (!user?.id) {
      console.warn('⚠️ No user ID available for dashboard loading, waiting for auth...');
      setLoading(false);
      return;
    }

    // CRITICAL: We don't want the WHOLE PAGE to stay in a loading state.
    // We already have individual loaded states for each section.
    // We'll set the global loading to false almost immediately after starting the parallel fetches.
    
    try {
      console.log('📊 Starting parallel dashboard data load for:', user.id);
      
      // Create abort controllers for timeout handling
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⏰ Dashboard load timeout - some data may be incomplete');
        abortController.abort();
        // Force all loaders to complete even if data didn't arrive
        setEnrollmentsLoaded(true);
        setProgressLoaded(true);
        setPlanLoaded(true);
        setSubmissionsLoaded(true);
        setLoading(false);
      }, 20000); // 20 second timeout for entire dashboard load
      
      // Load each dataset independently with individual timeouts
      
      // 1. Enrollments
      enrollmentService.getStudentEnrollments(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, enrollments: res.data || [] }));
          setEnrollmentsLoaded(true);
        })
        .catch(err => {
          console.error('Enrollments fetch error:', err.message);
          setEnrollmentsLoaded(true); // Mark as loaded to unblock UI
        });
      
      // 2. Progress
      progressService.getAllUserProgress(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, progress: res.data || [] }));
          setProgressLoaded(true);
        })
        .catch(err => {
          console.error('Progress fetch error:', err.message);
          setProgressLoaded(true); // Mark as loaded to unblock UI
        });
      
      // 3. Plan
      planService.getPlan(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, plan: res.data || null }));
          setPlanLoaded(true);
        })
        .catch(err => {
          console.error('Plan fetch error:', err.message);
          setPlanLoaded(true); // Mark as loaded to unblock UI
        });
      
      // 4. Submissions
      console.log(`📡 [Dashboard] Fetching scores for user: ${user.id}`);
      gradingService.getAllMyScores(user.id)
        .then(res => {
          const subs = res.data?.submissions || [];
          console.log(`✅ [Dashboard] Received ${subs.length} submissions for ${user.id}`);
          setRawData(prev => ({ ...prev, submissions: subs }));
          setSubmissionsLoaded(true);
        })
        .catch(err => {
          console.error('Scores fetch error:', err.message);
          setSubmissionsLoaded(true); // Mark as loaded to unblock UI
        });

      // Clear the global "Loading your dashboard..." overlay quickly
      // so the user can see the skeleton/partial content.
      setTimeout(() => setLoading(false), 300);

      // Cleanup timeout on success
      return () => {
        clearTimeout(timeoutId);
        abortController.abort();
      };

    } catch (error) {
      console.error("Dashboard Load Error:", error);
      setError(error.message || 'Failed to load dashboard');
      setLoading(false);
    }
  };

  // Memoized derived data - now uses progressive loading
  const dashboardData = React.useMemo(() => {
    console.log('🔍 [DEBUG] rawData changed:', rawData);
    console.log('🔍 [DEBUG] loading states:', { enrollmentsLoaded, progressLoaded, planLoaded, submissionsLoaded });
    
    try {
      const { enrollments, progress, plan, submissions } = rawData;
      
      console.log('🔍 [DEBUG] Starting data processing...', {
        enrollmentsCount: enrollments?.length,
        progressCount: progress?.length,
        hasPlan: !!plan,
        submissionsCount: submissions?.length
      });
      
      const planData = plan?.generated_plan || null;
      const diagnosticData = plan?.diagnostic_data || null;

      const passedLevels = progress.filter(p => p.passed).length;
      const lessonsCount = Math.min(50, passedLevels * 3 + 5);
      const testsTaken = submissions.length;

      const enrollmentProgress = enrollments.map(e => {
        const courseId = e.course_id;
        // Supabase may return bigint IDs as strings in some contexts; normalize comparisons.
        const courseSubmissions = submissions.filter(s => Number(s.course_id) === Number(courseId));
        const courseProgress = progress.filter(p => Number(p.course_id) === Number(courseId));
        const courseCategory = getCategory(e);

        // Find the LATEST test submission for this course
        let latestSubmission = null;
        let latestTestDate = 0;
        
        courseSubmissions.forEach(sub => {
          const testDate = new Date(sub.test_date || sub.created_at || 0).getTime();
          if (testDate > latestTestDate) {
            latestTestDate = testDate;
            latestSubmission = sub;
          }
        });

        // AGGREGATE BEST SCORES PER LEVEL ACROSS BOTH SUBMISSIONS AND PROGRESS (Sync with weighted SAT logic)
        const levelScores = { Easy: 0, Medium: 0, Hard: 0 };
        
        // A. From progress table (lessons)
        courseProgress.forEach(p => {
          const lvl = p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase() : 'Medium';
          if (['Easy', 'Medium', 'Hard'].includes(lvl) && typeof p.score === 'number') {
            if (p.score > levelScores[lvl]) levelScores[lvl] = p.score;
          }
        });

        // B. From test submissions
        courseSubmissions.forEach(sub => {
          const lvlRaw = sub.level || 'Medium';
          const lvl = lvlRaw.charAt(0).toUpperCase() + lvlRaw.slice(1).toLowerCase();
          if (['Easy', 'Medium', 'Hard'].includes(lvl)) {
            const rawPct = Math.round(sub.raw_score_percentage || 0);
            if (rawPct > levelScores[lvl]) levelScores[lvl] = rawPct;
          }
        });

        // FINAL Weighted Calculation (Sync with overall SAT display)
        let courseScaledScore = calculateSatScore(
          levelScores.Easy,
          levelScores.Medium,
          levelScores.Hard
        );

        // Fallback: If no activity yet, show 0 by default
        if (courseScaledScore === 0) {
          courseScaledScore = 0;
        }

        return {
          ...e.courses,
          levelScores,
          courseScaledScore,
          latestSubmission,
          isEstimated: courseSubmissions.length === 0
        };
      });

      // Overall SAT scores – centralized logic shared with parent dashboard.
      const overallScores = calculateStudentScore(progress, diagnosticData, submissions);

      return {
        scores: {
          total: overallScores.current,
          math: overallScores.math,
          rw: overallScores.rw,
          // For now, "Latest Attempt" == weighted SAT-style scores
          latestMath: overallScores.latestMath || overallScores.math,
          latestRw: overallScores.latestRW || overallScores.rw,
          target: overallScores.target,
          totalImprovement: overallScores.totalImprovement
        },
        counts: {
          lessons: lessonsCount,
          tests: testsTaken,
          worksheets: 14,
          sessions: Math.floor(lessonsCount / 2)
        },
        maxCounts: { lessons: 50, tests: 20, worksheets: 30, sessions: 24 },
        enrollments: enrollmentProgress.filter(e => !e.is_practice)
      };
    } catch (err) {
      console.error('StudentDashboard derived-data error:', err);
      // Safe fallback so UI doesn't go blank.
      return {
        scores: {
          total: 0,
          math: 0,
          rw: 0,
          latestMath: 0,
          latestRw: 0,
          target: 1500,
          totalImprovement: 0
        },
        counts: { lessons: 0, tests: 0, worksheets: 14, sessions: 0 },
        maxCounts: { lessons: 50, tests: 20, worksheets: 30, sessions: 24 },
        enrollments: []
      };
    }
  }, [rawData]);

  const { scores, counts, maxCounts, enrollments } = dashboardData;
  const progressPercent = Math.min(100, Math.round((scores.total / scores.target) * 100));

  // Show loading state ONLY during auth transition or initial page load
  // Once user is authenticated, show dashboard with progressive data loading
  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <SafeIcon icon={FiLoader} className="w-12 h-12 animate-spin text-sky-500" />
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error boundary - show error details
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-orange-200 dark:border-orange-900 max-w-lg w-full">
          <h1 className="text-2xl font-bold text-orange-600 mb-4">Dashboard Error</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">Failed to load student dashboard:</p>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs font-mono mb-4 text-orange-500 overflow-auto max-h-48">
            {error}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex-1 bg-sky-600 text-white py-2 rounded-lg hover:bg-sky-700 transition-colors"
            >
              Reload Page
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error boundary fallback - no user after loading
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please log in to access your dashboard.</p>
          <button 
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-[#E53935] text-white rounded-lg hover:bg-[#d32f2f] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 font-sans text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto py-8">
        
        {/* Loading Indicator - Shows when data is still fetching */}
        {loading && (
          <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 flex items-center gap-3 animate-pulse">
            <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin text-sky-600" />
            <p className="text-sm text-sky-800 dark:text-sky-300 font-medium">Loading your latest data...</p>
          </div>
        )}

        {/* 1. Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
              Welcome back, {user?.name ? user.name.split(' ')[0] : 'Student'}!
            </h1>
            <p className="text-slate-500 mt-1">Here is your daily progress overview.</p>
          </div>
        </div>

        {/* Dashboard Notifications */}
        <DashboardNotifications limit={3} />

        {/* 🕵️ ADMIN PREVIEW DEBUG OVERLAY */}
        {user?.isPreview && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🕵️</span>
              <h4 className="text-amber-800 dark:text-amber-400 font-bold">Admin Preview Debug Mode</h4>
              <span className="text-[10px] px-2 py-0.5 bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-full font-bold uppercase tracking-wider border border-amber-300 dark:border-amber-800">
                Data Authenticated & Synced
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                <span className="text-amber-600 dark:text-amber-500 block mb-1 font-bold uppercase text-[9px]">Target User Account</span>
                <span className="break-all font-bold text-slate-700 dark:text-slate-300">{user.id}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                <span className="text-amber-600 dark:text-amber-500 block mb-1 font-bold uppercase text-[9px]">Quiz Submissions</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{rawData.submissions?.length || 0}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                <span className="text-amber-600 dark:text-amber-500 block mb-1 font-bold uppercase text-[9px]">Academic Progress Rows</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{rawData.progress?.length || 0}</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                <span className="text-amber-600 dark:text-amber-500 block mb-1 font-bold uppercase text-[9px]">Data Source Status</span>
                <span className="text-lg font-black text-green-600 dark:text-green-400">{rawData.plan ? 'LIVE SYNC' : 'CHECKING...'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-sky-200 dark:shadow-sky-900/30">
              {user.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user.name || 'Student Name'}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="truncate max-w-[200px]">{user.email}</span>
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase rounded-md tracking-wider">Active Student</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-4 w-full md:w-auto">
            <Badge label="Class" value="SAT Prep" color="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-100 dark:border-sky-800" />
            <Badge label="Current Score" value={`${scores.total}/1600`} color="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800" />
            <div className="col-span-2 md:col-auto">
              <Badge label="Target Score" value={`${scores.target}/1600`} color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800" />
            </div>
          </div>
        </div>

        {/* 3. Main Dashboard Content */}
        <div className="space-y-6">

          {/* Top Row: Score & Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Score Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Score Performance</h3>
                <button
                  onClick={() => navigate('/student/test-review')}
                  className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-700 transition-colors"
                >
                  Review Tests
                </button>
              </div>

              {loading || !submissionsLoaded ? (
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
                      color="#0ea5e9"
                    />
                    <div className="mt-4 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Score</p>
                      <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{scores.total}</p>
                      <p className="text-xs text-green-500 font-bold">+{scores.totalImprovement} pts gained</p>
                    </div>
                  </div>

                  {/* Bars Breakdown */}
                  <div className="flex-1 w-full space-y-6">
                    {/* Section Scores */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Section Scores</p>
                        <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 rounded flex items-center gap-1">
                          <span className="w-1 h-1 bg-sky-500 rounded-full animate-pulse"></span>
                          Latest Attempt
                        </span>
                      </div>
                      <div className="space-y-6">
                        {/* Math */}
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1.5 px-0.5">
                            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <SafeIcon icon={FiAward} className="w-3.5 h-3.5 text-sky-500" />
                              SAT Math
                            </span>
                            <span className="text-slate-900 dark:text-white !font-black">{scores.latestMath}/800</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(2, (scores.latestMath / 800) * 100))}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full shadow-sm"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-300 dark:text-slate-600 font-bold mt-1 px-1 tracking-tighter">
                            <span>0</span><span>400</span><span>800</span>
                          </div>
                        </div>
                        {/* RW */}
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-1.5 px-0.5">
                            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <SafeIcon icon={FiAward} className="w-3.5 h-3.5 text-green-500" />
                              Reading & Writing
                            </span>
                            <span className="text-slate-900 dark:text-white !font-black">{scores.latestRw}/800</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, Math.max(2, (scores.latestRw / 800) * 100))}%` }}
                              transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
                              className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full shadow-sm"
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-300 dark:text-slate-600 font-bold mt-1 px-1 tracking-tighter">
                            <span>0</span><span>400</span><span>800</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target Progress */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Goal Progress</p>
                          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{scores.target}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{scores.total}/{scores.target}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          className="h-full bg-orange-500 rounded-full"
                        />
                      </div>
                      <p className="text-right text-[10px] text-slate-400 dark:text-slate-500 mt-1">{Math.max(0, scores.target - scores.total)} points to goal</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Course Activity Stats */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Learning Activity</h3>
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {(!progressLoaded || !submissionsLoaded) ? (
                  Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : (
                  <>
                    <ProgressRow
                      icon={FiBook} color="text-sky-500" bg="bg-sky-500"
                      label="Lessons Completed" count={counts.lessons} max={maxCounts.lessons}
                    />
                    <ProgressRow
                      icon={FiCheckSquare} color="text-orange-500" bg="bg-orange-500"
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">Continue Learning</h3>
              <button onClick={() => navigate('/student/courses')} className="text-sky-600 text-sm font-bold hover:underline">View All Courses</button>
            </div>

            {(!enrollmentsLoaded) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
              </div>
            ) : enrollments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrollments.slice(0, 3).map(course => {
                  const maxLevelScore = Math.max(course.levelScores?.Easy || 0, course.levelScores?.Medium || 0, course.levelScores?.Hard || 0);
                  const courseType = (course.tutor_type || '').toLowerCase().includes('math') ? 'MATH' : 'RW';
                  return (
                    <div key={course.id} className="dashboard-card p-5 hover:shadow-xl hover:border-sky-500/30 transition-all group flex flex-col h-full bg-white dark:bg-slate-900/60">
                       {/* Header */}
                       <div className="flex items-start justify-between mb-4">
                         <div className="flex items-center gap-3">
                           <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${courseType === 'MATH' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 group-hover:bg-sky-600' : 'bg-green-50 dark:bg-green-900/30 text-green-600 group-hover:bg-green-600'} group-hover:text-white shadow-sm`}>
                             <SafeIcon icon={FiBook} className="w-6 h-6" />
                           </div>
                           <div>
                             <h4 className="font-extrabold text-slate-900 dark:text-white leading-tight">{course.name}</h4>
                             <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{courseType === 'MATH' ? 'Quant Section' : 'Verbal Section'}</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block mb-0.5 uppercase">
                             {course.isEstimated ? 'Estimated' : 'Latest'}
                           </span>
                           <span className={`text-lg font-black ${courseType === 'MATH' ? 'text-sky-600 dark:text-sky-400' : 'text-green-600 dark:text-green-400'}`}>
                             {course.courseScaledScore}
                           </span>
                         </div>
                       </div>
 
                       {/* Level Breakdown */}
                       <div className="flex-1 space-y-3 mb-6">
                         <LevelScore label="Easy" score={course.levelScores?.Easy} color={courseType === 'MATH' ? 'bg-sky-400' : 'bg-green-400'} />
                         <LevelScore label="Medium" score={course.levelScores?.Medium} color={courseType === 'MATH' ? 'bg-sky-500' : 'bg-green-500'} />
                         <LevelScore label="Hard" score={course.levelScores?.Hard} color={courseType === 'MATH' ? 'bg-sky-600' : 'bg-green-600'} />
                       </div>
 
                       {/* Footer */}
                       <div className="mt-auto pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                           <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Resume Study</span>
                         </div>
                         <button
                           onClick={() => navigate(`/student/course/${course.id}`)}
                           className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${courseType === 'MATH' ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 hover:bg-sky-600' : 'bg-green-50 dark:bg-green-900/30 text-green-600 hover:bg-green-600'} hover:text-white shadow-sm`}
                         >
                           <SafeIcon icon={FiPlay} className="w-3.5 h-3.5 ml-0.5" />
                         </button>
                       </div>
                     </div>
                  );
                })}
              </div>
            ) : (
               <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                 <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-slate-700">
                   <SafeIcon icon={FiBook} className="w-8 h-8 text-slate-400" />
                 </div>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">You haven't enrolled in any courses yet.</p>
                 <button onClick={() => navigate('/student/courses')} className="mt-4 px-6 py-2 bg-sky-600 text-white rounded-lg font-bold hover:bg-sky-700 transition-all shadow-lg shadow-sky-600/20">
                   Browse Course Catalog
                 </button>
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
  <div className={`px-4 py-3 rounded-xl border flex flex-col justify-center min-w-[120px] transition-all duration-300 ${color}`}>
    <span className="text-[10px] uppercase font-black opacity-80 mb-0.5 tracking-wider">{label}</span>
    <span className="text-sm font-black">{value}</span>
  </div>
);

const ProgressRow = ({ icon, color, bg, label, count, max }) => {
  const percent = Math.min(100, (count / max) * 100);

  return (
     <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <SafeIcon icon={icon} className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{count}/{max}</span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full rounded-full ${bg} shadow-md`}
        />
      </div>
    </div>
  );
};

const LevelScore = ({ label, score, color }) => (
    <div>
     <div className="flex justify-between items-center mb-1">
       <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{label}</span>
       <span className="text-xs font-black text-slate-900 dark:text-white">{score || 0}%</span>
     </div>
     <div className="h-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner">
       <motion.div
         initial={{ width: 0 }}
         animate={{ width: `${score || 0}%` }}
         className={`h-full rounded-full ${color} shadow-sm`}
       />
     </div>
   </div>
);

export default StudentDashboard;