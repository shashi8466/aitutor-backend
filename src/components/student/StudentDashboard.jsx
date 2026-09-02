import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import CircularProgress from '../../components/common/CircularProgress';
import Skeleton from '../../components/common/Skeleton';
import DashboardNotifications from '../../components/common/DashboardNotifications';

// Services
import { enrollmentService, progressService, planService, gradingService, parentService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateStudentScore, getCategory, calculateSatScore } from '../../utils/scoreCalculator';

// Icons
const {
  FiBook, FiCheckSquare, FiFileText, FiActivity, FiAward, FiAlertCircle, FiLoader, FiPlay, FiZap, FiTarget
} = FiIcons;

// Fixed, hand-placed scatter (not random - Math.random() would re-shuffle on every re-render)
// for the congratulations card's confetti layer. Deliberately sparse - a handful of soft,
// mostly gold/amber pieces for a premium accent rather than a busy multi-color scatter.
const CONFETTI_PIECES = [
  { top: '8%', left: '20%', rotate: '15deg', color: 'bg-amber-300', size: 'w-1.5 h-2.5', shape: 'rect' },
  { top: '14%', left: '45%', rotate: '-15deg', color: 'bg-amber-200', size: 'w-1.5 h-1.5', shape: 'circle' },
  { top: '6%', left: '62%', rotate: '25deg', color: 'bg-purple-300', size: 'w-1 h-3', shape: 'ribbon' },
  { top: '20%', left: '35%', rotate: '10deg', color: 'bg-amber-300', size: 'w-1.5 h-1.5', shape: 'circle' },
  { top: '32%', left: '15%', rotate: '-20deg', color: 'bg-sky-300', size: 'w-1.5 h-1.5', shape: 'circle' },
  { top: '10%', left: '80%', rotate: '18deg', color: 'bg-amber-200', size: 'w-1 h-3', shape: 'ribbon' }
];

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
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{label}</span>
        </div>
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{count}/{max}</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: percent + "%" }}
          className={"h-full rounded-full shadow-md " + bg}
        />
      </div>
    </div>
  );
}

