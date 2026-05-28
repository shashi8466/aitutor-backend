import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CircularProgress from '../../components/common/CircularProgress';
import Skeleton from '../../components/common/Skeleton';
import DashboardNotifications from '../../components/common/DashboardNotifications';

// Services
import { enrollmentService, progressService, planService, gradingService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateStudentScore, getCategory, calculateSatScore } from '../../utils/scoreCalculator';

// Icons
const {
  FiBook, FiCheckSquare, FiFileText, FiActivity, FiAward, FiAlertCircle, FiLoader, FiPlay
} = FiIcons;

// --- Sub-Components ---

function Badge({ label, value, color }) {
  return (
    <div className={"px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border flex flex-col justify-center min-w-0 flex-1 sm:min-w-[120px] transition-all duration-300 shadow-sm " + color}>
      <span className="text-[8px] sm:text-[10px] uppercase font-black opacity-80 mb-0.5 tracking-[0.1em] whitespace-nowrap">{label}</span>
      <span className="text-xs sm:text-base font-black truncate">{value}</span>
    </div>
  );
}

function ProgressRow({ icon, color, bg, label, count, max }) {
  const percent = Math.round(Math.min(100, (count / max) * 100));
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <SafeIcon icon={icon} className={"w-4 h-4 " + color} />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
        </div>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{count}/{max}</span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: percent + "%" }}
          className={"h-full rounded-full shadow-md " + bg}
        />
      </div>
    </div>
  );
}

function LevelScore({ label, score, color }) {
  const displayScore = score || 0;
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] sm:text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md truncate max-w-[50px]">{Math.round(displayScore)}%</span>
      </div>
      <div className="h-2 sm:h-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner p-0.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: displayScore + "%" }}
          className={"h-full rounded-full shadow-sm " + color}
        />
      </div>
    </div>
  );
}

const StudentDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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

  useEffect(() => {
    if (user && !authLoading) {
      loadAllData().catch(err => {
        console.error('💥 Dashboard error:', err);
        setError(err.message || 'Failed to load dashboard');
        setLoading(false);
      });
    }
  }, [user, authLoading]);

  const loadAllData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
        setEnrollmentsLoaded(true);
        setProgressLoaded(true);
        setPlanLoaded(true);
        setSubmissionsLoaded(true);
        setLoading(false);
      }, 20000);
      
      enrollmentService.getStudentEnrollments(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, enrollments: res.data || [] }));
          setEnrollmentsLoaded(true);
        })
        .catch(() => setEnrollmentsLoaded(true));
      
      progressService.getAllUserProgress(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, progress: res.data || [] }));
          setProgressLoaded(true);
        })
        .catch(() => setProgressLoaded(true));
      
      planService.getPlan(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, plan: res.data || null }));
          setPlanLoaded(true);
        })
        .catch(() => setPlanLoaded(true));
      
      gradingService.getAllMyScores(user.id)
        .then(res => {
          setRawData(prev => ({ ...prev, submissions: res.data?.submissions || [] }));
          setSubmissionsLoaded(true);
        })
        .catch(() => setSubmissionsLoaded(true));

      setTimeout(() => setLoading(false), 300);

      return () => {
        clearTimeout(timeoutId);
        abortController.abort();
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const dashboardData = React.useMemo(() => {
    try {
      const { enrollments, progress, plan, submissions } = rawData;
      const diagnosticData = plan?.diagnostic_data || null;

      const passedLevels = progress.filter(p => p.passed).length;
      const lessonsCount = Math.min(50, passedLevels * 3 + 5);
      const testsTaken = submissions.length;

      const enrollmentProgress = enrollments.map(e => {
        const courseId = e.course_id;
        const courseSubmissions = submissions.filter(s => Number(s.course_id) === Number(courseId));
        const courseProgress = progress.filter(p => Number(p.course_id) === Number(courseId));

        let latestSubmission = null;
        let latestTestDate = 0;
        courseSubmissions.forEach(sub => {
          const testDate = new Date(sub.test_date || sub.created_at || 0).getTime();
          if (testDate > latestTestDate) {
            latestTestDate = testDate;
            latestSubmission = sub;
          }
        });

        const levelScores = { Easy: 0, Medium: 0, Hard: 0 };
        courseProgress.forEach(p => {
          const lvl = p.level ? p.level.charAt(0).toUpperCase() + p.level.slice(1).toLowerCase() : 'Medium';
          if (['Easy', 'Medium', 'Hard'].includes(lvl) && typeof p.score === 'number') {
            if (p.score > levelScores[lvl]) levelScores[lvl] = p.score;
          }
        });

        courseSubmissions.forEach(sub => {
          const lvlRaw = sub.level || 'Medium';
          const lvl = lvlRaw.charAt(0).toUpperCase() + lvlRaw.slice(1).toLowerCase();
          if (['Easy', 'Medium', 'Hard'].includes(lvl)) {
            const rawPct = Math.round(sub.raw_score_percentage || 0);
            if (rawPct > levelScores[lvl]) levelScores[lvl] = rawPct;
          }
        });

        let courseScaledScore = calculateSatScore(levelScores.Easy, levelScores.Medium, levelScores.Hard);

        return {
          ...e.courses,
          enrollmentId: e.id,
          levelScores,
          courseScaledScore,
          latestSubmission,
          isEstimated: courseSubmissions.length === 0
        };
      });

      const overallScores = calculateStudentScore(progress, diagnosticData, submissions);

      return {
        scores: {
          total: overallScores.current,
          math: overallScores.math,
          rw: overallScores.rw,
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
      return {
        scores: { total: 0, math: 0, rw: 0, latestMath: 0, latestRw: 0, target: 1500, totalImprovement: 0 },
        counts: { lessons: 0, tests: 0, worksheets: 14, sessions: 0 },
        maxCounts: { lessons: 50, tests: 20, worksheets: 30, sessions: 24 },
        enrollments: []
      };
    }
  }, [rawData]);

  const { scores, counts, maxCounts, enrollments } = dashboardData;
  const progressPercent = Math.min(100, Math.round((scores.total / scores.target) * 100));

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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-lg border border-orange-200 dark:border-orange-900 max-w-lg w-full">
          <h1 className="text-2xl font-bold text-orange-600 mb-4">Dashboard Error</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-4">Failed to load student dashboard:</p>
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs font-mono mb-4 text-orange-500 overflow-auto max-h-48">
            {error}
          </div>
          <button onClick={() => window.location.reload()} className="w-full bg-sky-600 text-white py-2 rounded-lg">Reload Page</button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <SafeIcon icon={FiAlertCircle} className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
          <button onClick={() => navigate('/login')} className="px-6 py-2 bg-sky-600 text-white rounded-lg">Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 font-sans text-slate-900 dark:text-slate-100">
      <div className="max-w-7xl mx-auto py-8">
        
        {loading && (
          <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 flex items-center gap-3 animate-pulse">
            <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin text-sky-600" />
            <p className="text-sm text-sky-800 dark:text-sky-300 font-medium">Loading your latest data...</p>
          </div>
        )}

        <div className="mb-8 px-4 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Welcome back, {user?.name ? user.name.split(' ')[0] : 'Student'}!
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Here is your daily progress overview.</p>
        </div>

        {/* Scrolling Announcement / Marquee Bar */}
        <div className="mb-6 mx-4 sm:mx-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 shadow-sm">
          <div className="animate-marquee whitespace-nowrap text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-bold tracking-wide">
            “Certain instructional materials and practice content used by our tutors may include officially licensed or authorized resources from the College Board. All copyrights and trademarks related to such materials remain the property of their respective owners and are used solely for educational purposes.”
          </div>
        </div>

        <DashboardNotifications limit={3} />

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 mx-4 sm:mx-0">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {user.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user.name || 'Student'}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:flex gap-4 w-full md:w-auto">
            <Badge key="badge-class" label="Class" value="SAT Prep" color="bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300" />
            <Badge key="badge-score" label="Score" value={scores.total + "/1600"} color="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" />
            <Badge key="badge-target" label="Target" value={scores.target + "/1600"} color="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mx-4 sm:mx-0">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Score Performance</h3>
                <button onClick={() => navigate('/student/test-review')} className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg">Review Tests</button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="flex flex-col items-center">
                  <CircularProgress value={scores.total} max={1600} size={140} strokeWidth={12} color="#0ea5e9" />
                  <div className="mt-4 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Best Score</p>
                    <p className="text-2xl font-extrabold">{scores.total}</p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span>Math</span>
                      <span>{scores.latestMath}/800</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: (scores.latestMath / 8) + "%" }} className="h-full bg-sky-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span>Reading & Writing</span>
                      <span>{scores.latestRw}/800</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: (scores.latestRw / 8) + "%" }} className="h-full bg-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mx-4 sm:mx-0">
              <p className="text-xs font-bold text-slate-400 uppercase">Goal Progress</p>
              <p className="text-2xl font-bold text-orange-600 mb-2">{scores.target}</p>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: progressPercent + "%" }} className="h-full bg-orange-500" />
              </div>
              <p className="text-right text-[10px] text-slate-400 mt-1">{Math.max(0, scores.target - scores.total)} points to goal</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mx-4 sm:mx-0">
            <h3 className="font-bold text-lg mb-6">Learning Activity</h3>
            <div className="space-y-6">
              <ProgressRow key="row-lessons" icon={FiBook} color="text-sky-500" bg="bg-sky-500" label="Lessons" count={counts.lessons} max={maxCounts.lessons} />
              <ProgressRow key="row-quizzes" icon={FiCheckSquare} color="text-orange-500" bg="bg-orange-500" label="Quizzes" count={counts.tests} max={maxCounts.tests} />
              <ProgressRow key="row-worksheets" icon={FiFileText} color="text-yellow-500" bg="bg-yellow-500" label="Worksheets" count={counts.worksheets} max={maxCounts.worksheets} />
              <ProgressRow key="row-sessions" icon={FiActivity} color="text-orange-500" bg="bg-orange-500" label="Sessions" count={counts.sessions} max={maxCounts.sessions} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 mx-4 sm:mx-0">
            <div className="flex justify-between items-center mb-6 gap-2">
              <h3 className="font-bold text-base sm:text-lg truncate">Continue Learning</h3>
              <button onClick={() => navigate('/student/courses')} className="text-sky-600 text-xs sm:text-sm font-bold hover:underline whitespace-nowrap flex-shrink-0">View All</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.slice(0, 3).map(course => {
                const courseType = (course.tutor_type || '').toLowerCase().includes('math') ? 'MATH' : 'RW';
                return (
                  <div key={course.enrollmentId || course.id} className="p-5 border border-slate-100 dark:border-slate-800 rounded-2xl hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={"w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 " + (courseType === 'MATH' ? 'bg-sky-50 text-sky-600' : 'bg-green-50 text-green-600')}>
                          <SafeIcon icon={FiBook} className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold truncate text-sm sm:text-base" title={course.name}>{course.name}</h4>
                      </div>
                      <span className="text-base sm:text-lg font-black text-sky-600 ml-2">{course.courseScaledScore}</span>
                    </div>
                    <div className="space-y-3 mb-6">
                      <LevelScore key="lvl-easy" label="Easy" score={course.levelScores?.Easy} color={courseType === 'MATH' ? 'bg-sky-400' : 'bg-green-400'} />
                      <LevelScore key="lvl-medium" label="Medium" score={course.levelScores?.Medium} color={courseType === 'MATH' ? 'bg-sky-500' : 'bg-green-500'} />
                      <LevelScore key="lvl-hard" label="Hard" score={course.levelScores?.Hard} color={courseType === 'MATH' ? 'bg-sky-600' : 'bg-green-600'} />
                    </div>
                    <button onClick={() => navigate('/student/course/' + course.id)} className="w-full py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-sky-600 hover:text-white transition-colors">Resume Course</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