// viewStudentId/viewStudent, when provided (Parent Portal's Dashboard page), render this EXACT
// component read-only for that linked student instead of the logged-in user - every data fetch
// below switches to the parentService (linked_students-authorized) equivalent, and every display
// name/email/avatar uses the viewed student's identity instead of the parent's own. No separate
// dashboard implementation; this is genuinely the same component/markup either way.
const StudentDashboard = ({ studentId: viewStudentId = null, student: viewStudent = null }) => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isParentView = !!viewStudentId;
  const targetId = viewStudentId || user?.id;
  const displayName = isParentView ? (viewStudent?.name || 'Student') : (user?.name || 'Student');
  const displayEmail = isParentView ? (viewStudent?.email || '') : (user?.email || '');

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

  const [targetProgress, setTargetProgress] = useState(null);
  const [topScores, setTopScores] = useState(null);

  useEffect(() => {
    if (user && !authLoading && targetId) {
      loadAllData().catch(err => {
        console.error('💥 Dashboard error:', err);
        setError(err.message || 'Failed to load dashboard');
        setLoading(false);
      });
    }
  }, [user, authLoading, targetId]);

  const loadAllData = async () => {
    if (!targetId) {
      setLoading(false);
      return;
    }

    try {
      const [enrollmentsRes, progressRes, planRes, submissionsRes] = await Promise.allSettled(
        isParentView
          ? [
              parentService.getStudentEnrollments(targetId),
              parentService.getStudentProgress(targetId),
              parentService.getStudentPlan(targetId),
              parentService.getStudentReports(targetId)
            ]
          : [
              enrollmentService.getStudentEnrollments(targetId),
              progressService.getAllUserProgress(targetId),
              planService.getPlan(targetId),
              gradingService.getAllMyScores(targetId)
            ]
      );

      // parentService.* are real axios calls (response shape { data: { enrollments/progress/
      // plan: ... } }); the self-view services above return their own { data: ... } directly
      // (not axios), so the two paths unwrap one level differently.
      const enrollments = enrollmentsRes.status === 'fulfilled'
        ? (isParentView ? (enrollmentsRes.value?.data?.enrollments || []) : (enrollmentsRes.value?.data || []))
        : [];
      const progress = progressRes.status === 'fulfilled'
        ? (isParentView ? (progressRes.value?.data?.progress || []) : (progressRes.value?.data || []))
        : [];
      const plan = planRes.status === 'fulfilled'
        ? (isParentView ? (planRes.value?.data?.plan || null) : (planRes.value?.data || null))
        : null;
      const submissions = submissionsRes.status === 'fulfilled' ? (submissionsRes.value?.data?.submissions || []) : [];

      setRawData({
        enrollments,
        progress,
        plan,
        submissions
      });
      
      setEnrollmentsLoaded(true);
      setProgressLoaded(true);
      setPlanLoaded(true);
      setSubmissionsLoaded(true);
      
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
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

  const { scores, counts, maxCounts } = dashboardData;
  const progressPercent = Math.min(100, Math.round((scores.total / scores.target) * 100));

  // Target-achievement banner only - deliberately independent of `scores` above (which stays
  // exactly as before for the score display/progress ring/badges). This uses the current
  // combined score from fully-completed Math/R&W topics or the best Full-Length Test, whichever
  // is higher - the same canonical combined-report calculation used everywhere else - with
  // durable first-crossing tracking so the attributed topic/test doesn't drift on later loads.
  useEffect(() => {
    if (!planLoaded || !targetId || !scores.target) return;
    const request = isParentView
      ? parentService.getTargetProgress(targetId, scores.target)
      : gradingService.getTargetProgress(scores.target);
    request
      .then(res => setTargetProgress(res.data))
      .catch(err => console.error('Failed to load target progress', err));
  }, [planLoaded, scores.target, targetId, isParentView]);

  // Top Scores - independent fetch, only needs the target student, not any of the score/plan
  // data above.
  useEffect(() => {
    if (!targetId) return;
    const request = isParentView ? parentService.getTopScores(targetId) : gradingService.getTopScores();
    request
      .then(res => setTopScores(res.data?.topScores || []))
      .catch(err => console.error('Failed to load top scores', err));
  }, [targetId, isParentView]);

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <SafeIcon icon={FiLoader} className="w-12 h-12 animate-spin text-sky-500" />
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-gray-900 p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-orange-200 dark:border-orange-900 max-w-lg w-full">
          <h1 className="text-2xl font-bold text-orange-600 mb-4">Dashboard Error</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Failed to load student dashboard:</p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-xs font-mono mb-4 text-orange-500 overflow-auto max-h-48">
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
    // In parentView mode this is embedded inside the Parent Portal's own gray-50/gray-900
    // page background (ParentDashboard.jsx) - no competing full-bleed background or forced
    // min-h-screen here, so it blends into that shell instead of reading as a separate block.
    <div className={`${isParentView ? '' : 'min-h-screen bg-[#FAFAFA] dark:bg-gray-900'} pb-12 font-sans text-gray-900 dark:text-gray-100`}>
      <div className="max-w-7xl mx-auto py-8">
        
        {loading && (
          <div className="mb-6 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-3 flex items-center gap-3 animate-pulse">
            <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin text-sky-600" />
            <p className="text-sm text-sky-800 dark:text-sky-300 font-medium">Loading your latest data...</p>
          </div>
        )}

        <div className="mb-8 px-4 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome back, {displayName.split(' ')[0]}!
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Here is your daily progress overview.</p>
        </div>

        {targetProgress?.reached && (
          <div className="mb-5 px-4 sm:px-0">
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#1a1140] via-[#150f38] to-[#0d0a26] p-6 shadow-[0_0_35px_-18px_rgba(139,92,246,0.3)]">
              {/* Ambient glows - kept subtle so the purple stays a soft premium accent, not a
                  strong hover-like glow */}
              <div className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full bg-purple-600/12 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

              {/* Confetti - deliberately sparse and low-opacity, a light accent rather than a
                  busy scatter */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {CONFETTI_PIECES.map((c, i) => (
                  <span
                    key={i}
                    className={`absolute ${c.shape === 'circle' ? 'rounded-full' : 'rounded-sm'} ${c.color} ${c.size}`}
                    style={{ top: c.top, left: c.left, transform: `rotate(${c.rotate})`, opacity: 0.55 }}
                  />
                ))}
              </div>

              {/* Firework burst - hidden below sm: at narrow widths the card switches to a
                  centered flex-col layout, and this decoration has no safe empty corner left to
                  sit in without risking overlap with the heading text. */}
              <svg className="pointer-events-none hidden sm:block absolute top-2 right-32 w-32 h-32 opacity-60" viewBox="0 0 100 100" fill="none">
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 22.5 * Math.PI) / 180;
                  const inner = i % 2 === 0 ? 40 : 26;
                  const x2 = 50 + Math.cos(angle) * inner;
                  const y2 = 50 + Math.sin(angle) * inner;
                  return <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke={i % 2 === 0 ? '#a78bfa' : '#818cf8'} strokeWidth="2" strokeLinecap="round" />;
                })}
              </svg>

              <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4">
                {/* Trophy */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl scale-125" />
                  <svg className="relative w-12 h-12 sm:w-16 sm:h-16 drop-shadow-[0_0_25px_rgba(251,191,36,0.55)]" viewBox="0 0 100 110" fill="none">
                    <defs>
                      <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fef3c7" />
                        <stop offset="45%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                      <linearGradient id="trophyBase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3f3f46" />
                        <stop offset="100%" stopColor="#18181b" />
                      </linearGradient>
                    </defs>
                    {/* base (dark pedestal) */}
                    <rect x="26" y="96" width="48" height="8" rx="2" fill="url(#trophyBase)" />
                    <rect x="37" y="86" width="26" height="12" rx="1" fill="url(#trophyBase)" />
                    {/* stem */}
                    <rect x="45" y="68" width="10" height="20" fill="url(#trophyGold)" />
                    {/* handles */}
                    <path d="M27 22 Q4 20 8 45 Q12 63 34 60" stroke="url(#trophyGold)" strokeWidth="7" fill="none" strokeLinecap="round" />
                    <path d="M73 22 Q96 20 92 45 Q88 63 66 60" stroke="url(#trophyGold)" strokeWidth="7" fill="none" strokeLinecap="round" />
                    {/* cup */}
                    <path d="M22 12 L78 12 L72 54 Q50 70 28 54 Z" fill="url(#trophyGold)" stroke="#92400e" strokeWidth="1" />
                    {/* glossy highlight streak */}
                    <path d="M30 16 Q26 32 33 46" stroke="#fffbeb" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.55" />
                    {/* rim */}
                    <rect x="18" y="6" width="64" height="10" rx="5" fill="url(#trophyGold)" stroke="#92400e" strokeWidth="1" />
                    {/* star */}
                    <path d="M50 24 L54 34 L65 35 L56 42 L59 53 L50 47 L41 53 L44 42 L35 35 L46 34 Z" fill="#fffbeb" opacity="0.9" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    Congratulations, {displayName.split(' ')[0]}! 🎉
                  </h3>
                  <p className="text-xs sm:text-sm text-indigo-200 mt-0.5">
                    You've reached your target score of <span className="font-bold text-amber-300">{targetProgress.target} / 1600</span>.
                  </p>

                  {/* flex-nowrap, not a grid - all four stay on one row at every width. The
                      4th (Target Reached) box gets extra flex-grow since its value is usually
                      the longest; icons/padding/font-size shrink together at the smallest sizes
                      so nothing needs to truncate or wrap to a new row. */}
                  <div className="mt-3 flex flex-nowrap gap-1.5 sm:gap-2.5">
                    <div className="flex-1 flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/10 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                      <div className="hidden sm:flex w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-sky-500/20 text-sky-300 items-center justify-center flex-shrink-0">
                        <SafeIcon icon={FiZap} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[6px] sm:text-[9px] text-indigo-300 font-semibold uppercase tracking-wide truncate">Math</p>
                        <p className="text-[10px] sm:text-sm font-bold text-white whitespace-nowrap">{targetProgress.mathScore} / 800</p>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/10 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                      <div className="hidden sm:flex w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-emerald-500/20 text-emerald-300 items-center justify-center flex-shrink-0">
                        <SafeIcon icon={FiBook} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[6px] sm:text-[9px] text-indigo-300 font-semibold uppercase tracking-wide truncate">Reading &amp; Writing</p>
                        <p className="text-[10px] sm:text-sm font-bold text-white whitespace-nowrap">{targetProgress.rwScore} / 800</p>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-1.5 sm:gap-2 bg-white/5 border border-white/10 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                      <div className="hidden sm:flex w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-purple-500/20 text-purple-300 items-center justify-center flex-shrink-0">
                        <SafeIcon icon={FiAward} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[6px] sm:text-[9px] text-indigo-300 font-semibold uppercase tracking-wide truncate">Overall SAT Score</p>
                        <p className="text-[10px] sm:text-sm font-bold text-white whitespace-nowrap">{targetProgress.overallScore} / 1600</p>
                      </div>
                    </div>

                    <div className="flex-[2.2] flex items-start gap-1.5 sm:gap-2 bg-amber-500/10 border border-amber-400/40 rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-2 min-w-0">
                      <div className="hidden sm:flex w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-amber-500/20 text-amber-300 items-center justify-center flex-shrink-0 mt-0.5">
                        <SafeIcon icon={FiTarget} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[6px] sm:text-[9px] text-amber-200/80 font-semibold uppercase tracking-wide truncate">
                          {targetProgress.triggerType === 'topic' ? 'Target reached after completing' : 'Target reached with'}
                        </p>
                        {/* break-words (not truncate) - the full name must never be cut off; if it
                            doesn't fit on one line at this box's width, it wraps to a second line
                            within the box instead of clipping. The box stays in the same row
                            either way, it just grows taller. */}
                        <p className="text-[10px] sm:text-sm font-bold text-amber-300 break-words leading-snug">
                          {targetProgress.triggerName || 'your completed topics'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DashboardNotifications limit={3} studentId={viewStudentId} basePath={isParentView ? '/parent' : '/student'} />


        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 mx-4 sm:mx-0">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {displayName.charAt(0) || 'S'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h2>
              <p className="text-sm text-gray-500">{displayEmail}</p>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mx-4 sm:mx-0">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white">Score Performance</h3>
                <button onClick={() => navigate(isParentView ? '/parent/test-history' : '/student/test-review')} className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-lg">Review Tests</button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="flex flex-col items-center">
                  <CircularProgress value={scores.total} max={1600} size={140} strokeWidth={12} color="#0ea5e9" />
                  <div className="mt-4 text-center">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Best Score</p>
                    <p className="text-2xl font-extrabold">{scores.total}</p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span>Math</span>
                      <span>{scores.latestMath}/800</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: (scores.latestMath / 8) + "%" }} className="h-full bg-sky-500" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span>Reading & Writing</span>
                      <span>{scores.latestRw}/800</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: (scores.latestRw / 8) + "%" }} className="h-full bg-green-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mx-4 sm:mx-0">
              <p className="text-xs font-bold text-gray-400 uppercase">Goal Progress</p>
              <p className="text-2xl font-bold text-orange-600 mb-2">{scores.target}</p>
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: progressPercent + "%" }} className="h-full bg-orange-500" />
              </div>
              <p className="text-right text-[10px] text-gray-400 mt-1">{Math.max(0, scores.target - scores.total)} points to goal</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mx-4 sm:mx-0">
            <h3 className="font-bold text-lg mb-6">Learning Activity</h3>
            <div className="space-y-6">
              <ProgressRow key="row-lessons" icon={FiBook} color="text-sky-500" bg="bg-sky-500" label="Lessons" count={counts.lessons} max={maxCounts.lessons} />
              <ProgressRow key="row-quizzes" icon={FiCheckSquare} color="text-orange-500" bg="bg-orange-500" label="Quizzes" count={counts.tests} max={maxCounts.tests} />
              <ProgressRow key="row-worksheets" icon={FiFileText} color="text-yellow-500" bg="bg-yellow-500" label="Worksheets" count={counts.worksheets} max={maxCounts.worksheets} />
              <ProgressRow key="row-sessions" icon={FiActivity} color="text-orange-500" bg="bg-orange-500" label="Sessions" count={counts.sessions} max={maxCounts.sessions} />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mx-4 sm:mx-0">
            <div className="flex justify-between items-center mb-6 gap-2">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white">Top Scores</h3>
              <button onClick={() => navigate(isParentView ? '/parent/test-history' : '/student/test-review')} className="text-sky-600 text-xs sm:text-sm font-bold hover:underline whitespace-nowrap flex-shrink-0">View All</button>
            </div>
            {topScores === null ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : topScores.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                Complete a topic or Full-Length Test to see your top scores here.
              </p>
            ) : (
              <div className="space-y-3">
                {topScores.map((result, idx) => (
                  <div
                    key={result.type}
                    className="flex items-center gap-4 p-4 border border-gray-100 dark:border-gray-700 rounded-2xl"
                  >
                    <div className="w-9 h-9 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold truncate text-sm sm:text-base">{result.label}</h4>
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
                        {result.description}
                      </p>
                    </div>
                    <span className="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400 flex-shrink-0">
                      {result.score} <span className="text-xs font-bold text-gray-400 dark:text-gray-500">/ {result.maxScore}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
